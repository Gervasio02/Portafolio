import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { tokenHash } from "./auth.js";
import { fail } from "./http.js";
import { cardOrder } from "./order.js";

const columnNames = ["Por hacer", "En progreso", "Hecho"];
const uuid = z.uuid();
const boardBody = z.object({
  title: z.string().trim().min(1).max(100),
  objective: z.string().trim().max(280).optional(),
});
const cardBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(3000).default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueAt: z.iso.date().nullish(),
  labels: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  columnId: uuid,
});

async function membership(tx, boardId, userId, roles) {
  const relation = await tx.membership.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  if (!relation) fail(404, "No encontramos ese tablero.");
  if (roles && !roles.includes(relation.role))
    fail(403, "Tu rol no permite realizar este cambio.");
  return relation;
}

// A board row is the single concurrency gate for changes to positions, roles and invitations.
function locked(db, boardId, userId, roles, action) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId}::uuid FOR UPDATE`;
    await membership(tx, boardId, userId, roles);
    return action(tx);
  });
}

async function columnOnBoard(tx, id, boardId) {
  const column = await tx.column.findFirst({ where: { id, boardId } });
  if (!column) fail(404, "No encontramos esa columna.");
  return column;
}

async function cardOnBoard(tx, id, boardId) {
  const card = await tx.card.findFirst({ where: { id, column: { boardId } } });
  if (!card) fail(404, "No encontramos esa tarjeta.");
  return card;
}

async function nextPosition(tx, columnId) {
  const result = await tx.card.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

function properties(data) {
  const { dueAt, labels, ...fields } = data;
  return {
    ...fields,
    dueAt: dueAt ? new Date(dueAt) : null,
    labels: [...new Set(labels)],
  };
}

export function boardRoutes(db) {
  const router = Router();
  const editors = ["OWNER", "EDITOR"];
  const owner = ["OWNER"];

  router.get("/boards", async (req, res) => {
    const links = await db.membership.findMany({
      where: { userId: req.userId },
      include: { board: true },
      orderBy: [{ board: { createdAt: "desc" } }, { boardId: "asc" }],
    });
    res.json(
      links.map(({ board, role }) => ({
        id: board.id,
        title: board.title,
        role,
      })),
    );
  });

  router.post("/boards", async (req, res) => {
    const fields = boardBody.parse(req.body);
    const board = await db.board.create({
      data: {
        ...fields,
        memberships: { create: { userId: req.userId, role: "OWNER" } },
        columns: {
          create: columnNames.map((title, position) => ({ title, position })),
        },
      },
    });
    res.status(201).json({ id: board.id, title: board.title, role: "OWNER" });
  });

  router.get("/boards/:id", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const relation = await db.membership.findUnique({
      where: { boardId_userId: { boardId: id, userId: req.userId } },
      include: {
        board: {
          include: {
            columns: {
              orderBy: { position: "asc" },
              include: {
                cards: { orderBy: [{ position: "asc" }, { id: "asc" }] },
              },
            },
            memberships: {
              include: { user: { select: { id: true, name: true } } },
              orderBy: { role: "asc" },
            },
          },
        },
      },
    });
    if (!relation) fail(404, "No encontramos ese tablero.");
    const {
      memberships,
      columns,
      title,
      objective,
      id: boardId,
    } = relation.board;
    res.json({
      id: boardId,
      title,
      objective,
      columns,
      role: relation.role,
      members: memberships.map(({ user, role }) => ({ ...user, role })),
    });
  });

  router.patch("/boards/:id", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const fields = boardBody.parse(req.body);
    res.json(
      await locked(db, id, req.userId, owner, (tx) =>
        tx.board.update({ where: { id }, data: fields }),
      ),
    );
  });

  router.delete("/boards/:id", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await locked(db, id, req.userId, owner, (tx) =>
      tx.board.delete({ where: { id } }),
    );
    res.status(204).end();
  });

  router.post("/boards/:id/cards", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const data = cardBody.parse(req.body);
    const card = await locked(db, id, req.userId, editors, async (tx) => {
      await columnOnBoard(tx, data.columnId, id);
      return tx.card.create({
        data: {
          ...properties(data),
          position: await nextPosition(tx, data.columnId),
        },
      });
    });
    res.status(201).json(card);
  });

  router.patch("/boards/:id/cards/:cardId", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const id = uuid.parse(req.params.cardId);
    const { columnId, ...data } = cardBody
      .extend({ columnId: uuid.optional() })
      .parse(req.body);
    res.json(
      await locked(db, boardId, req.userId, editors, async (tx) => {
        const card = await cardOnBoard(tx, id, boardId);
        const fields = properties(data);
        if (columnId && card.columnId !== columnId) {
          await columnOnBoard(tx, columnId, boardId);
          Object.assign(fields, {
            columnId,
            position: await nextPosition(tx, columnId),
          });
        }
        return tx.card.update({ where: { id }, data: fields });
      }),
    );
  });

  router.delete("/boards/:id/cards/:cardId", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const id = uuid.parse(req.params.cardId);
    await locked(db, boardId, req.userId, editors, async (tx) => {
      await cardOnBoard(tx, id, boardId);
      return tx.card.delete({ where: { id } });
    });
    res.status(204).end();
  });

  router.post("/boards/:id/cards/:cardId/move", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const id = uuid.parse(req.params.cardId);
    const { columnId, beforeId } = z
      .object({ columnId: uuid, beforeId: uuid.nullish() })
      .parse(req.body);
    await locked(db, boardId, req.userId, editors, async (tx) => {
      await cardOnBoard(tx, id, boardId);
      await columnOnBoard(tx, columnId, boardId);
      const cards = await tx.card.findMany({
        where: { columnId, id: { not: id } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      // Use parameterized SQL to persist the reorder in one round trip.
      const order = JSON.stringify(cardOrder(cards, id, beforeId));
      await tx.$executeRaw`
        UPDATE "Card" AS card
        SET "position" = sequence.position, "columnId" = ${columnId}::uuid
        FROM jsonb_to_recordset(${order}::jsonb) AS sequence (id uuid, position int)
        WHERE card.id = sequence.id
      `;
    });
    res.status(204).end();
  });

  router.post("/boards/:id/invitations", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const { email, role } = z
      .object({
        email: z.string().trim().toLowerCase().email().max(254),
        role: z.enum(["EDITOR", "VIEWER"]),
      })
      .parse(req.body);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await locked(db, boardId, req.userId, owner, async (tx) => {
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user) {
        const existing = await tx.membership.findUnique({
          where: { boardId_userId: { boardId, userId: user.id } },
        });
        if (existing) fail(409, "La persona ya pertenece al tablero.");
      }
      const data = { role, tokenHash: tokenHash(token), expiresAt };
      await tx.invitation.upsert({
        where: { boardId_email: { boardId, email } },
        create: { boardId, email, ...data },
        update: data,
      });
    });
    res.status(201).json({ email, role, expiresAt, token });
  });

  router.post("/invitations/accept", async (req, res) => {
    const { token } = z
      .object({ token: z.string().regex(/^[a-zA-Z0-9_-]{43}$/) })
      .parse(req.body);
    const hash = tokenHash(token);
    const boardId = await db.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash: hash },
      });
      if (!invitation || invitation.expiresAt < new Date())
        fail(404, "La invitación expiró o ya se usó.");
      await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${invitation.boardId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: req.userId },
        select: { email: true },
      });
      if (user.email !== invitation.email)
        fail(403, "Ingresa con el correo que recibió la invitación.");
      const deleted = await tx.invitation.deleteMany({
        where: {
          id: invitation.id,
          tokenHash: hash,
          expiresAt: { gt: new Date() },
        },
      });
      if (!deleted.count) fail(404, "La invitación expiró o ya se usó.");
      const { boardId, role } = invitation;
      await tx.membership.upsert({
        where: { boardId_userId: { boardId, userId: req.userId } },
        create: { boardId, userId: req.userId, role },
        update: {},
      });
      return boardId;
    });
    res.json({ boardId });
  });

  router.patch("/boards/:id/members/:userId", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const userId = uuid.parse(req.params.userId);
    const { role } = z
      .object({ role: z.enum(["EDITOR", "VIEWER"]) })
      .parse(req.body);
    await locked(db, boardId, req.userId, owner, async (tx) => {
      const member = await membership(tx, boardId, userId);
      if (member.role === "OWNER") fail(403, "El dueño conserva su rol.");
      await tx.membership.update({
        where: { boardId_userId: { boardId, userId } },
        data: { role },
      });
    });
    res.status(204).end();
  });

  router.delete("/boards/:id/members/:userId", async (req, res) => {
    const boardId = uuid.parse(req.params.id);
    const userId = uuid.parse(req.params.userId);
    await locked(db, boardId, req.userId, owner, async (tx) => {
      const member = await membership(tx, boardId, userId);
      if (member.role === "OWNER")
        fail(403, "El dueño conserva acceso al tablero.");
      await tx.membership.delete({
        where: { boardId_userId: { boardId, userId } },
      });
    });
    res.status(204).end();
  });

  return router;
}

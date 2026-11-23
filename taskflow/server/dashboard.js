import { Router } from "express";
import { z } from "zod";
import { fail } from "./http.js";

const timezone = z.string().min(1).max(100).default("America/Santiago");

function dayInZone(date, zone) {
  try {
    const fields = Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(date)
        .map(({ type, value }) => [type, value]),
    );
    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return fail(400, "La zona horaria no es válida.");
  }
}

const completion = (done, total) =>
  total ? Math.round((done * 100) / total) : 0;

export function dashboardRoutes(db) {
  const router = Router();
  router.get("/dashboard", async (req, res) => {
    const zone = timezone.parse(req.query.tz);
    const now = new Date();
    const asOfDate = dayInZone(now, zone);
    // Both aggregates and exceptions use the same read snapshot and the same
    // membership filter. No unrelated board contributes to the counts.
    const [rows, overdueCards] = await db.$transaction(
      [
        db.$queryRaw`
        SELECT board.id AS "boardId", board.title, board.objective, member.role::text AS role,
               col.id AS "columnId", col.title AS "columnTitle", col.position,
               COUNT(card.id)::int AS total,
               (COUNT(card.id) FILTER (WHERE card.priority = 'HIGH'))::int AS high,
               (COUNT(card.id) FILTER (WHERE card.priority = 'MEDIUM'))::int AS medium,
               (COUNT(card.id) FILTER (WHERE card.priority = 'LOW'))::int AS low,
               (COUNT(card.id) FILTER (WHERE col.position <> 2 AND card."dueAt" < ${asOfDate}::date))::int AS overdue,
               (COUNT(card.id) FILTER (WHERE col.position <> 2 AND card."dueAt" = ${asOfDate}::date))::int AS "dueToday"
        FROM "Membership" AS member
        JOIN "Board" AS board ON board.id = member."boardId"
        LEFT JOIN "Column" AS col ON col."boardId" = board.id
        LEFT JOIN "Card" AS card ON card."columnId" = col.id
        WHERE member."userId" = ${req.userId}::uuid
        GROUP BY board.id, member.role, col.id
        ORDER BY board."createdAt" DESC, board.id, col.position
      `,
        db.$queryRaw`
        SELECT card.id, card.title, card.priority::text AS priority, card."dueAt"::text AS "dueAt",
               board.id AS "boardId", board.title AS "boardTitle", col.title AS "columnTitle"
        FROM "Membership" AS member
        JOIN "Board" AS board ON board.id = member."boardId"
        JOIN "Column" AS col ON col."boardId" = board.id
        JOIN "Card" AS card ON card."columnId" = col.id
        WHERE member."userId" = ${req.userId}::uuid AND col.position <> 2
          AND card."dueAt" < ${asOfDate}::date
        ORDER BY card."dueAt", card.priority DESC, card.id
        LIMIT 20
      `,
      ],
      { isolationLevel: "RepeatableRead" },
    );

    const status = { todo: 0, doing: 0, done: 0 };
    const priority = { high: 0, medium: 0, low: 0 };
    let total = 0;
    let overdue = 0;
    let dueToday = 0;
    const boards = new Map();
    for (const row of rows) {
      const board = boards.get(row.boardId) ?? {
        id: row.boardId,
        title: row.title,
        objective: row.objective,
        role: row.role,
        total: 0,
        done: 0,
        overdue: 0,
        dueToday: 0,
        columns: [],
      };
      if (row.columnId) {
        board.columns.push({
          id: row.columnId,
          name: row.columnTitle,
          count: row.total,
        });
        status[
          row.position === 2 ? "done" : row.position === 1 ? "doing" : "todo"
        ] += row.total;
      }
      board.total += row.total;
      board.done += row.position === 2 ? row.total : 0;
      board.overdue += row.overdue;
      board.dueToday += row.dueToday;
      boards.set(board.id, board);
      total += row.total;
      overdue += row.overdue;
      dueToday += row.dueToday;
      priority.high += row.high;
      priority.medium += row.medium;
      priority.low += row.low;
    }

    res.set("Cache-Control", "private, no-store").json({
      asOf: now.toISOString(),
      asOfDate,
      totals: {
        boards: boards.size,
        cards: total,
        overdue,
        dueToday,
        progress: completion(status.done, total),
      },
      status,
      priority,
      boards: [...boards.values()].map((board) => ({
        ...board,
        progress: completion(board.done, board.total),
      })),
      overdueCards,
    });
  });
  return router;
}

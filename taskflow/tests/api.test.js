import { randomUUID } from "node:crypto";
import { jest } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../server/app.js";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error(
    "Configura TEST_DATABASE_URL con una base PostgreSQL desechable, cuyo nombre termine en _test.",
  );
}
const db = new PrismaClient({ datasourceUrl: url });
const log = jest.fn();
const app = createApp(db, {
  accessSecret: "taskflow-integration-test-access-secret",
  refreshSecret: "taskflow-integration-test-refresh-secret",
  origin: "http://localhost:5173",
  log,
});
const access = (user) => ({ Authorization: `Bearer ${user.accessToken}` });
const input = (email) => ({
  email,
  name: "Usuario de prueba",
  password: "una-clave-fuerte-1",
});
const credentials = (email) => ({ email, password: "una-clave-fuerte-1" });
const run = randomUUID();
const email = (who) => `${who}-${run}@taskflow.test`;
let owner, other, reader;

beforeAll(async () => {
  owner = (
    await request(app)
      .post("/api/auth/register")
      .send(input(email("owner")))
      .expect(201)
  ).body;
  other = (
    await request(app)
      .post("/api/auth/register")
      .send(input(email("other")))
      .expect(201)
  ).body;
  reader = (
    await request(app)
      .post("/api/auth/register")
      .send(input(email("reader")))
      .expect(201)
  ).body;
});
afterAll(async () => {
  await db.board.deleteMany({
    where: {
      memberships: {
        some: { user: { email: { contains: run } }, role: "OWNER" },
      },
    },
  });
  await db.user.deleteMany({ where: { email: { contains: run } } });
  await db.$disconnect();
});

async function createBoard(user, title = "Tablero de prueba") {
  const result = await request(app)
    .post("/api/boards")
    .set(access(user))
    .send({ title })
    .expect(201);
  return boardDetail(result.body.id, user);
}
async function boardDetail(id, user) {
  return (
    await request(app).get(`/api/boards/${id}`).set(access(user)).expect(200)
  ).body;
}
async function invite(board, invited, role = "VIEWER") {
  return (
    await request(app)
      .post(`/api/boards/${board.id}/invitations`)
      .set(access(owner))
      .send({ email: invited, role })
      .expect(201)
  ).body.token;
}
const cardInput = (board, title, fields = {}) => ({
  title,
  columnId: board.columns[0].id,
  ...fields,
});
async function addCard(board, user, title, fields) {
  return (
    await request(app)
      .post(`/api/boards/${board.id}/cards`)
      .set(access(user))
      .send(cardInput(board, title, fields))
      .expect(201)
  ).body;
}

test("card comments respect membership and changes are recorded transactionally", async () => {
  const board = await createBoard(owner);
  const card = await addCard(board, owner, "Seguimiento");
  const route = `/api/boards/${board.id}/cards/${card.id}`;
  await request(app).get(`${route}/activity`).set(access(other)).expect(404);
  await request(app).post(`${route}/comments`).set(access(other)).send({body:"No autorizado"}).expect(404);
  await request(app).post(`${route}/comments`).set(access(owner)).send({body:"  Validado  "}).expect(201);
  await request(app).patch(route).set(access(owner)).send({title:"Revisado"}).expect(200);
  await request(app).post(`${route}/move`).set(access(owner)).send({columnId:board.columns[1].id}).expect(204);
  const response = await request(app).get(`${route}/activity`).set(access(owner)).expect(200);
  expect(response.body.map(row=>row.action)).toEqual(expect.arrayContaining(["COMMENT","UPDATED","MOVED"]));
  expect(response.body.find(row=>row.action==="COMMENT").body).toBe("Validado");
});

test("PostgreSQL serializes competing creates at the WIP limit", async () => {
  const board = await createBoard(owner);
  const columnId = board.columns[0].id;
  await request(app).patch(`/api/boards/${board.id}/columns/${columnId}`).set(access(owner)).send({wipLimit:1}).expect(200);
  const attempts = await Promise.all(["A","B","C"].map(title => request(app).post(`/api/boards/${board.id}/cards`).set(access(owner)).send({title,columnId,assigneeId:owner.user.id})));
  expect(attempts.map(result=>result.status).sort()).toEqual([201,409,409]);
  const persisted = await boardDetail(board.id, owner);
  expect(persisted.columns[0].cards).toHaveLength(1);
  expect(persisted.columns[0].cards[0].assigneeId).toBe(owner.user.id);
});

test("health, sesión protegida, registro, login, refresh rotatorio y logout", async () => {
  const guest = request.agent(app);
  await guest.get("/api/health").expect(200, { status: "ok" });
  await guest.get("/api/boards").expect(401);
  await guest
    .post("/api/auth/register")
    .send(input(email("owner")))
    .expect(409);
  await guest
    .post("/api/auth/register")
    .send({ email: "correo erróneo" })
    .expect(400);
  await guest
    .post("/api/auth/login")
    .send(credentials(email("missing")))
    .expect(401);
  await guest
    .post("/api/auth/login")
    .send({ ...credentials(email("owner")), password: "clave-invalida" })
    .expect(401);
  const login = await guest
    .post("/api/auth/login")
    .send(credentials(email("owner")))
    .expect(200);
  const first = login.headers["set-cookie"][0];
  expect(first).toMatch(/HttpOnly/);
  const rotated = await guest.post("/api/auth/refresh").expect(200);
  expect(rotated.headers["set-cookie"][0]).not.toBe(first);
  await request(app)
    .post("/api/auth/refresh")
    .set("Cookie", first.split(";")[0])
    .expect(401);
  await guest.post("/api/auth/logout").expect(204);
  await guest.post("/api/auth/refresh").expect(401);
  const invalidLogout = await request(app)
    .post("/api/auth/logout")
    .set("Cookie", "taskflow_refresh=malformed")
    .expect(204);
  expect(invalidLogout.headers["set-cookie"][0]).toMatch(/^taskflow_refresh=;/);
  await guest.post("/api/auth/logout").expect(204);
  await request(app).get("/api/does-not-exist").set(access(owner)).expect(404);
  await request(app)
    .get("/api/boards")
    .set("Authorization", "Bearer invalid")
    .expect(401);
  const malformed = await request(app)
    .post("/api/auth/register")
    .type("json")
    .send("{[");
  expect(malformed.status).toBe(400);
  expect(log).toHaveBeenCalled();
});

test("tableros privados con columnas estándar y permisos para actualizar o eliminar", async () => {
  const board = await createBoard(owner);
  expect(board.columns.map((c) => c.title)).toEqual([
    "Por hacer",
    "En progreso",
    "Hecho",
  ]);
  expect(
    (await request(app).get("/api/boards").set(access(owner)).expect(200)).body,
  ).toContainEqual({ title: board.title, role: "OWNER", id: board.id });
  await request(app)
    .get(`/api/boards/${board.id}`)
    .set(access(other))
    .expect(404);
  await request(app)
    .patch(`/api/boards/${board.id}`)
    .set(access(owner))
    .send({ title: "Renombrado" })
    .expect(200);
  expect((await boardDetail(board.id, owner)).title).toBe("Renombrado");
  await request(app)
    .delete(`/api/boards/${board.id}`)
    .set(access(other))
    .expect(404);
  await request(app)
    .delete(`/api/boards/${board.id}`)
    .set(access(owner))
    .expect(204);
  await request(app)
    .get(`/api/boards/${board.id}`)
    .set(access(owner))
    .expect(404);
});

test("invitación canjeable por un solo correo, revocación y separación de roles", async () => {
  const board = await createBoard(owner);
  const viewerToken = await invite(board, reader.user.email);
  const editorToken = await invite(board, other.user.email, "EDITOR");
  await request(app)
    .post("/api/invitations/accept")
    .set(access(other))
    .send({ token: viewerToken })
    .expect(403);
  await request(app)
    .post("/api/invitations/accept")
    .set(access(reader))
    .send({ token: viewerToken })
    .expect(200, { boardId: board.id });
  await request(app)
    .post("/api/invitations/accept")
    .set(access(reader))
    .send({ token: viewerToken })
    .expect(404);
  await request(app)
    .post("/api/invitations/accept")
    .set(access(other))
    .send({ token: editorToken })
    .expect(200);
  expect((await boardDetail(board.id, reader)).role).toBe("VIEWER");
  expect((await boardDetail(board.id, other)).role).toBe("EDITOR");
  await request(app)
    .post(`/api/boards/${board.id}/cards`)
    .set(access(reader))
    .send(cardInput(board, "No permitido"))
    .expect(403);
  await request(app)
    .patch(`/api/boards/${board.id}`)
    .set(access(other))
    .send({ title: "No permitido" })
    .expect(403);
  await addCard(board, other, "Editor puede escribir");
  await request(app)
    .post(`/api/boards/${board.id}/invitations`)
    .set(access(owner))
    .send({ email: reader.user.email, role: "EDITOR" })
    .expect(409);
  const memberPath = (user) =>
    `/api/boards/${board.id}/members/${user.user.id}`;
  await request(app)
    .patch(memberPath(owner))
    .set(access(owner))
    .send({ role: "VIEWER" })
    .expect(403);
  await request(app).delete(memberPath(owner)).set(access(owner)).expect(403);
  await request(app)
    .patch(memberPath(reader))
    .set(access(owner))
    .send({ role: "EDITOR" })
    .expect(204);
  await addCard(board, reader, "Rol actualizado");
  await request(app).delete(memberPath(reader)).set(access(owner)).expect(204);
  await request(app)
    .get(`/api/boards/${board.id}`)
    .set(access(reader))
    .expect(404);
});

test("edición y movimiento persistente de tarjetas, aislamiento y etiquetas", async () => {
  const board = await createBoard(owner);
  const foreign = await createBoard(other);
  const one = await addCard(board, owner, "Primera", {
    dueAt: "2030-12-05",
    labels: ["UX", "UX"],
  });
  expect(one.labels).toEqual(["UX"]);
  expect(one.dueAt).toBe("2030-12-05T00:00:00.000Z");
  const two = await addCard(board, owner, "Segunda");
  const base = `/api/boards/${board.id}/cards`;
  await request(app)
    .post(base)
    .set(access(owner))
    .send(cardInput(foreign, "En el lugar equivocado"))
    .expect(404);
  await request(app)
    .post(base)
    .set(access(owner))
    .send(cardInput(board, "Fecha inválida", { dueAt: "2026-02-31" }))
    .expect(400);
  const move = (id) => `${base}/${id}/move`;
  const [todo, doing] = board.columns;
  await request(app)
    .post(move(two.id))
    .set(access(owner))
    .send({ columnId: todo.id, beforeId: one.id })
    .expect(204);
  expect(
    (await boardDetail(board.id, owner)).columns[0].cards.map(
      (card) => card.id,
    ),
  ).toEqual([two.id, one.id]);
  await request(app)
    .post(move(one.id))
    .set(access(owner))
    .send({ columnId: doing.id, beforeId: two.id })
    .expect(400);
  await request(app)
    .post(move(one.id))
    .set(access(owner))
    .send({ columnId: doing.id })
    .expect(204);
  await request(app)
    .patch(`${base}/${one.id}`)
    .set(access(owner))
    .send({ title: "Editada", priority: "HIGH", columnId: todo.id })
    .expect(200);
  expect(
    (await boardDetail(board.id, owner)).columns[0].cards.map(
      (card) => card.title,
    ),
  ).toEqual(["Segunda", "Editada"]);
  await request(app)
    .delete(`${base}/${randomUUID()}`)
    .set(access(owner))
    .expect(404);
  await request(app).delete(`${base}/${one.id}`).set(access(owner)).expect(204);
  expect((await boardDetail(board.id, owner)).columns[0].cards).toHaveLength(1);
});

test("altas simultáneas quedan en posiciones distintas", async () => {
  const board = await createBoard(owner);
  const created = await Promise.all(
    ["A", "B", "C"].map((title) => addCard(board, owner, title)),
  );
  expect(created.map((card) => card.position).sort()).toEqual([0, 1, 2]);
});

test("dashboard reflects real changes made by another session and never counts a private board", async () => {
  const created = await request(app)
    .post("/api/boards")
    .set(access(owner))
    .send({
      title: "Operación visible",
      objective: "Cerrar tres entregas antes del viernes.",
    })
    .expect(201);
  const visible = await boardDetail(created.body.id, owner);
  expect(visible.objective).toBe("Cerrar tres entregas antes del viernes.");
  const invisible = await createBoard(owner, "Operación privada");
  const token = await invite(visible, reader.user.email);
  await request(app)
    .post("/api/invitations/accept")
    .set(access(reader))
    .send({ token })
    .expect(200);
  await addCard(invisible, owner, "Secreto del otro tablero", {
    dueAt: "2021-01-20",
    priority: "HIGH",
  });
  await request(app).get("/api/dashboard").expect(401);
  await request(app)
    .get("/api/dashboard?tz=Madrid/Espana")
    .set(access(reader))
    .expect(400);
  const panel = () =>
    request(app)
      .get("/api/dashboard?tz=America%2FSantiago")
      .set(access(reader))
      .expect(200);

  const { body: empty } = await panel();
  expect(empty.totals).toEqual({
    boards: 1,
    cards: 0,
    overdue: 0,
    dueToday: 0,
    progress: 0,
  });
  const urgent = await addCard(visible, owner, "Entrega atrasada", {
    priority: "HIGH",
    dueAt: "2021-01-18",
  });
  await addCard(visible, owner, "Revisar hoy", {
    priority: "MEDIUM",
    dueAt: empty.asOfDate,
  });
  await addCard(visible, owner, "Trabajo cerrado a tiempo", {
    priority: "LOW",
    dueAt: "2021-01-08",
    columnId: visible.columns[2].id,
  });
  const { body, headers } = await panel();
  expect(headers["cache-control"]).toContain("no-store");
  expect(body.totals).toEqual({
    boards: 1,
    cards: 3,
    overdue: 1,
    dueToday: 1,
    progress: 33,
  });
  expect(body.status).toEqual({ todo: 2, doing: 0, done: 1 });
  expect(body.priority).toEqual({ high: 1, medium: 1, low: 1 });
  expect(body.boards).toHaveLength(1);
  expect(body.boards[0]).toMatchObject({
    id: visible.id,
    title: visible.title,
    objective: visible.objective,
    role: "VIEWER",
    progress: 33,
  });
  expect(body.boards[0].columns.map(({ count }) => count)).toEqual([2, 0, 1]);
  expect(body.overdueCards.map(({ title }) => title)).toEqual([
    "Entrega atrasada",
  ]);

  await request(app)
    .post(`/api/boards/${visible.id}/cards/${urgent.id}/move`)
    .set(access(owner))
    .send({ columnId: visible.columns[2].id })
    .expect(204);
  await request(app)
    .patch(`/api/boards/${visible.id}`)
    .set(access(owner))
    .send({ title: visible.title, objective: "Operación estabilizada." })
    .expect(200);
  const { body: completed } = await panel();
  expect(completed.totals).toMatchObject({
    overdue: 0,
    dueToday: 1,
    progress: 67,
  });
  expect(completed.overdueCards).toEqual([]);
  expect(completed.boards[0].objective).toBe("Operación estabilizada.");

  await request(app)
    .delete(`/api/boards/${visible.id}/members/${reader.user.id}`)
    .set(access(owner))
    .expect(204);
  const { body: revoked } = await panel();
  expect(revoked.boards).toEqual([]);
  expect(revoked.totals.cards).toBe(0);
});

import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { fail, HttpError } from "./http.js";

const cookie = "taskflow_refresh";
const refreshAge = 14 * 24 * 60 * 60 * 1000;
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(8)
  .refine(
    (value) => Buffer.byteLength(value) <= 72,
    "Usa un máximo de 72 bytes.",
  );
const credentials = z.object({ email, password });
const registration = credentials.extend({
  name: z.string().trim().min(2).max(80),
});
const selectUser = { id: true, email: true, name: true };

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function authentication(db, settings) {
  const routes = Router();
  const { accessSecret, refreshSecret, production } = settings;
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/api/auth",
  };
  const audience = "taskflow";
  const access = (id) =>
    jwt.sign({ purpose: "access" }, accessSecret, {
      subject: id,
      audience,
      expiresIn: "15m",
      algorithm: "HS256",
    });

  function read(token, secret, purpose) {
    try {
      const payload = jwt.verify(token, secret, {
        audience,
        algorithms: ["HS256"],
      });
      if (payload.purpose === purpose && typeof payload.sub === "string")
        return payload;
    } catch {
      // Expired or invalid tokens use the same response.
    }
    fail(401, "Tu sesión expiró. Vuelve a ingresar.");
  }

  async function session(tx, userId) {
    const id = randomUUID();
    const token = jwt.sign({ purpose: "refresh" }, refreshSecret, {
      subject: userId,
      jwtid: id,
      audience,
      expiresIn: "14d",
      algorithm: "HS256",
    });
    await tx.session.create({
      data: {
        id,
        userId,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + refreshAge),
      },
    });
    return token;
  }

  function issue(res, user, refresh, status = 200) {
    res.cookie(cookie, refresh, { ...cookieOptions, maxAge: refreshAge });
    return res.status(status).json({ user, accessToken: access(user.id) });
  }

  routes.post("/register", async (req, res) => {
    const { name, email, password } = registration.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const { user, refresh } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
        select: selectUser,
      });
      return { user, refresh: await session(tx, user.id) };
    });
    issue(res, user, refresh, 201);
  });

  routes.post("/login", async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const record = await db.user.findUnique({ where: { email } });
    if (!record || !(await bcrypt.compare(password, record.passwordHash)))
      fail(401, "Correo o contraseña incorrectos.");
    issue(
      res,
      { id: record.id, name: record.name, email: record.email },
      await session(db, record.id),
    );
  });

  routes.post("/refresh", async (req, res) => {
    const token = req.cookies[cookie];
    const payload = read(token, refreshSecret, "refresh");
    const { user, refresh } = await db.$transaction(async (tx) => {
      const result = await tx.session.deleteMany({
        where: {
          id: payload.jti,
          userId: payload.sub,
          tokenHash: tokenHash(token),
          expiresAt: { gt: new Date() },
        },
      });
      if (!result.count) fail(401, "Tu sesión expiró. Vuelve a ingresar.");
      const user = await tx.user.findUniqueOrThrow({
        where: { id: payload.sub },
        select: selectUser,
      });
      return { user, refresh: await session(tx, user.id) };
    });
    issue(res, user, refresh);
  });

  routes.post("/logout", async (req, res) => {
    const token = req.cookies[cookie];
    if (token) {
      try {
        const payload = read(token, refreshSecret, "refresh");
        await db.session.deleteMany({
          where: {
            id: payload.jti,
            userId: payload.sub,
            tokenHash: tokenHash(token),
          },
        });
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) throw error;
      }
    }
    res.clearCookie(cookie, cookieOptions).status(204).end();
  });

  function requireUser(req, _res, next) {
    const token = req.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    req.userId = read(token, accessSecret, "access").sub;
    next();
  }

  return { routes, requireUser };
}

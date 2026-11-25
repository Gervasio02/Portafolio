import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { ZodError } from "zod";
import { authentication } from "./auth.js";
import { boardRoutes } from "./boards.js";
import { HttpError } from "./http.js";
import { operationsRoutes } from "./operations.js";
import { dashboardRoutes } from "./dashboard.js";

const dist = fileURLToPath(new URL("../dist", import.meta.url));

export function createApp(db, settings) {
  const app = express();
  app.disable("x-powered-by");
  if (settings.trustProxy) app.set("trust proxy", settings.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "upgrade-insecure-requests": settings.production ? [] : null,
        },
      },
    }),
  );
  app.use(cors({ origin: settings.origin ?? false, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = Date.now();
    res.set("X-Request-Id", requestId);
    res.once("finish", () =>
      settings.log?.({
        requestId,
        method: req.method,
        status: res.statusCode,
        elapsedMs: Date.now() - started,
      }),
    );
    next();
  });
  // La portada (otro dominio) consulta esta ruta para despertar la app.
  app.get("/api/health", async (_req, res) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });

  const auth = authentication(db, settings);
  const authLimit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera un minuto." },
  });
  app.use(["/api/auth/register", "/api/auth/login"], authLimit);
  app.use("/api/auth", auth.routes);
  app.use("/api", auth.requireUser, boardRoutes(db), dashboardRoutes(db), operationsRoutes(db));
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Ruta no encontrada." }),
  );

  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get("/", (_req, res) => res.sendFile("index.html", { root: dist }));
  }

  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Revisa los datos ingresados.",
        issues: error.issues.map(({ path, message }) => ({ path, message })),
      });
    }
    if (error instanceof HttpError)
      return res
        .status(error.status)
        .json({ error: error.message, code: error.code });
    if (error.code === "P2002")
      return res.status(409).json({ error: "Ese registro ya existe." });
    if (error.status === 400 || error.status === 413)
      return res
        .status(error.status)
        .json({ error: "El cuerpo de la solicitud no es válido." });
    settings.log?.({ error: error.name, code: error.code });
    return res
      .status(500)
      .json({ error: "No pudimos completar la solicitud." });
  });

  return app;
}

import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";

const accessSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
const production = process.env.NODE_ENV === "production";
if (
  !process.env.DATABASE_URL ||
  !accessSecret ||
  !refreshSecret ||
  accessSecret.length < 32 ||
  refreshSecret.length < 32 ||
  accessSecret === refreshSecret
) {
  throw new Error(
    "Configura DATABASE_URL y dos secretos JWT distintos de al menos 32 caracteres.",
  );
}
if (
  production &&
  [accessSecret, refreshSecret].some((secret) =>
    /local-only-example|only-for-local-taskflow/.test(secret),
  )
) {
  throw new Error("Genera secretos nuevos para producción.");
}
const db = new PrismaClient();
const port = Number(process.env.PORT ?? 3001);
const app = createApp(db, {
  accessSecret,
  refreshSecret,
  production,
  origin: process.env.APP_ORIGIN,
  trustProxy: process.env.TRUST_PROXY === "1" ? 1 : undefined,
  log: (entry) => console.log(JSON.stringify(entry)),
});
const server = app.listen(port, () =>
  console.log(`TaskFlow escuchando en el puerto ${port}`),
);
async function stop() {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

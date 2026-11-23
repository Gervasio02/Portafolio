import { cpSync, existsSync } from "node:fs";

const output = ".next/standalone";
if (!existsSync(`${output}/server.js`)) {
  console.error("Ejecuta npm run build antes de iniciar el servidor.");
  process.exit(1);
}
cpSync(".next/static", `${output}/.next/static`, { recursive: true });
cpSync("public", `${output}/public`, { recursive: true });
process.env.HOSTNAME = process.env.NOVA_HOSTNAME || "127.0.0.1";
await import("../.next/standalone/server.js");

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({ transactionOptions: { timeout: 30_000 } });
const email = "demo@taskflow.example";
const defaultBoard = "d27caeb2-1add-4fcf-afe8-c8ca2b3749c4";
const supportBoard = "2175743f-1785-40ca-ad2e-f71dc5c3aba0";
const demoOwner = process.env.DEMO_OWNER_PASSWORD;
if (
  process.env.NODE_ENV === "production" &&
  (!demoOwner ||
    Buffer.byteLength(demoOwner) < 16 ||
    Buffer.byteLength(demoOwner) > 72)
) {
  throw new Error(
    "Configura DEMO_OWNER_PASSWORD para sembrar una demo pública.",
  );
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
}).format(new Date());
const due = (days) => {
  if (days === undefined) return null;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const demoBoards = [
  {
    id: defaultBoard,
    title: "Lanzamiento de producto",
    objective:
      "Cerrar las tareas críticas de calidad y soporte antes de publicar la próxima versión.",
    cards: [
      [
        [
          "Redactar guía de inicio",
          "Un recorrido corto para una persona nueva en el equipo.",
          "MEDIUM",
          ["Contenido"],
          2,
        ],
        [
          "Revisar accesibilidad en móvil",
          "Comprobar contraste, foco y tamaño de los controles.",
          "HIGH",
          ["Calidad"],
          -2,
        ],
      ],
      [
        [
          "Preparar demostración",
          "Grabar el flujo de creación y movimiento de tareas.",
          "HIGH",
          ["Demo", "Producto"],
          0,
        ],
        [
          "Definir métricas de adopción",
          "Acordar el primer conjunto de indicadores.",
          "LOW",
          ["Producto"],
          4,
        ],
      ],
      [
        ["Definir el alcance inicial", "", "MEDIUM", ["Planificación"], -1],
        ["Diseñar el flujo de registro", "", "LOW", ["Diseño"]],
        ["Configurar el repositorio", "", "LOW", ["DevOps"]],
      ],
    ],
  },
  {
    id: supportBoard,
    title: "Operación y soporte",
    objective:
      "Resolver incidencias del servicio y documentar las soluciones que eviten su repetición.",
    cards: [
      [
        [
          "Actualizar artículo de soporte",
          "Documentar cómo recuperar el acceso al portal.",
          "LOW",
          ["Soporte"],
          3,
        ],
        [
          "Revisar alertas sin responsable",
          "Asignar un responsable y validar los canales de aviso.",
          "HIGH",
          ["Incidencia"],
          -1,
        ],
      ],
      [
        [
          "Reproducir error de sincronización",
          "Confirmar si se repite luego de volver a iniciar sesión.",
          "HIGH",
          ["Incidencia"],
          0,
        ],
      ],
      [["Restablecer tablero de monitoreo", "", "MEDIUM", ["Operaciones"], -4]],
    ],
  },
];

try {
  const viewerHash = await bcrypt.hash("TaskFlow-demo-2026", 12);
  const ownerHash = await bcrypt.hash(
    demoOwner || "TaskFlow-local-owner-2026",
    12,
  );
  await db.$transaction(async (tx) => {
    const viewer = await tx.user.upsert({
      where: { email },
      create: { email, name: "Invitado de demo", passwordHash: viewerHash },
      update: { passwordHash: viewerHash },
    });
    const ownerEmail = "equipo@taskflow.example";
    const owner = await tx.user.upsert({
      where: { email: ownerEmail },
      create: {
        email: ownerEmail,
        name: "Equipo TaskFlow",
        passwordHash: ownerHash,
      },
      update: demoOwner ? { passwordHash: ownerHash } : {},
    });
    for (const { id, title, objective, cards } of demoBoards) {
      await tx.board.upsert({
        where: { id },
        create: {
          id,
          title,
          objective,
          memberships: {
            create: [
              { userId: owner.id, role: "OWNER" },
              { userId: viewer.id, role: "VIEWER" },
            ],
          },
          columns: {
            create: ["Por hacer", "En progreso", "Hecho"].map(
              (title, position) => ({
                title,
                position,
                cards: {
                  create: cards[position].map(
                    (
                      [title, description, priority, labels, days],
                      position,
                    ) => ({
                      title,
                      description,
                      priority,
                      labels,
                      position,
                      dueAt: due(days),
                    }),
                  ),
                },
              }),
            ),
          },
        },
        update: {},
      });
      // Backfill the new field for existing seeded boards without changing
      // any manually chosen objective or previously edited cards.
      await tx.board.updateMany({
        where: { id, objective: "" },
        data: { objective },
      });
    }
  });
  console.log("Tableros de operaciones disponibles.");
} finally {
  await db.$disconnect();
}

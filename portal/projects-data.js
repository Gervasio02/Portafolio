"use strict";

// Fuente única de datos para el catálogo (proyectos/).
// La portada (index.html) tiene su propio HTML estático: si cambias un
// proyecto aquí, revisa también su entrada en index.html.
window.PORTFOLIO_PROJECTS = [
  {
    id: "taskflow",
    name: "TaskFlow",
    type: "Gestión",
    stack: ["React", "Express", "Prisma", "PostgreSQL"],
    image: "taskflow-720.webp",
    live: "https://taskflow-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://taskflow-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
    demo: "../taskflow/index.html#demo",
    featured: true,
    goal: "Organizar entregas y supervisar el trabajo de un equipo.",
    features:
      "Tableros, calendario, responsables, límites WIP, comentarios, actividad, SLA, notificaciones y permisos por miembro.",
    architecture:
      "React consume una API Express; Prisma persiste en PostgreSQL. Las transacciones serializan las modificaciones del tablero.",
    learning:
      "Consistencia de posiciones, concurrencia y autorización por pertenencia al tablero.",
  },
  {
    id: "reservaya",
    name: "ReservaYa",
    type: "Reservas",
    stack: ["React", "FastAPI", "SQLAlchemy", "PostgreSQL"],
    image: "reservaya-720.webp",
    live: "https://reservaya-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://reservaya-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
    demo: "../reservaya/index.html#demo",
    featured: true,
    goal: "Reservar canchas sin asignar dos veces un mismo horario.",
    features:
      "Disponibilidad, tarifas punta, reservas, cancelación, comprobantes, horarios, mantenimiento y métricas de ocupación.",
    architecture:
      "React consulta FastAPI; SQLAlchemy y PostgreSQL protegen la ocupación con restricciones y bloqueos transaccionales.",
    learning:
      "Concurrencia entre reservas y mantenimiento; precios confirmados y fechas en America/Santiago.",
  },
  {
    id: "tiendanova",
    name: "TiendaNova",
    type: "Comercio",
    stack: ["Next.js", "React", "Prisma", "PostgreSQL"],
    image: "tiendanova-720.webp",
    live: "https://tiendanova-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://tiendanova-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    demo: "../tiendanova/index.html#demo",
    featured: true,
    goal: "Simular una compra manteniendo pedidos e inventario consistentes.",
    features:
      "Catálogo con variantes, carrito, cupones, checkout idempotente, pedidos, cancelaciones, devoluciones y administración de inventario.",
    architecture:
      "Next.js y Auth.js validan la sesión; Prisma ejecuta operaciones comerciales transaccionales.",
    learning:
      "Evitar compras repetidas, sobreventa y reposiciones dobles de inventario.",
  },
  {
    id: "snake",
    name: "Snake",
    type: "Juegos",
    stack: ["React", "TypeScript", "Express", "Prisma"],
    image: "snake-720.webp",
    demo: "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
    action: "Jugar Snake",
    featured: true,
    goal: "Demostrar un motor de juego reproducible y un ranking verificable.",
    features:
      "Modos de juego, desafío diario, logros, controles táctiles, pausa, progreso, PWA instalable y ranking con reproducción verificada.",
    architecture:
      "Un motor TypeScript comparte las reglas entre navegador y verificación de partidas en Express.",
    learning:
      "Estados, bucle de animación y validación del resultado en el servidor.",
  },
  {
    id: "interrogatorio",
    name: "Interrogatorio",
    type: "Juegos",
    stack: ["React", "FastAPI", "SQLAlchemy", "Python"],
    image: "interrogatorio-720.webp",
    demo: "../interrogatorio/index.html#demo",
    live: "https://interrogatorio-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://interrogatorio-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    featured: true,
    goal: "Investigar misterios conectando testimonios y evidencias.",
    features:
      "Tres familias de casos, sospechosos, cronología, conexiones de evidencias, contradicciones, preguntas, notas, acusación y progreso persistente.",
    architecture:
      "React consume una API FastAPI; SQLAlchemy conserva el estado del caso y la demo del portal funciona en el navegador.",
    learning:
      "Separar la verdad del caso de la información pública y persistir el progreso.",
  },
  {
    id: "bodeganet",
    name: "BodegaNet",
    type: "Inventario",
    stack: ["C#", ".NET 10", "ASP.NET Core", "EF Core", "PostgreSQL"],
    image: "bodeganet-720.webp",
    demo: "../bodeganet/index.html",
    live: "https://bodeganet-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    health: "https://bodeganet-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    featured: true,
    goal: "Controlar el inventario de varias bodegas con un kardex valorizado.",
    features:
      "Productos, bodegas, entradas con costo, salidas, ajustes, transferencias, kardex con costo promedio ponderado, alertas de stock, exportación a CSV, roles y API REST con OpenAPI.",
    architecture:
      "ASP.NET Core con Razor Pages y minimal APIs; Entity Framework Core persiste en PostgreSQL (o SQLite en la demo) con migraciones y concurrencia optimista.",
    learning:
      "Que el stock nunca quede negativo con salidas simultáneas y que el costo promedio se recalcule bien en cada movimiento.",
  },
  {
    id: "cloudops",
    name: "CloudOps",
    type: "Observabilidad",
    stack: ["FastAPI", "Python", "SQLite"],
    live: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/cloudops",
    health: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    code: "labs",
    goal: "Inspeccionar respuestas y latencias reales de los servicios del portafolio.",
    features:
      "Comprobaciones controladas, historial persistente, incidentes, alertas y límites de frecuencia.",
    architecture:
      "FastAPI consulta destinos definidos en el servidor y registra observaciones e incidentes en SQLite.",
    learning:
      "Distinguir una observación puntual del uptime continuo y declarar datos no disponibles.",
  },
  {
    id: "datalab",
    name: "DataLab",
    type: "Datos",
    stack: ["FastAPI", "Python", "SQLite"],
    live: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/datalab",
    health: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    code: "labs",
    goal: "Limpiar archivos tabulares y explorar su calidad antes de usarlos.",
    features:
      "CSV/XLSX, validación, duplicados, incompletos, agregaciones, visualizaciones y exportación segura.",
    architecture:
      "Ingesta acotada en Python, almacenamiento SQLite y visualización web sin ejecutar contenido de usuario.",
    learning:
      "Procesamiento reproducible, límites de archivos y protección frente a fórmulas.",
  },
  {
    id: "docflow",
    name: "DocFlow",
    type: "Documentos",
    stack: ["FastAPI", "Python", "SQLite"],
    live: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/docflow",
    health: "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    code: "labs",
    goal: "Extraer y revisar facturas ficticias con trazabilidad.",
    features:
      "Extracción local de texto y PDF, OCR de imágenes, validación, duplicados, estados, revisión humana, auditoría y API de consulta.",
    architecture:
      "Reglas deterministas y SQLite separan extracción, validación y decisiones humanas.",
    learning:
      "Conservar datos ausentes y exigir revisión humana antes de aprobar.",
  },
];

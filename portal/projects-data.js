"use strict";

// Fuente única para el catálogo y la selección destacada de la portada.
window.PORTFOLIO_PROJECTS = [
  {
    id: "taskflow",
    name: "TaskFlow",
    type: "Gestión",
    category: "Gestión de trabajo",
    stack: ["React", "Express", "Prisma", "PostgreSQL"],
    image: "taskflow.png",
    alt: "Centro de control de TaskFlow con métricas y distribución de tarjetas",
    demo: "../taskflow/index.html#demo",
    homeDemo: "taskflow/index.html#demo",
    featured: true,
    goal: "Organizar entregas y supervisar el trabajo de un equipo.",
    note: "Crea una tarjeta, cámbiala de columna y observa el SLA, la actividad y la distribución del tablero.",
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
    category: "Agenda deportiva",
    stack: ["React", "FastAPI", "SQLAlchemy", "PostgreSQL"],
    image: "reservaya.png",
    homeImage: "reservaya-cancha.png",
    alt: "Cancha de ReservaYa junto a su selector de horarios",
    demo: "../reservaya/index.html#demo",
    homeDemo: "reservaya/index.html#demo",
    featured: true,
    goal: "Reservar canchas sin asignar dos veces un mismo horario.",
    note: "Selecciona una cancha, confirma una tarifa y libera el turno si cambian tus planes.",
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
    category: "Comercio electrónico",
    stack: ["Next.js", "React", "Prisma", "PostgreSQL"],
    image: "tiendanova.jpg",
    alt: "Catálogo de TiendaNova con productos de escritorio",
    demo: "../tiendanova/index.html#demo",
    homeDemo: "tiendanova/index.html#demo",
    featured: true,
    goal: "Simular una compra manteniendo pedidos e inventario consistentes.",
    note: "Agrega un producto, aplica un cupón simulado y revisa el pedido y el stock resultante.",
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
    category: "Juego interactivo",
    stack: ["React", "TypeScript", "Express", "Prisma"],
    image: "snake.svg",
    alt: "Tablero de Snake con la serpiente y el marcador",
    demo: "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    homeDemo:
      "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",
    action: "Jugar Snake",
    featured: true,
    goal: "Demostrar un motor de juego reproducible y un ranking verificable.",
    note: "Elige un modo, juega con teclado o controles táctiles y compara tu puntaje.",
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
    category: "Deducción interactiva",
    stack: ["React", "FastAPI", "SQLAlchemy", "Python"],
    image: "interrogatorio.png",
    alt: "Pruebas y sala de interrogatorio de un expediente",
    demo: "../interrogatorio/index.html#demo",
    homeDemo: "interrogatorio/index.html#demo",
    featured: true,
    goal: "Investigar misterios conectando testimonios y evidencias.",
    note: "Elige un expediente, revisa las pruebas e interroga a los sospechosos.",
    features:
      "Tres familias de casos, sospechosos, cronología, conexiones de evidencias, contradicciones, preguntas, notas, acusación y progreso persistente.",
    architecture:
      "React consume una API FastAPI; SQLAlchemy conserva el estado del caso y la demo del portal funciona en el navegador.",
    learning:
      "Separar la verdad del caso de la información pública y persistir el progreso.",
  },
  {
    id: "cloudops",
    name: "CloudOps",
    type: "Observabilidad",
    stack: ["FastAPI", "Python", "SQLite"],
    demo: "http://localhost:8001/cloudops",
    local: true,
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
    demo: "http://localhost:8001/datalab",
    local: true,
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
    demo: "http://localhost:8001/docflow",
    local: true,
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

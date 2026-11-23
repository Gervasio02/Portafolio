"use strict";
const projects = [
  {id:"taskflow",name:"TaskFlow",type:"Gestión",stack:["React","Express","Prisma","PostgreSQL"],image:"taskflow.png",demo:"../taskflow/index.html#demo",featured:true,goal:"Organizar entregas y supervisar el trabajo de un equipo.",features:"Tableros, tarjetas ordenables, prioridades, fechas y permisos por miembro.",architecture:"React consume una API Express; Prisma persiste en PostgreSQL. Las transacciones serializan las modificaciones del tablero.",learning:"Consistencia de posiciones y autorización por pertenencia al tablero."},
  {id:"reservaya",name:"ReservaYa",type:"Reservas",stack:["React","FastAPI","SQLAlchemy","PostgreSQL"],image:"reservaya.png",demo:"../reservaya/index.html#demo",featured:true,goal:"Reservar canchas sin asignar dos veces un mismo horario.",features:"Disponibilidad, reservas, cancelación, horarios semanales y bloqueos administrativos.",architecture:"React consulta FastAPI; SQLAlchemy y PostgreSQL protegen la ocupación con restricciones y bloqueos transaccionales.",learning:"Concurrencia entre reservas y mantenimiento; fechas en America/Santiago."},
  {id:"tiendanova",name:"TiendaNova",type:"Comercio",stack:["Next.js","React","Prisma","PostgreSQL"],image:"tiendanova.jpg",demo:"../tiendanova/index.html#demo",featured:true,goal:"Simular una compra manteniendo pedidos e inventario consistentes.",features:"Catálogo, carrito, direcciones, pago simulado, pedidos y administración de inventario.",architecture:"Next.js y Auth.js validan la sesión; Prisma ejecuta checkout transaccional con una clave de idempotencia.",learning:"Evitar compras repetidas y venta de unidades sin stock."},
  {id:"snake",name:"Snake",type:"Juegos",stack:["React","TypeScript","Express","Prisma"],image:"snake.svg",demo:"https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/",goal:"Demostrar un motor de juego reproducible y un ranking verificable.",features:"Tres modos, controles táctiles, pausa, récord local y ranking con reproducción verificada.",architecture:"Un motor TypeScript comparte las reglas entre navegador y verificación de partidas en Express.",learning:"Estados, bucle de animación y validación del resultado en el servidor."},
  {id:"interrogatorio",name:"Interrogatorio",type:"Juegos",stack:["React","FastAPI","SQLAlchemy","Python"],image:"interrogatorio.png",demo:"../interrogatorio/index.html#demo",goal:"Investigar un misterio conectando testimonios y evidencias.",features:"Sospechosos, pistas, preguntas, notas, acusación y puntuación. Prototipo determinista.",architecture:"El prototipo completo usa React, FastAPI y SQLAlchemy. La demo de esta portada es una experiencia independiente en el navegador.",learning:"Separar la verdad del caso de la información pública y persistir el progreso."}
  ,{id:"cloudops",name:"CloudOps",type:"Observabilidad",stack:["FastAPI","Python","SQLite"],demo:"http://localhost:8001/cloudops",local:true,code:"labs",goal:"Inspeccionar respuestas y latencias reales de los servicios del portafolio.",features:"Comprobaciones manuales, historial persistente y límite de frecuencia.",architecture:"FastAPI consulta destinos definidos en el servidor y registra resultados en SQLite.",learning:"Distinguir una observación puntual del uptime continuo. Sin fuente de despliegues ni alertas todavía."},
  {id:"datalab",name:"DataLab",type:"Datos",stack:["FastAPI","Python","SQLite"],demo:"http://localhost:8001/datalab",local:true,code:"labs",goal:"Limpiar archivos tabulares y explorar su calidad antes de usarlos.",features:"CSV/XLSX, duplicados, incompletos, agregaciones, distribuciones y exportación segura.",architecture:"Ingesta acotada en Python, almacenamiento SQLite y visualización web sin dependencias externas.",learning:"Procesamiento reproducible, límites de archivos y protección frente a fórmulas."},
  {id:"docflow",name:"DocFlow",type:"Documentos",stack:["FastAPI","Python","SQLite"],demo:"http://localhost:8001/docflow",local:true,code:"labs",goal:"Extraer y revisar facturas ficticias con trazabilidad.",features:"Extracción determinista, validación de RUT e importes, duplicados y decisiones humanas auditadas.",architecture:"Reglas locales y SQLite. Esta versión procesa texto etiquetado, sin OCR ni modelo de IA.",learning:"Conservar datos ausentes y exigir revisión humana antes de aprobar."}
];
const $ = id => document.getElementById(id);
const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function element(tag, text, className) { const node=document.createElement(tag); if(text)node.textContent=text; if(className)node.className=className; return node; }
for(const [id, values] of [["type",projects.map(p=>p.type)],["technology",projects.flatMap(p=>p.stack)]]) {
  for(const value of [...new Set(values)].sort()) {const option=element("option",value);option.value=value;$(id).append(option);}
}
function render() {
  const query=normalize($("search").value.trim());
  const filtered=projects.filter(p=>(!$("type").value||p.type===$("type").value)&&(!$("technology").value||p.stack.includes($("technology").value))&&normalize([p.name,p.goal,...p.stack].join(" ")).includes(query));
  $("projects").replaceChildren(); $("count").textContent=`${filtered.length} de ${projects.length} proyectos`;
  for(const p of filtered) {
    const card=element("article",null,"catalog-card");card.id=p.id;
    if(p.image){const image=element("img");image.src=`../capturas/${p.image}`;image.alt=`Vista de ${p.name}`;image.loading="lazy";card.append(image);}
    const body=element("div",null,"catalog-body");body.append(element("div",`${p.type}${p.featured?" · Destacado":""}`,"catalog-meta"),element("h2",p.name),element("p",p.goal),element("p",p.stack.join(" · "),"stack"));
    const actions=element("div",null,"catalog-actions");
    for(const [label,url] of [["Abrir demo",p.demo],["Código",`https://github.com/Gervasio02/Portafolio/tree/main/${p.code||p.id}`]]){const a=element("a",label);a.href=url;actions.append(a);}
    body.append(actions,element("p",p.local?"Demo local · iniciar servidor labs en el puerto 8001":p.id==="snake"?"Demo externa · disponibilidad sin comprobar":"Demo local del portal · datos ficticios"));
    const details=element("details");details.append(element("summary","Objetivo, arquitectura y aprendizajes"));
    for(const [title,text] of [["Funcionalidades",p.features],["Arquitectura",p.architecture],["Aprendizajes",p.learning]])details.append(element("h3",title),element("p",text));
    body.append(details);card.append(body);$("projects").append(card);
  }
  if(!filtered.length)$("projects").append(element("p","No hay resultados. Prueba otro filtro.","catalog-empty"));
}
for(const id of ["search","type","technology"])$(id).addEventListener("input",render);
render();

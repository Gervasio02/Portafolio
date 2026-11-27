"use strict";

// Panel privado de visitas. La clave se valida en el servidor (PANEL_CLAVE);
// aquí solo se guarda en la pestaña mientras dura la sesión.
const API =
  "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/panel/resumen";
const $ = (id) => document.getElementById(id);
const NOMBRES_ACCION = {
  app: "Abrió una app en vivo",
  codigo: "Fue al código en GitHub",
  demo: "Probó una demo rápida",
  cv: "Descargó el CV",
  correo: "Hizo clic en el correo",
  navegacion: "Navegó dentro del sitio",
  otro: "Otro",
};
const NOMBRES_DISPOSITIVO = { movil: "Móvil", tablet: "Tablet", escritorio: "Escritorio" };
let temporizador;

// Huellas de las preguntas que ya están en el entrenamiento del asistente:
// sirven para separar «Por enseñar» de «Ya aprendidas».
let huellas = null;
async function cargarHuellas() {
  if (huellas) return huellas;
  try {
    const modelo = await (await fetch("../asistente/modelo.json", { cache: "no-store" })).json();
    huellas = new Set(modelo.huellas || []);
  } catch {
    huellas = new Set();
  }
  return huellas;
}
const huella = (texto) =>
  window.RedAsistente ? window.RedAsistente.fnv1a(window.RedAsistente.normalizar(texto)).toString(16).padStart(8, "0") : "";
const aprendida = (texto) => Boolean(huellas && huellas.has(huella(texto)));

const duracionLegible = (segundos) => {
  if (!segundos) return "0 s";
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
};
const NOMBRES_PASO = { vista: "Abrió", clic: "Clic", salida: "Dejó" };

function recorridos(lista) {
  const caja = $("recorridos");
  caja.replaceChildren();
  if (!lista.length) {
    const p = document.createElement("p");
    p.className = "vacio";
    p.textContent = "Sin visitas en el período.";
    caja.append(p);
    return;
  }
  for (const r of lista) {
    const detalle = document.createElement("details");
    detalle.className = "recorrido";
    const resumen = document.createElement("summary");
    const titulo = document.createElement("strong");
    titulo.textContent = `${r.inicio} · ${r.lugar}`;
    const datos = document.createElement("span");
    const partes = [
      `${r.paginas} página${r.paginas === 1 ? "" : "s"}`,
      duracionLegible(r.duracion),
      r.clics ? `${r.clics} clic${r.clics === 1 ? "" : "s"}` : "",
      r.preguntas ? `${r.preguntas} pregunta${r.preguntas === 1 ? "" : "s"} al chat` : "",
      NOMBRES_DISPOSITIVO[r.dispositivo] || "",
      `desde ${r.referente}`,
    ].filter(Boolean);
    datos.textContent = partes.join(" · ");
    resumen.append(titulo, datos);
    if (r.red) {
      const red = document.createElement("small");
      red.textContent = `Red: ${r.red}`;
      resumen.append(red);
    }
    const pasos = document.createElement("ol");
    for (const paso of r.pasos) {
      const li = document.createElement("li");
      li.className = `paso-${paso.tipo}`;
      const hora = document.createElement("time");
      hora.textContent = paso.hora;
      const texto = document.createElement("span");
      if (paso.tipo === "vista") texto.textContent = `${NOMBRES_PASO.vista} ${paso.ruta}`;
      else if (paso.tipo === "clic") texto.textContent = `${NOMBRES_PASO.clic} en «${paso.detalle}» (en ${paso.ruta})`;
      else texto.textContent = `${NOMBRES_PASO.salida} ${paso.ruta} tras ${duracionLegible(paso.segundos)}, bajó ${paso.scroll ?? 0} %`;
      li.append(hora, texto);
      pasos.append(li);
    }
    detalle.append(resumen, pasos);
    caja.append(detalle);
  }
}

function guardarClave(clave) {
  try {
    if (clave) sessionStorage.setItem("panel-clave", clave);
    else sessionStorage.removeItem("panel-clave");
  } catch {
    /* sin almacenamiento: habrá que escribir la clave al recargar */
  }
}

function leerClave() {
  try {
    return sessionStorage.getItem("panel-clave") || "";
  } catch {
    return "";
  }
}

async function pedir(clave) {
  const dias = $("dias").value;
  const respuesta = await fetch(`${API}?dias=${dias}`, {
    headers: { Authorization: `Bearer ${clave}` },
    cache: "no-store",
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw Object.assign(new Error(datos.detail || "No se pudo cargar"), { status: respuesta.status });
  return datos;
}

const numero = (n) => new Intl.NumberFormat("es-CL").format(n);

function lista(id, pares, nombres = {}) {
  const ul = $(id);
  ul.replaceChildren();
  const maximo = Math.max(1, ...pares.map(([, n]) => n));
  if (!pares.length) {
    const li = document.createElement("li");
    li.className = "vacio";
    li.textContent = "Sin datos todavía";
    ul.append(li);
    return;
  }
  for (const [nombre, cantidad] of pares) {
    const li = document.createElement("li");
    const texto = document.createElement("span");
    texto.textContent = nombres[nombre] || nombre;
    const valor = document.createElement("b");
    valor.textContent = numero(cantidad);
    const barra = document.createElement("i");
    barra.style.width = `${(cantidad / maximo) * 100}%`;
    li.append(texto, valor, barra);
    ul.append(li);
  }
}

function filas(id, registros, columnas) {
  const tbody = $(id);
  tbody.replaceChildren();
  if (!registros.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columnas.length;
    td.className = "vacio";
    td.textContent = "Sin datos todavía";
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const registro of registros) {
    const tr = document.createElement("tr");
    for (const columna of columnas) {
      const td = document.createElement("td");
      td.textContent = columna(registro);
      tr.append(td);
    }
    tbody.append(tr);
  }
}

function grafico(porDia) {
  const contenedor = $("grafico");
  contenedor.replaceChildren();
  const maximo = Math.max(1, ...porDia.map((d) => d.vistas));
  for (const dia of porDia) {
    const columna = document.createElement("div");
    columna.className = "columna";
    const fecha = new Date(`${dia.dia}T12:00:00`);
    columna.title = `${fecha.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}: ${dia.vistas} visitas, ${dia.sesiones} personas`;
    const barra = document.createElement("i");
    barra.style.height = `${(dia.vistas / maximo) * 100}%`;
    const etiqueta = document.createElement("span");
    etiqueta.textContent = fecha.getDate();
    columna.append(barra, etiqueta);
    contenedor.append(columna);
  }
}

function pintar(datos) {
  const t = datos.totales;
  $("t-activos").textContent = numero(t.activos_5min);
  $("t-hoy").textContent = numero(t.vistas_hoy);
  $("t-hoy-ses").textContent = `${numero(t.sesiones_hoy)} personas`;
  $("t-7d").textContent = numero(t.vistas_7d);
  $("t-7d-ses").textContent = `${numero(t.sesiones_7d)} personas`;
  $("t-periodo").textContent = numero(t.vistas_periodo);
  $("t-periodo-ses").textContent = `${numero(t.sesiones_periodo)} personas`;
  $("t-clics").textContent = numero(t.clics_periodo);
  grafico(datos.por_dia);
  filas("proyectos", datos.proyectos, [
    (p) => p.proyecto,
    (p) => p.app || 0,
    (p) => p.codigo || 0,
    (p) => p.demo || 0,
    (p) => p.total,
  ]);
  lista("acciones", datos.acciones, NOMBRES_ACCION);
  lista("paginas", datos.paginas);
  lista("enlaces", datos.enlaces);
  lista("referentes", datos.referentes);
  lista("dispositivos", datos.dispositivos, NOMBRES_DISPOSITIVO);
  lista("idiomas", datos.idiomas);
  filas("recientes", datos.recientes, [
    (e) => e.hora,
    (e) => ({ vista: "Visita", clic: "Clic", salida: "Salida" })[e.tipo] || e.tipo,
    (e) => e.ruta,
    (e) => e.detalle,
    (e) => NOMBRES_DISPOSITIVO[e.dispositivo] || "–",
  ]);
  const c = datos.comportamiento || { duracion_media: 0, rebote: 0, paginas_por_sesion: 0, entradas: [], salidas: [], paginas: [] };
  $("t-duracion").textContent = duracionLegible(c.duracion_media);
  $("t-paginas-sesion").textContent = `${String(c.paginas_por_sesion).replace(".", ",")} páginas por visita`;
  $("t-rebote").textContent = `${c.rebote} %`;
  lista("entradas", c.entradas);
  lista("salidas", c.salidas);
  filas("atencion", c.paginas, [
    (p) => p.ruta,
    (p) => p.vistas,
    (p) => duracionLegible(p.segundos),
    (p) => `${p.scroll} %`,
  ]);
  const u = datos.ubicacion || { paises: [], lugares: [], redes: [] };
  lista("paises", u.paises);
  lista("lugares", u.lugares);
  lista("redes", u.redes);
  recorridos(datos.sesiones || []);

  const asistente = datos.asistente || { total: 0, sin_respuesta: 0, no_sirvio: 0, frecuentes: [], recientes: [] };
  const pendientes = asistente.recientes.filter((p) => !aprendida(p.pregunta));
  const listas = asistente.recientes.filter((p) => aprendida(p.pregunta));
  $("asistente-resumen").textContent =
    `${numero(pendientes.length)} preguntas por enseñar y ${numero(listas.length)} ya aprendidas ` +
    `(de las últimas ${numero(asistente.recientes.length)}; ${numero(asistente.no_sirvio)} marcadas como «no me sirvió»).`;
  lista("asistente-frecuentes", asistente.frecuentes.filter(([texto]) => !aprendida(texto)));
  $("aprendidas-total").textContent = `(${listas.length})`;
  filas("asistente-aprendidas", listas, [
    (p) => p.hora,
    (p) => p.pregunta,
    (p) => (p.motivo === "no_sirvio" ? "No le sirvió" : "Sin respuesta"),
  ]);
  filas("asistente-recientes", pendientes, [
    (p) => p.hora,
    (p) => p.pregunta,
    (p) => (p.intencion || "–").replaceAll("_", " "),
    (p) => (p.confianza == null ? "–" : `${Math.round(p.confianza * 100)} %`),
    (p) => (p.motivo === "no_sirvio" ? "No le sirvió" : "Sin respuesta"),
  ]);
  const hora = new Date(datos.generado).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  $("actualizado").textContent = `Actualizado a las ${hora} · se refresca cada 30 segundos`;
}

async function cargar() {
  const clave = leerClave();
  if (!clave) return mostrarAcceso();
  try {
    await cargarHuellas();
    pintar(await pedir(clave));
  } catch (error) {
    if (error.status === 401 || error.status === 429) {
      guardarClave("");
      mostrarAcceso(error.message);
    } else {
      $("actualizado").textContent = `No se pudo actualizar: ${error.message}. Se reintentará.`;
    }
  }
}

function mostrarPanel() {
  $("acceso").hidden = true;
  $("panel").hidden = false;
  clearInterval(temporizador);
  temporizador = setInterval(() => {
    if (!document.hidden) cargar();
  }, 30_000);
}

function mostrarAcceso(mensaje = "") {
  clearInterval(temporizador);
  $("panel").hidden = true;
  $("acceso").hidden = false;
  $("mensaje-acceso").textContent = mensaje;
  $("clave").focus();
}

$("formulario").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const clave = $("clave").value;
  const boton = evento.submitter;
  boton.disabled = true;
  $("mensaje-acceso").textContent = "Comprobando… (si el servidor estaba apagado puede tardar unos segundos)";
  try {
    const [datos] = await Promise.all([pedir(clave), cargarHuellas()]);
    guardarClave(clave);
    try {
      if ($("no-contar").checked) localStorage.setItem("panel-no-contar", "1");
      else localStorage.removeItem("panel-no-contar");
    } catch {
      /* sin almacenamiento local */
    }
    $("clave").value = "";
    mostrarPanel();
    pintar(datos);
  } catch (error) {
    $("mensaje-acceso").textContent =
      error.status === 401 ? "Clave incorrecta." : error.message || "No se pudo conectar.";
  } finally {
    boton.disabled = false;
  }
});

$("refrescar").addEventListener("click", cargar);
$("dias").addEventListener("change", cargar);
$("salir").addEventListener("click", () => {
  guardarClave("");
  mostrarAcceso();
});

if (leerClave()) {
  mostrarPanel();
  cargar();
} else {
  mostrarAcceso();
}

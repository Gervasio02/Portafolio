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
    (e) => (e.tipo === "vista" ? "Visita" : "Clic"),
    (e) => e.ruta,
    (e) => e.detalle,
    (e) => NOMBRES_DISPOSITIVO[e.dispositivo] || "–",
  ]);
  const asistente = datos.asistente || { total: 0, sin_respuesta: 0, no_sirvio: 0, frecuentes: [], recientes: [] };
  $("asistente-resumen").textContent =
    `${numero(asistente.total)} preguntas por revisar en el período: ` +
    `${numero(asistente.sin_respuesta)} sin respuesta y ${numero(asistente.no_sirvio)} marcadas como «no me sirvió».`;
  lista("asistente-frecuentes", asistente.frecuentes);
  filas("asistente-recientes", asistente.recientes, [
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
    const datos = await pedir(clave);
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

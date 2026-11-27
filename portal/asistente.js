"use strict";

// «Pregúntale a mi portafolio»: chat con una red neuronal propia que corre
// en el navegador. La red (asistente/red.js) y sus pesos
// (asistente/modelo.json) se cargan recién cuando alguien abre el chat.
//
// Las preguntas que la red no supo responder, y las respuestas marcadas
// como «no me sirvió», se envían de forma anónima a Labs para que Gervasio
// las revise en su panel y le enseñe a la red (asistente/conocimiento.yml).

(() => {
  const script = document.currentScript;
  const base = new URL(".", script ? script.src : location.href);
  const LABS = "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io";
  const API_APRENDER = `${LABS}/api/asistente/preguntas`;
  const API_IA = `${LABS}/api/asistente/ia`;
  const enProduccion = /(^|\.)gervasio\.sbs$/.test(location.hostname);
  const INICIO = ["presentacion", "proyectos", "stack", "contacto"];

  let red = null;
  let cargando = null;
  let abierto = false;
  // Registro de la conversación: empieza formal (pensado para reclutadores)
  // y pasa a coloquial si el visitante escribe con chilenismos o abreviaturas.
  let registro = "formal";
  const informal = () => registro === "informal";
  const T = {
    bienvenida: {
      formal: "Bienvenido o bienvenida. Soy el asistente del portafolio de Gervasio Torres, una red neuronal que él programó. ¿En qué le puedo ayudar? Puede consultarme por su experiencia, proyectos, tecnologías o disponibilidad.",
      informal: "¡Wena! Soy el asistente del portafolio de Gervasio. Pregúntame lo que quieras.",
    },
    noSe: {
      formal:
        "No estoy seguro de haber entendido y prefiero no darle una respuesta inexacta. Registré su pregunta para que Gervasio me enseñe. " +
        "Mientras tanto, puede [buscarlo en la web](https://www.google.com/search?q={pregunta}) o escribirle a " +
        "[Gervasiot19@gmail.com](mailto:Gervasiot19@gmail.com).",
      informal:
        "Uf, no te caché bien y no te quiero inventar nada. Guardé tu pregunta para que Gervasio me enseñe. " +
        "Mientras, puedes [buscarlo en la web](https://www.google.com/search?q={pregunta}) o escribirle a " +
        "[Gervasiot19@gmail.com](mailto:Gervasiot19@gmail.com).",
    },
    sinRed: {
      formal: "No pude cargar mi red en este momento. Puede escribirle a Gervasio: [Gervasiot19@gmail.com](mailto:Gervasiot19@gmail.com).",
      informal: "No pude cargar mi red ahora. Escríbele a Gervasio: [Gervasiot19@gmail.com](mailto:Gervasiot19@gmail.com).",
    },
    quisiste: { formal: "¿Quiso consultar…?", informal: "¿Quisiste preguntar…?" },
    temas: { formal: "Puedo ayudarle con:", informal: "Te puedo ayudar con:" },
    util: { formal: "¿Le fue útil?", informal: "¿Te sirvió?" },
    graciasSi: { formal: "Muchas gracias.", informal: "¡Bacán, gracias!" },
    graciasNo: { formal: "Gracias, se lo comunicaré a Gervasio para mejorar.", informal: "Gracias, se lo cuento a Gervasio para mejorar." },
    consultando: { formal: "Consultando…", informal: "Dame un segundo…" },
    notaIA: { formal: "respuesta generada con IA · puede contener errores", informal: "respuesta generada con IA · puede equivocarse" },
  };
  const texto = (clave) => T[clave][registro];

  /* ---------- interfaz ---------- */
  const raiz = document.createElement("div");
  raiz.className = "asis";
  raiz.id = "preguntame";
  raiz.innerHTML = `
    <button class="asis-abrir" type="button" aria-expanded="false" aria-controls="asis-panel">
      <span class="asis-punto" aria-hidden="true"></span>
      <span>Pregúntame</span>
    </button>
    <section class="asis-panel" id="asis-panel" role="dialog" aria-labelledby="asis-titulo" hidden>
      <header class="asis-cabecera">
        <div>
          <h2 id="asis-titulo">Pregúntale a mi portafolio</h2>
          <p>Red neuronal propia · corre en tu navegador</p>
        </div>
        <button class="asis-cerrar" type="button" aria-label="Cerrar el chat">×</button>
      </header>
      <div class="asis-mensajes" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="asis-formulario" autocomplete="off">
        <label class="asis-oculto" for="asis-entrada">Escribe tu pregunta</label>
        <input id="asis-entrada" name="pregunta" type="text" maxlength="200"
          placeholder="Ej.: ¿Qué tecnologías domina?" required />
        <button type="submit">Enviar</button>
      </form>
      <p class="asis-pie">
        Si no sé responder, uso un modelo de IA externo (Groq) y guardo la
        pregunta sin datos personales para aprenderla. <a href="${new URL("asistente/", base).pathname}">Cómo funciono</a>
      </p>
    </section>`;
  document.body.append(raiz);

  const boton = raiz.querySelector(".asis-abrir");
  const panel = raiz.querySelector(".asis-panel");
  const mensajes = raiz.querySelector(".asis-mensajes");
  const formulario = raiz.querySelector(".asis-formulario");
  const entrada = raiz.querySelector("#asis-entrada");

  /* ---------- carga perezosa de la red ---------- */
  function cargarScript(url) {
    return new Promise((resolver, rechazar) => {
      if (window.RedAsistente) return resolver();
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolver;
      s.onerror = () => rechazar(new Error("No se pudo cargar la red"));
      document.head.append(s);
    });
  }

  function cargarRed() {
    cargando ??= (async () => {
      const [, respuesta] = await Promise.all([
        cargarScript(new URL("asistente/red.js", base)),
        fetch(new URL("asistente/modelo.json", base)),
      ]);
      if (!respuesta.ok) throw new Error("No se pudo cargar el modelo");
      red = window.RedAsistente.crear(await respuesta.json());
      return red;
    })();
    return cargando;
  }

  /* ---------- datos en vivo dentro de las respuestas ---------- */
  // {hora} y {fecha} se calculan en el navegador (hora de Chile);
  // {pregunta} se reemplaza por la pregunta, codificada para un enlace.
  function completar(plantilla, pregunta) {
    const ahora = new Date();
    const zona = { timeZone: "America/Santiago" };
    return plantilla
      .replaceAll("{hora}", ahora.toLocaleTimeString("es-CL", { ...zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }))
      .replaceAll("{fecha}", ahora.toLocaleDateString("es-CL", { ...zona, weekday: "long", day: "numeric", month: "long", year: "numeric" }))
      .replaceAll("{pregunta}", encodeURIComponent(pregunta.slice(0, 150)));
  }

  /* ---------- mensajes ---------- */
  // Convierte [texto](ruta) en enlaces sin usar innerHTML con datos.
  // «soloWeb»: para texto de la IA, solo se aceptan enlaces https/mailto.
  function conEnlaces(texto, soloWeb = false) {
    const fragmento = document.createDocumentFragment();
    const patron = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let ultimo = 0;
    for (const m of texto.matchAll(patron)) {
      fragmento.append(texto.slice(ultimo, m.index));
      if (soloWeb && !/^(https:|mailto:)/.test(m[2])) {
        fragmento.append(m[1]);
        ultimo = m.index + m[0].length;
        continue;
      }
      const enlace = document.createElement("a");
      const destino = /^(https?:|mailto:)/.test(m[2]) ? m[2] : new URL(m[2], base).href;
      enlace.href = destino;
      enlace.textContent = m[1];
      if (/^https?:/.test(m[2])) {
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer";
      }
      fragmento.append(enlace);
      ultimo = m.index + m[0].length;
    }
    fragmento.append(texto.slice(ultimo));
    return fragmento;
  }

  function burbuja(clase, contenido) {
    const div = document.createElement("div");
    div.className = `asis-msg asis-${clase}`;
    if (typeof contenido === "string") div.append(contenido);
    else div.append(contenido);
    mensajes.append(div);
    mensajes.scrollTop = mensajes.scrollHeight;
    return div;
  }

  function sugerencias(ids, titulo) {
    if (!red || !ids.length) return;
    const caja = document.createElement("div");
    caja.className = "asis-sugerencias";
    if (titulo) {
      const t = document.createElement("span");
      t.textContent = titulo;
      caja.append(t);
    }
    for (const id of ids) {
      const intencion = red.intenciones.find((i) => i.id === id);
      if (!intencion) continue;
      const chip = document.createElement("button");
      chip.type = "button";
      const base = informal() ? intencion.pregunta_informal || intencion.pregunta : intencion.pregunta;
      chip.textContent = base.replace(/^\s*¿?/, "¿").replace(/\??\s*$/, "?");
      chip.addEventListener("click", () => preguntar(chip.textContent));
      caja.append(chip);
    }
    mensajes.append(caja);
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  function confianza(probabilidad) {
    const caja = document.createElement("div");
    caja.className = "asis-confianza";
    const barra = document.createElement("i");
    barra.style.width = `${Math.round(probabilidad * 100)}%`;
    const texto = document.createElement("span");
    texto.textContent = `seguridad ${Math.round(probabilidad * 100)} %`;
    caja.append(barra, texto);
    return caja;
  }

  /* ---------- aprendizaje (opt-out con «No rastrear») ---------- */
  function aprender(pregunta, prediccion, motivo) {
    if (!enProduccion || navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
    const cuerpo = JSON.stringify({
      pregunta: pregunta.slice(0, 200),
      intencion: prediccion.intencion.id,
      confianza: Math.round(prediccion.probabilidad * 1000) / 1000,
      motivo,
      ruta: location.pathname,
    });
    fetch(API_APRENDER, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: cuerpo,
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  }

  function valoracion(pregunta, prediccion) {
    const caja = document.createElement("div");
    caja.className = "asis-valorar";
    const etiqueta = document.createElement("span");
    etiqueta.textContent = texto("util");
    const si = document.createElement("button");
    si.type = "button";
    si.textContent = "Sí";
    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "No";
    const responder = (util) => {
      caja.replaceChildren(util ? texto("graciasSi") : texto("graciasNo"));
      if (!util) aprender(pregunta, prediccion, "no_sirvio");
    };
    si.addEventListener("click", () => responder(true));
    no.addEventListener("click", () => responder(false));
    caja.append(etiqueta, si, no);
    return caja;
  }

  /* ---------- respaldo con IA (Labs → Groq) ---------- */
  async function consultarIA(pregunta) {
    if (!enProduccion) return null;
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), 25000);
    try {
      const respuesta = await fetch(API_IA, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ pregunta: pregunta.slice(0, 200), registro }),
        signal: control.signal,
      });
      if (!respuesta.ok) return null;
      const datos = await respuesta.json();
      return typeof datos.respuesta === "string" && datos.respuesta.trim() ? datos.respuesta.trim() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(plazo);
    }
  }

  function respuestaIA(generado) {
    const msg = burbuja("bot", conEnlaces(generado, true));
    const nota = document.createElement("div");
    nota.className = "asis-confianza";
    const etiqueta = document.createElement("span");
    etiqueta.textContent = texto("notaIA");
    nota.append(document.createElement("i"), etiqueta);
    msg.append(nota);
    return msg;
  }

  /* ---------- conversación ---------- */
  async function preguntar(escrito) {
    const pregunta = escrito.trim();
    if (!pregunta) return;
    burbuja("usuario", pregunta);
    const escribiendo = burbuja("bot asis-escribiendo", "…");
    try {
      await cargarRed();
    } catch {
      escribiendo.remove();
      burbuja("bot", conEnlaces(texto("sinRed")));
      return;
    }
    if (red.esInformal(pregunta)) registro = "informal";
    const { vacio, resultado } = red.predecir(pregunta);
    const [mejor, segunda] = resultado;
    await new Promise((r) => setTimeout(r, 250));
    escribiendo.remove();

    const sinRespuesta = vacio || mejor.probabilidad < red.umbral;
    if (sinRespuesta || mejor.intencion.id === "fuera_de_tema") {
      aprender(pregunta, mejor, "sin_respuesta");
      const pensando = burbuja("bot asis-escribiendo", texto("consultando"));
      const respuestaGenerada = await consultarIA(pregunta);
      pensando.remove();
      if (respuestaGenerada) {
        const msg = respuestaIA(respuestaGenerada);
        msg.append(valoracion(pregunta, mejor));
        sugerencias(["ayuda", "proyectos"]);
        return;
      }
    }

    if (sinRespuesta) {
      const msg = burbuja(
        "bot",
        conEnlaces(
          completar(texto("noSe"), pregunta)
        )
      );
      msg.append(confianza(mejor.probabilidad));
      // Si la red tiene alguna pista, ofrece sus dos mejores candidatas;
      // si no, los temas generales.
      const opciones = [mejor, segunda]
        .filter((p) => p.probabilidad >= 0.2 && p.intencion.id !== "fuera_de_tema")
        .map((p) => p.intencion.id);
      if (opciones.length) sugerencias(opciones, texto("quisiste"));
      else sugerencias(INICIO, texto("temas"));
      return;
    }

    const elegida = (informal() && mejor.intencion.respuesta_informal) || mejor.intencion.respuesta;
    const msg = burbuja("bot", conEnlaces(completar(elegida, pregunta)));
    msg.append(confianza(mejor.probabilidad));
    const charla = ["saludo", "despedida", "gracias", "acuse", "como_estas", "hora", "fuera_de_tema"];
    if (!charla.includes(mejor.intencion.id)) {
      msg.append(valoracion(pregunta, mejor));
    }
    sugerencias(mejor.intencion.sugerencias.slice(0, 3));
  }

  /* ---------- abrir y cerrar ---------- */
  async function abrir() {
    abierto = true;
    panel.hidden = false;
    boton.setAttribute("aria-expanded", "true");
    raiz.classList.add("asis-activo");
    entrada.focus();
    if (!mensajes.childElementCount) {
      burbuja("bot", texto("bienvenida"));
      try {
        await cargarRed();
        sugerencias(INICIO);
      } catch {
        /* se informa al preguntar */
      }
    }
  }

  function cerrar() {
    abierto = false;
    panel.hidden = true;
    boton.setAttribute("aria-expanded", "false");
    raiz.classList.remove("asis-activo");
    boton.focus();
  }

  boton.addEventListener("click", () => (abierto ? cerrar() : abrir()));
  raiz.querySelector(".asis-cerrar").addEventListener("click", cerrar);
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrar();
  });
  formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    const escrito = entrada.value;
    entrada.value = "";
    preguntar(escrito);
  });

  // Permite abrir el chat con un enlace a #preguntame.
  if (location.hash === "#preguntame") abrir();
  window.addEventListener("hashchange", () => {
    if (location.hash === "#preguntame" && !abierto) abrir();
  });
})();

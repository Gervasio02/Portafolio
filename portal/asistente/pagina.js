"use strict";

// Página «Cómo funciono»: muestra las métricas del modelo y un probador que
// enseña las probabilidades de la red mientras se escribe.

(async () => {
  const $ = (id) => document.getElementById(id);
  let modelo;
  try {
    const respuesta = await fetch("modelo.json");
    modelo = await respuesta.json();
  } catch {
    $("metricas").textContent = "No se pudo cargar el modelo.";
    return;
  }
  const red = window.RedAsistente.crear(modelo);
  const m = modelo.metricas;
  const valores = {
    ...modelo.arquitectura,
    ...m,
    exactitud_validacion: `${(m.exactitud_validacion * 100).toFixed(1).replace(".", ",")} %`,
    ejemplos_aumentados: new Intl.NumberFormat("es-CL").format(m.ejemplos_aumentados),
  };
  document.querySelectorAll("[data-metrica]").forEach((el) => {
    const valor = valores[el.dataset.metrica];
    if (valor !== undefined) el.textContent = valor;
  });
  $("creado").textContent = new Date(modelo.creado).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  $("creado").dateTime = modelo.creado;

  // Curva de pérdida en SVG, dibujada con el DOM.
  const svgNS = "http://www.w3.org/2000/svg";
  const puntos = m.curva_perdida;
  const ancho = 600;
  const alto = 160;
  // Escala logarítmica: la pérdida cae rápido al principio y así se ve
  // también cómo sigue afinándose en las épocas finales.
  const logs = puntos.map((p) => Math.log(p));
  const max = Math.max(...logs);
  const min = Math.min(...logs);
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("preserveAspectRatio", "none");
  const coords = logs.map((p, i) => `${(i / (logs.length - 1)) * ancho},${alto - 6 - ((p - min) / (max - min || 1)) * (alto - 12)}`);
  const area = document.createElementNS(svgNS, "polygon");
  area.setAttribute("points", `0,${alto} ${coords.join(" ")} ${ancho},${alto}`);
  area.setAttribute("class", "area");
  const linea = document.createElementNS(svgNS, "polyline");
  linea.setAttribute("points", coords.join(" "));
  linea.setAttribute("class", "linea");
  svg.append(area, linea);
  $("curva").append(svg);

  // Probador en vivo.
  const entrada = $("prueba");
  const lista = $("top");
  const rasgos = $("rasgos");
  const pintar = () => {
    const texto = entrada.value;
    lista.replaceChildren();
    if (!texto.trim()) {
      rasgos.textContent = "";
      return;
    }
    const n = window.RedAsistente.rasgos(texto).length;
    const normal = window.RedAsistente.normalizar(texto);
    rasgos.textContent = `«${normal}» → ${n} rasgos activos`;
    const { resultado } = red.predecir(texto);
    resultado.slice(0, 5).forEach(({ intencion, probabilidad }, i) => {
      const li = document.createElement("li");
      if (i === 0) li.className = probabilidad >= red.umbral ? "gana" : "duda";
      const nombre = document.createElement("span");
      nombre.textContent = intencion.id.replaceAll("_", " ");
      const valor = document.createElement("b");
      valor.textContent = `${(probabilidad * 100).toFixed(1).replace(".", ",")} %`;
      const barra = document.createElement("i");
      barra.style.width = `${probabilidad * 100}%`;
      li.append(nombre, valor, barra);
      lista.append(li);
    });
    const aviso = document.createElement("li");
    aviso.className = "nota";
    aviso.textContent =
      resultado[0].probabilidad >= red.umbral
        ? `Respondería con la intención «${resultado[0].intencion.id.replaceAll("_", " ")}».`
        : `Bajo el umbral de ${Math.round(red.umbral * 100)} %: diría que no sabe y guardaría la pregunta.`;
    lista.append(aviso);
  };
  entrada.addEventListener("input", pintar);
  entrada.value = "¿sabes trabajar con bases de datos?";
  pintar();
})();

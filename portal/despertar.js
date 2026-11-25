"use strict";

// Precalentamiento de las apps en Azure Container Apps.
// Las apps se apagan sin tráfico (escala a cero) para no generar costos.
// Al abrir una página del portafolio se envía una petición liviana a la ruta
// de salud de cada app enlazada, de modo que el servidor ya esté despierto
// cuando el visitante haga clic. Cada elemento con [data-salud] muestra el
// estado en un indicador [data-estado] dentro de él.

(() => {

  const TIEMPO_MAXIMO = 60_000; // un arranque en frío tarda ~30 s
  const textos = {
    despertando: "Despertando servidor…",
    lista: "En línea",
    error: "Sin respuesta, reintenta en un momento",
  };

  const pintar = (elemento, estado) => {
    const indicador = elemento.querySelector("[data-estado]");
    if (!indicador) return;
    indicador.dataset.estado = estado;
    indicador.textContent = textos[estado];
  };

  // Un solo ping por URL aunque aparezca varias veces en la página.
  const pings = new Map();
  const despertar = (url) => {
    if (!pings.has(url)) {
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO);
      pings.set(
        url,
        fetch(url, { mode: "no-cors", cache: "no-store", signal: control.signal })
          .then(() => "lista")
          .catch(() => "error")
          .finally(() => clearTimeout(temporizador)),
      );
    }
    return pings.get(url);
  };

  // Se expone para que el catálogo pueda volver a pintar tras filtrar.
  window.despertarApps = (raiz = document) => {
    for (const elemento of raiz.querySelectorAll("[data-salud]")) {
      pintar(elemento, "despertando");
      despertar(elemento.dataset.salud).then((estado) => pintar(elemento, estado));
    }
  };
  window.despertarApps();
})();

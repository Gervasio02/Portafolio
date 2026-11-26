"use strict";

// Conteo anónimo de visitas para el panel privado (panel/).
// Sin cookies ni datos personales: solo una sesión aleatoria por pestaña,
// la página, el enlace pulsado, el sitio de procedencia, el tipo de
// dispositivo y el idioma. Respeta "No rastrear" y no cuenta las visitas
// del propio dueño (se marca al entrar al panel).

(() => {
  const API =
    "https://labs-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/visitas";

  let noContar = false;
  try {
    noContar = localStorage.getItem("panel-no-contar") === "1";
  } catch {
    /* almacenamiento bloqueado: se cuenta normalmente */
  }
  const enProduccion = /(^|\.)gervasio\.sbs$/.test(location.hostname);
  const sinRastreo = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  if (!enProduccion || sinRastreo || noContar) return;

  let sesion = "";
  try {
    sesion = sessionStorage.getItem("visita-sesion") || "";
    if (!sesion) {
      sesion = crypto.randomUUID();
      sessionStorage.setItem("visita-sesion", sesion);
    }
  } catch {
    sesion = crypto.randomUUID();
  }

  const ancho = window.innerWidth;
  const comun = {
    sesion,
    ruta: location.pathname,
    dispositivo: ancho < 600 ? "movil" : ancho < 1024 ? "tablet" : "escritorio",
    idioma: navigator.language || "",
  };

  const enviar = (datos) => {
    const cuerpo = JSON.stringify({ ...comun, ...datos });
    const blob = new Blob([cuerpo], { type: "text/plain" });
    if (!(navigator.sendBeacon && navigator.sendBeacon(API, blob))) {
      fetch(API, { method: "POST", body: cuerpo, mode: "cors", keepalive: true }).catch(() => {});
    }
  };

  enviar({ tipo: "vista", referente: document.referrer || "" });

  document.addEventListener(
    "click",
    (evento) => {
      const enlace = evento.target.closest("a[href]");
      if (!enlace || enlace.dataset.noContar !== undefined) return;
      const estado = enlace.querySelector(".estado");
      const texto = (enlace.textContent || "").replace(estado?.textContent || "", "");
      const etiqueta = (enlace.getAttribute("aria-label") || texto)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      enviar({ tipo: "clic", destino: enlace.href, etiqueta });
    },
    { capture: true },
  );
})();

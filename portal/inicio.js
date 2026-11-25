"use strict";

// Muestra la hora actual de Santiago en la ficha "En este momento".
const reloj = document.getElementById("hora-local");

if (reloj) {
  const formato = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const actualizar = () => {
    const ahora = new Date();
    reloj.textContent = formato.format(ahora) + " h";
    reloj.dateTime = ahora.toISOString();
  };

  actualizar();
  setInterval(actualizar, 30_000);
}

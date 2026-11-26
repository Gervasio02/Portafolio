"use strict";

const producto = document.querySelector("#Datos_ProductoId");
const bodega = document.querySelector("#Datos_BodegaId, #Datos_OrigenId");
const estado = document.querySelector("#disponibilidad");
const numero = new Intl.NumberFormat("es-CL");
let consulta;

async function consultarDisponibilidad() {
    consulta?.abort();
    if (!producto.value || !bodega.value) {
        estado.textContent = "Elige el producto y la bodega para ver cuántas unidades hay.";
        return;
    }

    const solicitud = new AbortController();
    consulta = solicitud;
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("handler", "Disponibilidad");
    url.searchParams.set("productoId", producto.value);
    url.searchParams.set("bodegaId", bodega.value);
    estado.textContent = "Consultando unidades disponibles…";

    try {
        const respuesta = await fetch(url, { signal: solicitud.signal, headers: { Accept: "application/json" } });
        if (!respuesta.ok) throw new Error("Consulta no disponible");
        const { cantidad, unidad } = await respuesta.json();
        if (!solicitud.signal.aborted) {
            estado.textContent = `Disponible en la bodega seleccionada: ${numero.format(cantidad)} (${unidad}).`;
        }
    } catch {
        if (!solicitud.signal.aborted) {
            estado.textContent = "No se pudo consultar la cantidad. Puedes comprobarla en Bodegas.";
        }
    }
}

producto.addEventListener("change", consultarDisponibilidad);
bodega.addEventListener("change", consultarDisponibilidad);
consultarDisponibilidad();

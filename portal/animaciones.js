"use strict";

// Animaciones de la portada, sin librerías:
// 1. Una línea de consola que escribe y borra las tecnologías que uso.
// 2. Las secciones aparecen al hacer scroll (IntersectionObserver) y las
//    cifras cuentan desde cero hasta su valor.
// Si la persona pidió menos movimiento, no se anima nada y todo queda visible.

const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Texto que se escribe solo ---------- */
function escribir(elemento) {
  const frases = (elemento.dataset.frases || "").split("|").filter(Boolean);
  if (frases.length < 2) return;
  let indice = 0;
  let letras = frases[0].length;
  let borrando = true;

  const paso = () => {
    const frase = frases[indice];
    elemento.textContent = frase.slice(0, letras);
    let espera = borrando ? 35 : 70;

    if (!borrando && letras === frase.length) {
      borrando = true;
      espera = 1800; // pausa con la frase completa
    } else if (borrando && letras === 0) {
      borrando = false;
      indice = (indice + 1) % frases.length;
      espera = 350;
    } else {
      letras += borrando ? -1 : 1;
    }
    setTimeout(paso, espera);
  };

  setTimeout(paso, 2200);
}

/* ---------- 2. Cifras que cuentan ---------- */
function contar(elemento) {
  const original = elemento.textContent.trim();
  const coincidencia = original.match(/^(\d+)(?:,(\d+))?(.*)$/);
  if (!coincidencia) return;
  const decimales = coincidencia[2] ? coincidencia[2].length : 0;
  const destino = Number(`${coincidencia[1]}.${coincidencia[2] || 0}`);
  const sufijo = coincidencia[3];
  const formato = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  const duracion = 1400;
  let inicio;

  const cuadro = (tiempo) => {
    inicio ??= tiempo;
    const avance = Math.min((tiempo - inicio) / duracion, 1);
    const suavizado = 1 - Math.pow(1 - avance, 3); // ease-out cúbico
    elemento.textContent = formato.format(destino * suavizado) + sufijo;
    if (avance < 1) requestAnimationFrame(cuadro);
    else elemento.textContent = original;
  };
  requestAnimationFrame(cuadro);
}

/* ---------- 3. Aparición al hacer scroll ---------- */
function revelar() {
  const grupos = [
    ".cifras p",
    ".encabezado",
    ".proyecto",
    ".laboratorios",
    ".historia-grid > div",
    ".tabla-herr > div",
    ".pie",
  ];
  const elementos = document.querySelectorAll(grupos.join(","));
  if (!elementos.length || !("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("js-animado");
  elementos.forEach((elemento) => {
    elemento.classList.add("revelar");
    // Los hermanos del mismo grupo aparecen escalonados.
    const hermanos = [...elemento.parentElement.children].filter((h) => h.matches(grupos.join(",")));
    const posicion = Math.min(hermanos.indexOf(elemento), 5);
    if (posicion > 0) elemento.style.setProperty("--retraso", `${posicion * 0.08}s`);
  });

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add("visible");
        const cifra = entrada.target.matches(".cifras p") && entrada.target.querySelector("strong");
        if (cifra) contar(cifra);
        observador.unobserve(entrada.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  elementos.forEach((elemento) => observador.observe(elemento));

  // Si se llega por un ancla (#taskflow), lo que ya está en pantalla se muestra al tiro.
  window.addEventListener("hashchange", () => {
    document.querySelectorAll(".revelar:not(.visible)").forEach((e) => {
      const caja = e.getBoundingClientRect();
      if (caja.top < innerHeight && caja.bottom > 0) e.classList.add("visible");
    });
  });
}

if (!menosMovimiento) {
  const consola = document.querySelector(".consola .escribe");
  if (consola) escribir(consola);
  revelar();
}

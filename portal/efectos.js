"use strict";

// Efectos animados de la portada, pensados para no trabar la página:
// 1. Partículas conectadas detrás de la presentación (como una red neuronal).
// 2. Una mini serpiente que recorre el pie, en honor al proyecto Snake.
//
// Reglas de rendimiento:
// - Solo se dibuja mientras el efecto está en pantalla y la pestaña visible.
// - La cantidad de partículas depende del tamaño de la pantalla.
// - La serpiente se dibuja 12 veces por segundo, no 60.
// - Con «reducir movimiento» o «ahorro de datos» se muestra un cuadro fijo.

(() => {
  const quieto =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (navigator.connection && navigator.connection.saveData === true);
  const densidad = Math.min(window.devicePixelRatio || 1, 1.5);

  // Ejecuta «dibujar» solo cuando el elemento está a la vista.
  function cuandoVisible(elemento, alEntrar, alSalir) {
    if (!("IntersectionObserver" in window)) {
      alEntrar();
      return;
    }
    new IntersectionObserver((entradas) => {
      for (const e of entradas) (e.isIntersecting ? alEntrar : alSalir)();
    }).observe(elemento);
  }

  /* ---------- 1. Partículas conectadas ---------- */
  function particulas() {
    const caja = document.querySelector(".fondo-particulas");
    if (!caja) return;
    const lienzo = caja.querySelector("canvas");
    const ctx = lienzo.getContext("2d");
    let ancho = 0;
    let alto = 0;
    let puntos = [];
    let cuadro = 0;
    let activo = false;
    const puntero = { x: -9999, y: -9999 };
    const DISTANCIA = 130;

    function medir() {
      ancho = caja.clientWidth;
      alto = caja.clientHeight;
      lienzo.width = Math.round(ancho * densidad);
      lienzo.height = Math.round(alto * densidad);
      ctx.setTransform(densidad, 0, 0, densidad, 0, 0);
      // Una partícula cada ~22 000 px², con un máximo de 70.
      const cantidad = Math.max(18, Math.min(70, Math.round((ancho * alto) / 22000)));
      puntos = Array.from({ length: cantidad }, () => ({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() < 0.2 ? 2.2 : 1.4,
      }));
    }

    function dibujar() {
      ctx.clearRect(0, 0, ancho, alto);
      for (const p of puntos) {
        if (!quieto) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > ancho) p.vx *= -1;
          if (p.y < 0 || p.y > alto) p.vy *= -1;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < puntos.length; i++) {
        const a = puntos[i];
        for (let j = i + 1; j < puntos.length; j++) {
          const b = puntos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < DISTANCIA * DISTANCIA) {
            ctx.strokeStyle = `rgba(168, 85, 247, ${(1 - Math.sqrt(d2) / DISTANCIA) * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // Líneas hacia el puntero: la red «reacciona» al mouse.
        const px = a.x - puntero.x;
        const py = a.y - puntero.y;
        const dp = px * px + py * py;
        if (dp < 160 * 160) {
          ctx.strokeStyle = `rgba(255, 46, 99, ${(1 - Math.sqrt(dp) / 160) * 0.6})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(puntero.x, puntero.y);
          ctx.stroke();
        }
      }
      for (const p of puntos) {
        ctx.fillStyle = p.r > 2 ? "#ff2e63" : "#c084fc";
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      if (activo && !quieto) cuadro = requestAnimationFrame(dibujar);
    }

    const iniciar = () => {
      if (activo || document.hidden) return;
      activo = true;
      cuadro = requestAnimationFrame(dibujar);
    };
    const detener = () => {
      activo = false;
      cancelAnimationFrame(cuadro);
    };

    medir();
    dibujar();
    if (quieto) return;
    cuandoVisible(caja, iniciar, detener);
    document.addEventListener("visibilitychange", () => (document.hidden ? detener() : iniciar()));
    let espera;
    window.addEventListener("resize", () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        medir();
        if (!activo) dibujar();
      }, 200);
    });
    window.addEventListener(
      "pointermove",
      (e) => {
        const caja2 = lienzo.getBoundingClientRect();
        puntero.x = e.clientX - caja2.left;
        puntero.y = e.clientY - caja2.top;
      },
      { passive: true },
    );
    document.addEventListener("pointerleave", () => {
      puntero.x = puntero.y = -9999;
    });
  }

  /* ---------- 2. Serpiente en el pie ---------- */
  function serpiente() {
    const lienzo = document.querySelector(".pie-serpiente canvas");
    if (!lienzo) return;
    const ctx = lienzo.getContext("2d");
    const CELDA = 12;
    let columnas = 0;
    let filas = 0;
    let cuerpo = [];
    let manzana = [0, 0];
    let reloj = 0;

    function nuevaManzana() {
      manzana = [1 + Math.floor(Math.random() * (columnas - 2)), Math.floor(Math.random() * filas)];
    }

    function medir() {
      const ancho = lienzo.clientWidth;
      const alto = lienzo.clientHeight;
      lienzo.width = Math.round(ancho * densidad);
      lienzo.height = Math.round(alto * densidad);
      ctx.setTransform(densidad, 0, 0, densidad, 0, 0);
      columnas = Math.max(10, Math.floor(ancho / CELDA));
      filas = Math.max(3, Math.floor(alto / CELDA));
      const y = Math.floor(filas / 2);
      cuerpo = [5, 4, 3, 2, 1, 0].map((x) => [x, y]);
      nuevaManzana();
    }

    function avanzar() {
      const [hx, hy] = cuerpo[0];
      const [mx, my] = manzana;
      // Persigue la manzana: primero en horizontal, luego en vertical.
      const paso = hx !== mx ? [hx + Math.sign(mx - hx), hy] : [hx, hy + Math.sign(my - hy)];
      cuerpo.unshift(paso);
      if (paso[0] === mx && paso[1] === my) {
        nuevaManzana();
        if (cuerpo.length > 18) cuerpo.length = 6; // vuelve a empezar chica
      } else {
        cuerpo.pop();
      }
    }

    function dibujar() {
      const ancho = lienzo.clientWidth;
      const alto = lienzo.clientHeight;
      ctx.clearRect(0, 0, ancho, alto);
      ctx.fillStyle = "rgba(168, 85, 247, 0.16)";
      for (let x = 0; x < columnas; x++) {
        for (let y = 0; y < filas; y++) ctx.fillRect(x * CELDA + 5, y * CELDA + 5, 2, 2);
      }
      ctx.fillStyle = "#ff2e63";
      ctx.beginPath();
      ctx.arc(manzana[0] * CELDA + 6, manzana[1] * CELDA + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      cuerpo.forEach(([x, y], i) => {
        ctx.fillStyle = i === 0 ? "#c6f7c2" : "#6fd98a";
        ctx.globalAlpha = 1 - (i / cuerpo.length) * 0.5;
        ctx.fillRect(x * CELDA + 1, y * CELDA + 1, CELDA - 2, CELDA - 2);
      });
      ctx.globalAlpha = 1;
    }

    const iniciar = () => {
      if (reloj || document.hidden) return;
      reloj = setInterval(() => {
        avanzar();
        dibujar();
      }, 85);
    };
    const detener = () => {
      clearInterval(reloj);
      reloj = 0;
    };

    medir();
    dibujar();
    if (quieto) return;
    cuandoVisible(lienzo, iniciar, detener);
    document.addEventListener("visibilitychange", () => (document.hidden ? detener() : iniciar()));
    let espera;
    window.addEventListener("resize", () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        medir();
        dibujar();
      }, 200);
    });
  }

  particulas();
  serpiente();
})();

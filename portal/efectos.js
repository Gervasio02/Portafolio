"use strict";

// Efectos animados de la portada, pensados para no trabar la página:
// 1. Fondo espacial fijo detrás de toda la página: estrellas que titilan, dos
//    planetas tenues, una estrella fugaz de vez en cuando y las partículas
//    conectadas (como una red neuronal) que reaccionan al mouse.
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
    // Capa quieta (planetas y estrellas tenues) dibujada una sola vez por tamaño.
    const capa = document.createElement("canvas");
    const capaCtx = capa.getContext("2d");
    let estrellas = [];
    let fugaz = null;
    // La primera estrella fugaz aparece a los ~3 segundos de abrir la página.
    let proximaFugaz = performance.now() + 3000;

    function planeta(c, x, y, r, color, anillo) {
      const brillo = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      brillo.addColorStop(0, `rgba(${color}, 0.32)`);
      brillo.addColorStop(0.7, `rgba(${color}, 0.12)`);
      brillo.addColorStop(1, `rgba(${color}, 0.02)`);
      c.fillStyle = brillo;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      if (anillo) {
        c.save();
        c.translate(x, y);
        c.rotate(-0.35);
        c.strokeStyle = `rgba(${color}, 0.22)`;
        c.lineWidth = Math.max(1, r * 0.06);
        c.beginPath();
        c.ellipse(0, 0, r * 1.75, r * 0.42, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    }

    function pintarCapa() {
      capa.width = lienzo.width;
      capa.height = lienzo.height;
      capaCtx.setTransform(densidad, 0, 0, densidad, 0, 0);
      const base = Math.min(ancho, alto);
      // Planeta morado con anillo arriba a la derecha y uno rojo pequeño abajo.
      planeta(capaCtx, ancho * 0.86, alto * 0.2, base * 0.07, "168, 85, 247", true);
      planeta(capaCtx, ancho * 0.045, alto * 0.56, base * 0.028, "255, 46, 99", false);
      // Estrellas tenues que no titilan.
      const fijas = Math.round((ancho * alto) / 9000);
      for (let i = 0; i < fijas; i++) {
        capaCtx.fillStyle = `rgba(241, 236, 250, ${0.12 + Math.random() * 0.25})`;
        const t = Math.random() < 0.85 ? 1 : 1.5;
        capaCtx.fillRect(Math.random() * ancho, Math.random() * alto, t, t);
      }
    }

    // Partícula y estrella nuevas en un punto al azar de la pantalla.
    const nuevaParticula = () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() < 0.2 ? 2.2 : 1.4,
    });
    const nuevaEstrella = () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      fase: Math.random() * Math.PI * 2,
      ritmo: 0.0008 + Math.random() * 0.0016,
    });

    // Ajusta la cantidad sin rehacer la red: solo suma o quita las que faltan
    // o sobran, para que nada «salte» al cambiar el tamaño.
    function ajustar(lista, cantidad, crear) {
      while (lista.length < cantidad) lista.push(crear());
      lista.length = cantidad;
    }

    function medir() {
      const nuevoAncho = caja.clientWidth;
      const nuevoAlto = caja.clientHeight;
      // En el teléfono la barra del navegador dispara «resize» al hacer scroll;
      // si el tamaño real no cambió no hay nada que hacer.
      if (nuevoAncho === ancho && nuevoAlto === alto) return false;
      // Las partículas que ya existen se quedan donde están; si alguna queda
      // fuera de la pantalla vuelve sola nadando hacia adentro.
      ancho = nuevoAncho;
      alto = nuevoAlto;
      lienzo.width = Math.round(ancho * densidad);
      lienzo.height = Math.round(alto * densidad);
      ctx.setTransform(densidad, 0, 0, densidad, 0, 0);
      // Una partícula cada ~22 000 px² de pantalla, con un máximo de 70.
      const cantidad = Math.max(18, Math.min(70, Math.round((ancho * alto) / 22000)));
      ajustar(puntos, cantidad, nuevaParticula);
      // Pocas estrellas que titilan; el resto vive en la capa quieta.
      ajustar(estrellas, Math.max(12, Math.min(40, cantidad)), nuevaEstrella);
      pintarCapa();
      return true;
    }

    function estrellaFugaz(t, paso) {
      if (!fugaz) {
        if (t < proximaFugaz) return;
        // Cruza en diagonal desde la parte alta, cada 7 a 16 segundos.
        const angulo = 0.45 + Math.random() * 0.35;
        const rapidez = 7 + Math.random() * 4;
        fugaz = {
          x: Math.random() * ancho * 0.7,
          y: Math.random() * alto * 0.35,
          vx: Math.cos(angulo) * rapidez,
          vy: Math.sin(angulo) * rapidez,
          vida: 0,
          duracion: 55 + Math.random() * 25,
        };
      }
      const f = fugaz;
      f.x += f.vx * paso;
      f.y += f.vy * paso;
      f.vida += paso;
      const avance = f.vida / f.duracion;
      const opacidad = Math.sin(Math.min(avance, 1) * Math.PI);
      const cola = ctx.createLinearGradient(f.x, f.y, f.x - f.vx * 12, f.y - f.vy * 12);
      cola.addColorStop(0, `rgba(241, 236, 250, ${opacidad})`);
      cola.addColorStop(1, "rgba(192, 132, 252, 0)");
      ctx.strokeStyle = cola;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - f.vx * 12, f.y - f.vy * 12);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${opacidad})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (avance >= 1) {
        fugaz = null;
        proximaFugaz = t + 7000 + Math.random() * 9000;
      }
    }

    // El movimiento se mide en tiempo real y no por cuadro: si el navegador
    // se salta cuadros (scroll, otra pestaña) las partículas no dan saltos.
    let anterior = 0;
    function dibujar(t = 0) {
      const paso = anterior ? Math.min(t - anterior, 50) / (1000 / 60) : 1;
      anterior = t;
      ctx.clearRect(0, 0, ancho, alto);
      ctx.drawImage(capa, 0, 0, ancho, alto);
      for (const e of estrellas) {
        const luz = quieto ? 0.6 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(e.fase + t * e.ritmo));
        ctx.fillStyle = `rgba(241, 236, 250, ${luz})`;
        ctx.fillRect(e.x - 0.9, e.y - 0.9, 1.8, 1.8);
      }
      if (!quieto) estrellaFugaz(t, paso);
      for (const p of puntos) {
        if (!quieto) {
          p.x += p.vx * paso;
          p.y += p.vy * paso;
          // Rebote suave: al pasar un borde la partícula gira hacia adentro sin
          // moverla de golpe, así nunca queda temblando en la orilla.
          if (p.x < 0) p.vx = Math.abs(p.vx);
          else if (p.x > ancho) p.vx = -Math.abs(p.vx);
          if (p.y < 0) p.vy = Math.abs(p.vy);
          else if (p.y > alto) p.vy = -Math.abs(p.vy);
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
      anterior = 0;
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
        if (medir() && !activo) dibujar();
      }, 200);
    });
    window.addEventListener(
      "pointermove",
      (e) => {
        // En pantallas táctiles el dedo hace scroll: no se dibujan líneas hacia
        // él, porque quedaban pegadas donde se levantó el dedo.
        if (e.pointerType !== "mouse") return;
        const caja2 = lienzo.getBoundingClientRect();
        puntero.x = e.clientX - caja2.left;
        puntero.y = e.clientY - caja2.top;
      },
      { passive: true },
    );
    // El mouse salió de la ventana: se sueltan las líneas.
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) puntero.x = puntero.y = -9999;
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

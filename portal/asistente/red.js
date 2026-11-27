/* Red neuronal del asistente: inferencia en el navegador, sin librerías.
 *
 * Gemelo de `asistente/caracteristicas.py`: la conversión de texto a vector
 * debe ser idéntica a la de Python (lo verifica una prueba automática).
 * Los pesos vienen de `modelo.json`, generado por `asistente/entrenar.py`.
 */
(function (global) {
  "use strict";

  const DIMENSION = 2048;
  const PALABRAS_VACIAS = new Set(
    ("el la los las un una unos unas de del al y o a en es por para con se lo " +
      "le me te mi tu su sus mis tus yo hay muy mas ya este esta esto eso ese " +
      "esa son fue ser has he ha").split(" ")
  );
  const PESOS = { p: 1.0, b: 0.8, c: 0.35 };

  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/([a-z])\1+/g, "$1")
      .trim();
  }

  // Raíz simple: sin plural ni vocal final, y como máximo 6 letras.
  function raiz(palabra) {
    if (palabra.length > 4 && palabra.endsWith("s")) palabra = palabra.slice(0, -1);
    if (palabra.length > 4 && "aeo".includes(palabra[palabra.length - 1])) palabra = palabra.slice(0, -1);
    return palabra.slice(0, 6);
  }

  // FNV-1a de 32 bits sobre los bytes UTF-8 (el texto ya es ASCII).
  function fnv1a(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // Reemplaza frases chilenas (de 3, 2 o 1 palabra, la más larga primero).
  function traducir(palabras, mapa) {
    const salida = [];
    let i = 0;
    while (i < palabras.length) {
      let hecho = false;
      for (const largo of [3, 2, 1]) {
        if (palabras.length - i < largo) continue;
        const frase = palabras.slice(i, i + largo).join(" ");
        if (Object.prototype.hasOwnProperty.call(mapa, frase)) {
          if (mapa[frase]) salida.push(...mapa[frase].split(" "));
          i += largo;
          hecho = true;
          break;
        }
      }
      if (!hecho) salida.push(palabras[i++]);
    }
    return salida;
  }

  function rasgos(texto, mapa = {}) {
    const normal = normalizar(texto);
    const palabras = normal ? traducir(normal.split(" "), mapa).filter((p) => !PALABRAS_VACIAS.has(p)) : [];
    const raices = palabras.map(raiz);
    const salida = [];
    for (const r of raices) salida.push(["p:" + r, PESOS.p]);
    for (let i = 0; i + 1 < raices.length; i++) salida.push(["b:" + raices[i] + "_" + raices[i + 1], PESOS.b]);
    for (const p of palabras) {
      const marcada = "#" + p + "#";
      for (let i = 0; i + 3 <= marcada.length; i++) salida.push(["c:" + marcada.slice(i, i + 3), PESOS.c]);
    }
    return salida;
  }

  /** Vector disperso como Map(posición → valor), normalizado a largo 1. */
  function vector(texto, dimension = DIMENSION, mapa = {}) {
    const valores = new Map();
    for (const [rasgo, peso] of rasgos(texto, mapa)) {
      const indice = fnv1a(rasgo) % dimension;
      valores.set(indice, (valores.get(indice) || 0) + peso);
    }
    let norma = 0;
    for (const v of valores.values()) norma += v * v;
    norma = Math.sqrt(norma);
    if (!norma) return new Map();
    for (const [i, v] of valores) valores.set(i, v / norma);
    return valores;
  }

  function decodificar(matriz) {
    const binario = typeof atob === "function" ? atob(matriz.datos) : Buffer.from(matriz.datos, "base64").toString("binary");
    const enteros = new Int8Array(binario.length);
    for (let i = 0; i < binario.length; i++) enteros[i] = (binario.charCodeAt(i) << 24) >> 24;
    return { filas: matriz.forma[0], columnas: matriz.forma[1], escala: matriz.escala, datos: enteros };
  }

  /** Crea un clasificador a partir del objeto de modelo.json. */
  function crear(modelo) {
    const W1 = decodificar(modelo.pesos.W1);
    const W2 = decodificar(modelo.pesos.W2);
    const b1 = Float32Array.from(modelo.pesos.b1);
    const b2 = Float32Array.from(modelo.pesos.b2);
    const dimension = modelo.arquitectura.entrada;
    const mapa = modelo.chilenismos || {};

    function predecir(texto) {
      const x = vector(texto, dimension, mapa);
      // Capa oculta: ReLU(x · W1 + b1). Solo se recorren las entradas no nulas.
      const oculta = Float32Array.from(b1);
      for (const [i, valor] of x) {
        const base = i * W1.columnas;
        const factor = valor * W1.escala;
        for (let j = 0; j < W1.columnas; j++) oculta[j] += factor * W1.datos[base + j];
      }
      for (let j = 0; j < oculta.length; j++) if (oculta[j] < 0) oculta[j] = 0;

      // Salida: softmax(oculta · W2 + b2).
      const logits = Float32Array.from(b2);
      for (let j = 0; j < W2.filas; j++) {
        if (!oculta[j]) continue;
        const base = j * W2.columnas;
        const factor = oculta[j] * W2.escala;
        for (let k = 0; k < W2.columnas; k++) logits[k] += factor * W2.datos[base + k];
      }
      let maximo = -Infinity;
      for (const v of logits) maximo = Math.max(maximo, v);
      let suma = 0;
      const prob = logits.map((v) => {
        const e = Math.exp(v - maximo);
        suma += e;
        return e;
      });
      const resultado = Array.from(prob, (p, k) => ({ intencion: modelo.intenciones[k], probabilidad: p / suma }));
      resultado.sort((a, b) => b.probabilidad - a.probabilidad);
      return { vacio: x.size === 0, resultado };
    }

    const informales = new Set(modelo.informales || []);

    // ¿El visitante escribe en tono informal? (chilenismos, abreviaturas,
    // letras estiradas como «holaaa» o risas como «jaja»).
    function esInformal(texto) {
      if (/([a-záéíóúñ])\1{2,}/i.test(texto) || /\b(ja){2,}|\bxd\b|\b(js){2,}/i.test(texto)) return true;
      const palabras = normalizar(texto).split(" ").filter(Boolean);
      for (let i = 0; i < palabras.length; i++) {
        for (const largo of [3, 2, 1]) {
          if (informales.has(palabras.slice(i, i + largo).join(" "))) return true;
        }
      }
      return false;
    }

    return {
      predecir,
      esInformal,
      rasgos: (texto) => rasgos(texto, mapa),
      umbral: modelo.umbral,
      intenciones: modelo.intenciones,
      metricas: modelo.metricas,
    };
  }

  const api = { normalizar, traducir, fnv1a, rasgos, vector, crear, DIMENSION };
  global.RedAsistente = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);

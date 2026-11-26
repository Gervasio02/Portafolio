"""Entrena la red neuronal del asistente y exporta el modelo para el navegador.

Uso (desde la raíz del repositorio):
    python asistente/entrenar.py            # entrena y escribe portal/asistente/modelo.json
    python asistente/entrenar.py --informe  # además muestra errores de validación

La red es un perceptrón multicapa escrito a mano con NumPy:

    entrada (2048, rasgos de la pregunta)
      -> capa oculta (96 neuronas, ReLU, dropout en entrenamiento)
      -> salida (una neurona por intención, softmax)

Se entrena con descenso de gradiente Adam sobre entropía cruzada con
suavizado de etiquetas y regularización L2. Las derivadas están escritas a mano (retropropagación).
"""

from __future__ import annotations

import argparse
import base64
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

from caracteristicas import DIMENSION, normalizar, vector  # noqa: E402

RAIZ = AQUI.parent
CONOCIMIENTO = AQUI / "conocimiento.yml"
SALIDA = RAIZ / "portal" / "asistente" / "modelo.json"

OCULTA = 96
EPOCAS = 220
APRENDIZAJE = 0.01
L2 = 1e-4
DROPOUT = 0.3
SEMILLA = 2026
# Suavizado de etiquetas: evita que la red se confíe al 100 % cuando se equivoca.
SUAVIZADO = 0.1
# Bajo este nivel de confianza el asistente admite que no sabe.
UMBRAL = 0.35

RELLENOS = [
    "oye", "dime", "me gustaría saber", "quisiera saber", "una pregunta",
    "consulta", "hola", "por favor", "me puedes decir", "cuéntame",
]


# ---------------------------------------------------------------- datos

def cargar_conocimiento(ruta: Path = CONOCIMIENTO) -> list[dict]:
    datos = yaml.safe_load(ruta.read_text(encoding="utf-8"))
    intenciones = datos["intenciones"]
    ids = [i["id"] for i in intenciones]
    if len(ids) != len(set(ids)):
        raise ValueError("Hay ids de intención repetidos en conocimiento.yml")
    for intencion in intenciones:
        if len(intencion.get("ejemplos", [])) < 3:
            raise ValueError(f"La intención {intencion['id']} necesita al menos 3 ejemplos")
        if not str(intencion.get("respuesta", "")).strip():
            raise ValueError(f"La intención {intencion['id']} no tiene respuesta")
        for sugerencia in intencion.get("sugerencias", []):
            if sugerencia not in ids:
                raise ValueError(f"{intencion['id']} sugiere «{sugerencia}», que no existe")
    return intenciones


def tipeo(palabra: str, rng: random.Random) -> str:
    if len(palabra) < 4:
        return palabra
    i = rng.randrange(1, len(palabra) - 1)
    opcion = rng.random()
    if opcion < 0.4:  # intercambia dos letras
        return palabra[: i - 1] + palabra[i] + palabra[i - 1] + palabra[i + 1 :]
    if opcion < 0.7:  # borra una letra
        return palabra[:i] + palabra[i + 1 :]
    return palabra[:i] + palabra[i] + palabra[i:]  # duplica una letra


def aumentar(frase: str, rng: random.Random, cantidad: int) -> list[str]:
    """Variantes de una frase para que la red generalice mejor."""
    variantes = []
    palabras = normalizar(frase).split()
    for _ in range(cantidad):
        nuevas = list(palabras)
        accion = rng.random()
        if accion < 0.3 and len(nuevas) > 2:
            nuevas.pop(rng.randrange(len(nuevas)))
        elif accion < 0.6 and nuevas:
            j = rng.randrange(len(nuevas))
            nuevas[j] = tipeo(nuevas[j], rng)
        elif accion < 0.85:
            nuevas.insert(0, rng.choice(RELLENOS))
        else:
            nuevas.append(rng.choice(["por favor", "gracias", "porfa"]))
        variantes.append(" ".join(nuevas))
    return variantes


PLANTILLAS_CLAVE = ["{}", "¿{}?", "háblame de {}", "¿qué hay de {}?", "una pregunta sobre {}"]


def a_matriz(frases: list[str]) -> np.ndarray:
    x = np.zeros((len(frases), DIMENSION), dtype=np.float32)
    for fila, frase in enumerate(frases):
        for indice, valor in vector(frase).items():
            x[fila, indice] = valor
    return x


# ---------------------------------------------------------------- red

class Red:
    """Perceptrón multicapa con una capa oculta, entrenado con Adam."""

    def __init__(self, entradas: int, oculta: int, salidas: int, rng: np.random.Generator):
        # Inicialización He para ReLU y Xavier para la salida.
        self.p = {
            "W1": rng.normal(0, np.sqrt(2 / entradas), (entradas, oculta)).astype(np.float32),
            "b1": np.zeros(oculta, dtype=np.float32),
            "W2": rng.normal(0, np.sqrt(1 / oculta), (oculta, salidas)).astype(np.float32),
            "b2": np.zeros(salidas, dtype=np.float32),
        }
        self.m = {k: np.zeros_like(v) for k, v in self.p.items()}
        self.v = {k: np.zeros_like(v) for k, v in self.p.items()}
        self.t = 0
        self.rng = rng

    @staticmethod
    def softmax(z: np.ndarray) -> np.ndarray:
        z = z - z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)

    def predecir(self, x: np.ndarray) -> np.ndarray:
        h = np.maximum(0, x @ self.p["W1"] + self.p["b1"])
        return self.softmax(h @ self.p["W2"] + self.p["b2"])

    def paso(self, x: np.ndarray, y: np.ndarray) -> float:
        """Un paso de entrenamiento: propagación, pérdida, retropropagación y Adam."""
        n = x.shape[0]
        z1 = x @ self.p["W1"] + self.p["b1"]
        h = np.maximum(0, z1)
        mascara = (self.rng.random(h.shape) > DROPOUT) / (1 - DROPOUT)
        h_d = h * mascara
        prob = self.softmax(h_d @ self.p["W2"] + self.p["b2"])

        k = prob.shape[1]
        objetivo = np.full_like(prob, SUAVIZADO / k)
        objetivo[np.arange(n), y] += 1 - SUAVIZADO
        perdida = -(objetivo * np.log(prob + 1e-9)).sum(axis=1).mean()
        perdida += L2 / 2 * (np.sum(self.p["W1"] ** 2) + np.sum(self.p["W2"] ** 2))

        # Retropropagación (derivadas escritas a mano).
        dz2 = (prob - objetivo) / n
        grad = {
            "W2": h_d.T @ dz2 + L2 * self.p["W2"],
            "b2": dz2.sum(axis=0),
        }
        dh = (dz2 @ self.p["W2"].T) * mascara * (z1 > 0)
        grad["W1"] = x.T @ dh + L2 * self.p["W1"]
        grad["b1"] = dh.sum(axis=0)

        # Adam.
        self.t += 1
        b1, b2, eps = 0.9, 0.999, 1e-8
        for k in self.p:
            self.m[k] = b1 * self.m[k] + (1 - b1) * grad[k]
            self.v[k] = b2 * self.v[k] + (1 - b2) * grad[k] ** 2
            m_hat = self.m[k] / (1 - b1**self.t)
            v_hat = self.v[k] / (1 - b2**self.t)
            self.p[k] -= (APRENDIZAJE * m_hat / (np.sqrt(v_hat) + eps)).astype(np.float32)
        return float(perdida)

    def entrenar(self, x: np.ndarray, y: np.ndarray, epocas: int = EPOCAS, lote: int = 64) -> list[float]:
        historial = []
        for _ in range(epocas):
            orden = self.rng.permutation(len(x))
            perdidas = [self.paso(x[orden[i : i + lote]], y[orden[i : i + lote]]) for i in range(0, len(x), lote)]
            historial.append(float(np.mean(perdidas)))
        return historial


# ---------------------------------------------------------------- flujo

def preparar(intenciones: list[dict], semilla: int, validacion: float):
    rng = random.Random(semilla)
    entrenamiento, prueba = [], []
    for clase, intencion in enumerate(intenciones):
        ejemplos = list(intencion["ejemplos"])
        rng.shuffle(ejemplos)
        corte = int(round(len(ejemplos) * validacion))
        for frase in ejemplos[:corte]:
            prueba.append((frase, clase))
        for frase in ejemplos[corte:]:
            entrenamiento.append((frase, clase))
            for variante in aumentar(frase, rng, 4):
                entrenamiento.append((variante, clase))
        # Las palabras clave entran siempre al entrenamiento, con plantillas
        # neutras que se repiten igual en todas las intenciones.
        for clave in intencion.get("claves", []):
            for plantilla in PLANTILLAS_CLAVE:
                entrenamiento.append((plantilla.format(clave), clase))
    return entrenamiento, prueba


def entrenar_red(pares, clases: int, semilla: int) -> tuple[Red, list[float]]:
    x = a_matriz([f for f, _ in pares])
    y = np.array([c for _, c in pares])
    red = Red(DIMENSION, OCULTA, clases, np.random.default_rng(semilla))
    historial = red.entrenar(x, y)
    return red, historial


def cuantizar(matriz: np.ndarray) -> dict:
    """Guarda una matriz como int8 + escala para que el modelo pese poco."""
    escala = float(np.abs(matriz).max() / 127) or 1.0
    enteros = np.clip(np.round(matriz / escala), -127, 127).astype(np.int8)
    return {
        "forma": list(matriz.shape),
        "escala": escala,
        "datos": base64.b64encode(enteros.tobytes()).decode("ascii"),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--informe", action="store_true", help="muestra las preguntas de validación que falló")
    parser.add_argument("--salida", type=Path, default=SALIDA)
    args = parser.parse_args(argv)

    intenciones = cargar_conocimiento()
    clases = len(intenciones)

    # 1) Validación: entrena sin el 20 % de los ejemplos y mide con ellos.
    entrenamiento, prueba = preparar(intenciones, SEMILLA, 0.2)
    red, _ = entrenar_red(entrenamiento, clases, SEMILLA)
    prob = red.predecir(a_matriz([f for f, _ in prueba]))
    acierto = float(np.mean(prob.argmax(axis=1) == np.array([c for _, c in prueba])))
    if args.informe:
        for (frase, clase), fila in zip(prueba, prob):
            if fila.argmax() != clase:
                print(f"  ✗ «{frase}» → {intenciones[fila.argmax()]['id']} (esperaba {intenciones[clase]['id']})")

    # 2) Modelo final: entrena con todos los ejemplos.
    todos, _ = preparar(intenciones, SEMILLA, 0.0)
    red, historial = entrenar_red(todos, clases, SEMILLA)
    x_todo = a_matriz([f for i in intenciones for f in i["ejemplos"]])
    y_todo = np.array([c for c, i in enumerate(intenciones) for _ in i["ejemplos"]])
    acierto_entrenamiento = float(np.mean(red.predecir(x_todo).argmax(axis=1) == y_todo))

    modelo = {
        "version": 1,
        "creado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "arquitectura": {"entrada": DIMENSION, "oculta": OCULTA, "salida": clases, "activacion": "relu"},
        "umbral": UMBRAL,
        "metricas": {
            "intenciones": clases,
            "ejemplos": int(sum(len(i["ejemplos"]) for i in intenciones)),
            "ejemplos_aumentados": len(todos),
            "epocas": EPOCAS,
            "exactitud_validacion": round(acierto, 4),
            "exactitud_entrenamiento": round(acierto_entrenamiento, 4),
            "perdida_final": round(historial[-1], 4),
            "curva_perdida": [round(p, 4) for p in historial[:: max(1, EPOCAS // 44)]],
        },
        "pesos": {
            "W1": cuantizar(red.p["W1"]),
            "b1": [round(float(v), 5) for v in red.p["b1"]],
            "W2": cuantizar(red.p["W2"]),
            "b2": [round(float(v), 5) for v in red.p["b2"]],
        },
        "intenciones": [
            {
                "id": i["id"],
                "pregunta": i["ejemplos"][0],
                "respuesta": " ".join(str(i["respuesta"]).split()),
                "sugerencias": i.get("sugerencias", []),
            }
            for i in intenciones
        ],
    }
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(json.dumps(modelo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    peso = args.salida.stat().st_size / 1024
    print(
        f"Intenciones: {clases} · ejemplos: {modelo['metricas']['ejemplos']} "
        f"(+aumentados: {len(todos)}) · validación: {acierto:.1%} · "
        f"entrenamiento: {acierto_entrenamiento:.1%} · pérdida: {historial[-1]:.3f} · "
        f"modelo: {peso:.0f} KB → {args.salida.relative_to(RAIZ) if args.salida.is_relative_to(RAIZ) else args.salida}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

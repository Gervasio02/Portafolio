"""Convierte una pregunta en un vector numérico para la red.

Este archivo tiene un gemelo en JavaScript (`portal/asistente/red.js`):
ambos deben producir exactamente el mismo vector. La prueba
`tests/test_asistente.py::test_paridad_con_javascript` lo verifica.

Pasos:
1. Normalizar: minúsculas, sin tildes, solo letras y números.
2. Tokenizar y quitar palabras vacías («el», «de», «para»...).
3. Raíz simple: sin plural ni vocal final y como máximo 6 letras
   («estudiaste» y «estudios» -> «estudi»; «remota» y «remoto» -> «remot»).
4. Rasgos: palabras, pares de palabras seguidas y trigramas de letras
   (estos últimos toleran errores de tipeo).
5. «Hashing trick»: cada rasgo se convierte en una posición del vector con
   FNV-1a de 32 bits, así no hace falta guardar un vocabulario.
6. El vector se normaliza a largo 1.
"""

from __future__ import annotations

import math
import re
import unicodedata

DIMENSION = 2048

PALABRAS_VACIAS = frozenset(
    "el la los las un una unos unas de del al y o a en es por para con se lo "
    "le me te mi tu su sus mis tus yo hay muy mas ya este esta esto eso ese "
    "esa son fue ser has he ha".split()
)

PESOS = {"p": 1.0, "b": 0.8, "c": 0.35}


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return texto.strip()


def raiz(palabra: str) -> str:
    """Raíz simple: sin plural ni vocal final, y como máximo 6 letras.

    «remoto», «remota» y «remotos» -> «remot».
    """
    if len(palabra) > 4 and palabra.endswith("s"):
        palabra = palabra[:-1]
    if len(palabra) > 4 and palabra[-1] in "aeo":
        palabra = palabra[:-1]
    return palabra[:6]


def fnv1a(texto: str) -> int:
    h = 0x811C9DC5
    for byte in texto.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def rasgos(texto: str) -> list[tuple[str, float]]:
    palabras = [p for p in normalizar(texto).split() if p not in PALABRAS_VACIAS]
    raices = [raiz(p) for p in palabras]
    salida: list[tuple[str, float]] = []
    for r in raices:
        salida.append(("p:" + r, PESOS["p"]))
    for a, b in zip(raices, raices[1:]):
        salida.append(("b:" + a + "_" + b, PESOS["b"]))
    for p in palabras:
        marcada = "#" + p + "#"
        for i in range(len(marcada) - 2):
            salida.append(("c:" + marcada[i : i + 3], PESOS["c"]))
    return salida


def vector(texto: str, dimension: int = DIMENSION) -> dict[int, float]:
    """Vector disperso {posición: valor} normalizado a largo 1."""
    valores: dict[int, float] = {}
    for rasgo, peso in rasgos(texto):
        indice = fnv1a(rasgo) % dimension
        valores[indice] = valores.get(indice, 0.0) + peso
    norma = math.sqrt(sum(v * v for v in valores.values()))
    if norma == 0:
        return {}
    return {i: v / norma for i, v in valores.items()}

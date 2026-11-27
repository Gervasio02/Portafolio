"""Convierte una pregunta en un vector numérico para la red.

Este archivo tiene un gemelo en JavaScript (`portal/asistente/red.js`):
ambos deben producir exactamente el mismo vector. La prueba
`tests/test_asistente.py::test_paridad_con_javascript` lo verifica.

Pasos:
1. Normalizar: minúsculas, sin tildes, solo letras y números, y sin letras
   repetidas («holaaa» -> «hola»).
2. Traducir chilenismos («pega» -> «trabajo», «al tiro» -> «inmediatamente»)
   según `chilenismos.yml`.
2b. Tokenizar y quitar palabras vacías («el», «de», «para»...).
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
from functools import lru_cache
from pathlib import Path

import yaml

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
    # Letras repetidas al escribir rápido o con énfasis: «holaaa» -> «hola».
    # Se aplica igual al entrenar y al preguntar, así que no daña palabras
    # con letras dobles («llamar» -> «lamar» en ambos lados).
    texto = re.sub(r"([a-z])\1+", r"\1", texto)
    return texto.strip()


CHILENISMOS_YML = Path(__file__).resolve().parent / "chilenismos.yml"


@lru_cache(maxsize=1)
def chilenismos() -> dict[str, str]:
    """Diccionario {frase normalizada: equivalente normalizado}."""
    datos = yaml.safe_load(CHILENISMOS_YML.read_text(encoding="utf-8")) or {}
    return {normalizar(str(k)): normalizar(str(v or "")) for k, v in (datos.get("chilenismos") or {}).items()}


def traducir(palabras: list[str], mapa: dict[str, str]) -> list[str]:
    """Reemplaza frases chilenas (de 3, 2 o 1 palabra, la más larga primero)."""
    salida: list[str] = []
    i = 0
    while i < len(palabras):
        for largo in (3, 2, 1):
            frase = " ".join(palabras[i : i + largo])
            if len(palabras) - i >= largo and frase in mapa:
                salida.extend(mapa[frase].split())
                i += largo
                break
        else:
            salida.append(palabras[i])
            i += 1
    return salida


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


def rasgos(texto: str, mapa: dict[str, str] | None = None) -> list[tuple[str, float]]:
    mapa = chilenismos() if mapa is None else mapa
    palabras = [p for p in traducir(normalizar(texto).split(), mapa) if p not in PALABRAS_VACIAS]
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


def vector(texto: str, dimension: int = DIMENSION, mapa: dict[str, str] | None = None) -> dict[int, float]:
    """Vector disperso {posición: valor} normalizado a largo 1."""
    valores: dict[int, float] = {}
    for rasgo, peso in rasgos(texto, mapa):
        indice = fnv1a(rasgo) % dimension
        valores[indice] = valores.get(indice, 0.0) + peso
    norma = math.sqrt(sum(v * v for v in valores.values()))
    if norma == 0:
        return {}
    return {i: v / norma for i, v in valores.items()}

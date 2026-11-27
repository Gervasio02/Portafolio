"""Pruebas del asistente: datos válidos, paridad Python/JS y calidad de la red."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))

import entrenar  # noqa: E402
from caracteristicas import chilenismos, normalizar, traducir, vector  # noqa: E402

RAIZ = AQUI.parent.parent
RED_JS = RAIZ / "portal" / "asistente" / "red.js"

# Preguntas que NO están en conocimiento.yml, redactadas como las haría un
# reclutador. Miden si la red generaliza en vez de memorizar.
PREGUNTAS_NUEVAS = [
    ("¿qué carrera estudiaste?", "formacion"),
    ("¿en qué lenguajes de programación tienes experiencia?", "stack"),
    ("¿has trabajado con react?", "frontend"),
    ("¿sabes hacer una api con node?", "backend"),
    ("¿qué base de datos usas?", "bases_datos"),
    ("¿tus proyectos tienen pruebas automatizadas?", "pruebas"),
    ("¿sabes desplegar en azure con docker?", "devops"),
    ("¿cuál es tu correo electrónico?", "contacto"),
    ("¿dónde puedo descargar tu currículum?", "cv"),
    ("¿cuánto esperas ganar?", "sueldo"),
    ("¿trabajarías de forma remota?", "modalidad"),
    ("¿qué hiciste en tu práctica profesional?", "practica_tuniche"),
    ("¿qué es el proyecto taskflow?", "taskflow"),
    ("cuéntame del juego de la serpiente", "snake"),
    ("¿cómo funciona la tienda online?", "tiendanova"),
    ("¿por qué te elegiría a ti?", "por_que_contratar"),
    ("¿cuáles son tus puntos fuertes?", "fortalezas"),
    ("¿hablas inglés?", "idiomas"),
    ("¿cuándo podrías empezar a trabajar?", "disponibilidad"),
    ("¿eres un chatbot?", "asistente"),
    ("¿cuál es tu proyecto favorito?", "proyecto_destacado"),
    ("¿qué tiempo hará mañana?", "clima"),
    ("hola, buenas tardes", "saludo"),
    ("muchas gracias por la info", "gracias"),
    ("¿tienes perfil de github?", "github"),
    ("¿cómo evitas que dos personas reserven la misma cancha?", "reservaya"),
    ("¿tienes experiencia programando en c#?", "bodeganet"),
    ("¿usas scrum en tus proyectos?", "metodologias"),
    ("¿qué metas tienes como desarrollador?", "motivacion"),
    ("¿sabes programar en java?", "otros_lenguajes"),
    ("wena po, ¿cachai de react?", "frontend"),
    ("¿cuántas lucas pedí por la pega?", "sueldo"),
    ("¿podís empezar al tiro?", "disponibilidad"),
    ("¿cómo está el clima en rancagua?", "clima"),
    ("¿me das la receta de las empanadas?", "fuera_de_tema"),
    ("holaaa q tal", "saludo"),
    ("tenis exp en react?", "frontend"),
    ("xq t contrataria", "por_que_contratar"),
    ("pasame tu correo pls", "contacto"),
    ("dnd stas viviendo", "ubicacion"),
    ("¿qué hora es en chile?", "hora"),
    ("¿cómo se juega snake?", "jugar_snake"),
]


@pytest.fixture(scope="module")
def intenciones():
    return entrenar.cargar_conocimiento()


@pytest.fixture(scope="module")
def modelo_exportado(tmp_path_factory):
    salida = tmp_path_factory.mktemp("modelo") / "modelo.json"
    entrenar.main(["--salida", str(salida), "--rapido"])
    return salida


@pytest.fixture(scope="module")
def red(intenciones):
    pares, _ = entrenar.preparar(intenciones, entrenar.SEMILLA, 0.0)
    modelo, _ = entrenar.entrenar_red(pares, len(intenciones), entrenar.SEMILLA)
    return modelo


def test_conocimiento_valido(intenciones):
    ids = {i["id"] for i in intenciones}
    assert "fuera_de_tema" in ids
    for intencion in intenciones:
        assert len(intencion["ejemplos"]) >= 6, intencion["id"]


def test_normalizar_quita_tildes_y_signos():
    assert normalizar("¿Qué ESTUDIASTE, Gervasio?") == "que estudiaste gervasio"
    assert normalizar("Holaaaa, siiii!!") == "hola si"


def test_traduce_chilenismos():
    mapa = chilenismos()
    texto = traducir(normalizar("Oe wn, ¿teni pega po? ¿Cuántas lucas pides al tiro?").split(), mapa)
    assert texto == "oye tienes trabajo cuantas dinero pides inmediatamente".split()


def test_vector_normalizado():
    v = vector("¿qué tecnologías usas?")
    assert v and abs(sum(x * x for x in v.values()) - 1) < 1e-9
    assert vector("¿¿??") == {}


def test_generaliza_a_preguntas_nuevas(red, intenciones):
    ids = [i["id"] for i in intenciones]
    prob = red.predecir(entrenar.a_matriz([p for p, _ in PREGUNTAS_NUEVAS]))
    aciertos = [ids[k] == esperado for k, (_, esperado) in zip(prob.argmax(axis=1), PREGUNTAS_NUEVAS)]
    fallas = [(p, ids[k]) for k, (p, _), ok in zip(prob.argmax(axis=1), PREGUNTAS_NUEVAS, aciertos) if not ok]
    assert np.mean(aciertos) >= 0.85, f"Falló: {fallas}"


@pytest.mark.skipif(shutil.which("node") is None, reason="requiere Node.js")
def test_paridad_con_javascript():
    textos = [
        "¿Qué tecnologías usas?",
        "Háblame de TaskFlow y ReservaYa",
        "¿cuánto es 2 más 2?",
        "ñandú pingüino acción",
        "",
        "¿sabes C# / .NET?",
        "oe wn, ¿teni pega po? ¿cuántas lucas pides al tiro?",
        "¿cachai de bases de datos? la raja tu portafolio",
    ]
    script = (
        "const r = require(process.argv[1]);"
        "const textos = JSON.parse(process.argv[2]);"
        "const mapa = JSON.parse(process.argv[3]);"
        "console.log(JSON.stringify(textos.map(t => Object.fromEntries(r.vector(t, 2048, mapa)))));"
    )
    salida = subprocess.run(
        ["node", "-e", script, str(RED_JS), json.dumps(textos), json.dumps(chilenismos())],
        check=True, capture_output=True, text=True,
    ).stdout
    desde_js = json.loads(salida)
    for texto, js in zip(textos, desde_js):
        py = vector(texto)
        assert {int(k) for k in js} == set(py), texto
        for k, valor in js.items():
            assert abs(valor - py[int(k)]) < 1e-6, texto


@pytest.mark.skipif(shutil.which("node") is None, reason="requiere Node.js")
def test_modelo_exportado_responde_igual_en_javascript(modelo_exportado):
    salida = modelo_exportado
    modelo = json.loads(salida.read_text(encoding="utf-8"))
    from caracteristicas import fnv1a

    assert format(fnv1a(normalizar("¿qué tecnologías usas?")), "08x") in modelo["huellas"]
    assert modelo["metricas"]["exactitud_entrenamiento"] > 0.95
    script = (
        "const r = require(process.argv[1]);"
        "const m = require(process.argv[2]);"
        "const red = r.crear(m);"
        "const preguntas = JSON.parse(process.argv[3]);"
        "console.log(JSON.stringify(preguntas.map(p => red.predecir(p).resultado[0].intencion.id)));"
    )
    preguntas = [p for p, _ in PREGUNTAS_NUEVAS]
    ids_js = json.loads(
        subprocess.run(
            ["node", "-e", script, str(RED_JS), str(salida), json.dumps(preguntas)],
            check=True, capture_output=True, text=True,
        ).stdout
    )
    esperados = [e for _, e in PREGUNTAS_NUEVAS]
    assert np.mean([a == b for a, b in zip(ids_js, esperados)]) >= 0.85


def test_exporta_botones_formales_y_registro_informal():
    from caracteristicas import informales

    intenciones = {i["id"]: entrenar.exportar_intencion(i) for i in entrenar.cargar_conocimiento()}
    assert intenciones["stack"]["pregunta"] == "¿Qué tecnologías domina?"
    assert intenciones["stack"]["pregunta_informal"] != intenciones["stack"]["pregunta"]
    assert "usted" in intenciones["saludo"]["respuesta"] or "le puedo" in intenciones["saludo"]["respuesta"]
    assert "respuesta_informal" in intenciones["saludo"]
    marcas = set(informales())
    assert {"cachai", "po", "xq"} <= marcas and "cv" not in marcas and "js" not in marcas


@pytest.mark.skipif(shutil.which("node") is None, reason="requiere Node.js")
def test_detecta_tono_informal_en_javascript(modelo_exportado):
    salida = modelo_exportado
    script = (
        "const r = require(process.argv[1]); const red = r.crear(require(process.argv[2]));"
        "const t = JSON.parse(process.argv[3]); console.log(JSON.stringify(t.map(x => red.esInformal(x))));"
    )
    textos = ["¿Qué tecnologías domina?", "¿Tiene experiencia con CV y JS?", "cachai de react po", "holaaaa", "jajaja ok", "q lenguajes sabi"]
    resultado = json.loads(
        subprocess.run(["node", "-e", script, str(RED_JS), str(salida), json.dumps(textos)], check=True, capture_output=True, text=True).stdout
    )
    assert resultado == [False, False, True, True, True, True]

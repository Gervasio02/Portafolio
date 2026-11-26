import json

import pytest
from fastapi.testclient import TestClient

from app import asistente_ia
from app.asistente_ia import construir_contexto
from app.main import create_app

ORIGEN = {"Origin": "https://gervasio.sbs", "Content-Type": "text/plain"}
URL = "/api/asistente/ia"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT", "off")
    monkeypatch.delenv("ANALITICA_DB_URL", raising=False)
    monkeypatch.delenv("ASISTENTE_IA_CLAVE", raising=False)
    # El contexto no se descarga en las pruebas.
    monkeypatch.setattr(asistente_ia.Contexto, "obtener", lambda self: "- Soy Gervasio, desarrollador full stack.")
    return TestClient(create_app(str(tmp_path / "a.db"), targets={"demo": "http://x"}))


def pregunta(texto="¿cuál es la capital de francia?"):
    return json.dumps({"pregunta": texto})


def test_sin_clave_responde_503(client):
    respuesta = client.post(URL, content=pregunta(), headers=ORIGEN)
    assert respuesta.status_code == 503
    assert respuesta.headers["access-control-allow-origin"] == "https://gervasio.sbs"


def test_responde_con_el_modelo_y_el_contexto(client, monkeypatch):
    monkeypatch.setenv("ASISTENTE_IA_CLAVE", "clave-falsa")
    recibido = {}

    def falso(mensajes, clave, modelo):
        recibido.update(mensajes=mensajes, clave=clave, modelo=modelo)
        return "<think>pienso</think>París. ¿Te cuento algo del portafolio?"

    monkeypatch.setattr(asistente_ia, "llamar_modelo", falso)
    datos = client.post(URL, content=pregunta(), headers=ORIGEN).json()
    assert datos["respuesta"] == "París. ¿Te cuento algo del portafolio?"
    assert "Soy Gervasio" in recibido["mensajes"][0]["content"]
    assert recibido["mensajes"][1]["content"] == "¿cuál es la capital de francia?"
    assert recibido["clave"] == "clave-falsa"


def test_valida_origen_y_pregunta(client, monkeypatch):
    monkeypatch.setenv("ASISTENTE_IA_CLAVE", "clave-falsa")
    assert client.post(URL, content=pregunta(), headers={"Origin": "https://malo.example"}).status_code == 403
    assert client.post(URL, content=pregunta("x"), headers=ORIGEN).status_code == 422
    assert client.post(URL, content="x" * 2000, headers=ORIGEN).status_code == 413


def test_limite_diario_por_persona(client, monkeypatch):
    # RATE_LIMIT=off desactiva el límite por minuto; el diario siempre aplica.
    monkeypatch.setenv("ASISTENTE_IA_CLAVE", "clave-falsa")
    monkeypatch.setattr(asistente_ia, "llamar_modelo", lambda *a: "ok")
    codigos = [client.post(URL, content=pregunta(), headers=ORIGEN).status_code for _ in range(42)]
    assert codigos[:40] == [200] * 40 and codigos[40:] == [429, 429]


def test_error_del_proveedor_devuelve_502(client, monkeypatch):
    monkeypatch.setenv("ASISTENTE_IA_CLAVE", "clave-falsa")

    def falla(*a):
        raise asistente_ia.httpx.ConnectError("sin red")

    monkeypatch.setattr(asistente_ia, "llamar_modelo", falla)
    assert client.post(URL, content=pregunta(), headers=ORIGEN).status_code == 502


def test_contexto_usa_las_respuestas_del_modelo_publicado():
    modelo = {"intenciones": [
        {"id": "saludo", "respuesta": "¡Hola!"},
        {"id": "cv", "respuesta": "Mira mi [CV](cv.html) hoy {fecha}."},
    ]}
    assert construir_contexto(modelo) == "- Mira mi CV hoy ."


def test_si_no_hay_acceso_a_un_modelo_prueba_el_siguiente(client, monkeypatch):
    monkeypatch.setenv("ASISTENTE_IA_CLAVE", "clave-falsa")
    monkeypatch.delenv("ASISTENTE_IA_MODELO", raising=False)
    usados = []

    def falso(mensajes, clave, modelo):
        usados.append(modelo)
        if modelo == "llama-3.3-70b-versatile":
            peticion = asistente_ia.httpx.Request("POST", asistente_ia.URL_GROQ)
            cuerpo = '{"error":{"code":"model_not_found","message":"The model does not exist"}}'
            respuesta = asistente_ia.httpx.Response(404, text=cuerpo, request=peticion)
            raise asistente_ia.httpx.HTTPStatusError("404", request=peticion, response=respuesta)
        return "Hola desde otro modelo."

    monkeypatch.setattr(asistente_ia, "llamar_modelo", falso)
    datos = client.post(URL, content=pregunta(), headers=ORIGEN).json()
    assert datos == {"respuesta": "Hola desde otro modelo.", "modelo": "openai/gpt-oss-120b"}
    client.post(URL, content=pregunta(), headers=ORIGEN)
    assert usados == ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-120b"]

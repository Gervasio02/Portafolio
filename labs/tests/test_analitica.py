import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.analitica import resumir
from app.main import create_app

ORIGEN = {"Origin": "https://gervasio.sbs", "Content-Type": "text/plain"}


def evento(**cambios):
    base = {
        "tipo": "vista",
        "ruta": "/",
        "sesion": "sesion-prueba-1",
        "dispositivo": "movil",
        "idioma": "es-CL",
        "referente": "https://www.linkedin.com/feed/",
    }
    base.update(cambios)
    return json.dumps(base)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("PANEL_CLAVE", "clave-de-prueba")
    monkeypatch.setenv("RATE_LIMIT", "off")
    monkeypatch.delenv("ANALITICA_DB_URL", raising=False)
    return TestClient(create_app(str(tmp_path / "a.db"), targets={"demo": "http://x"}))


def autorizado(clave="clave-de-prueba"):
    return {"Authorization": f"Bearer {clave}", "Origin": "https://gervasio.sbs"}


def test_registra_vistas_y_clics_y_resume(client):
    assert client.post("/api/visitas", content=evento(), headers=ORIGEN).status_code == 204
    assert client.post("/api/visitas", content=evento(sesion="sesion-prueba-2", dispositivo="escritorio"), headers=ORIGEN).status_code == 204
    clic = evento(
        tipo="clic",
        destino="https://taskflow-gervasio-std.example.azurecontainerapps.io/",
        etiqueta="Abrir la app",
    )
    assert client.post("/api/visitas", content=clic, headers=ORIGEN).status_code == 204
    cv = evento(tipo="clic", destino="https://gervasio.sbs/cv/Gervasio-Torres-CV.pdf", etiqueta="Descargar CV")
    client.post("/api/visitas", content=cv, headers=ORIGEN)

    datos = client.get("/api/panel/resumen", headers=autorizado()).json()
    assert datos["totales"]["vistas_hoy"] == 2
    assert datos["totales"]["sesiones_hoy"] == 2
    assert datos["totales"]["clics_periodo"] == 2
    assert dict(datos["acciones"]) == {"app": 1, "cv": 1}
    assert datos["proyectos"][0]["proyecto"] == "taskflow"
    assert dict(datos["referentes"]) == {"www.linkedin.com": 2}
    assert dict(datos["dispositivos"]) == {"movil": 1, "escritorio": 1}
    assert len(datos["por_dia"]) == 30
    assert datos["recientes"][0]["tipo"] == "clic"


def test_rechaza_origenes_ajenos_y_eventos_invalidos(client):
    ajeno = {"Origin": "https://otro-sitio.com"}
    assert client.post("/api/visitas", content=evento(), headers=ajeno).status_code == 403
    assert client.post("/api/visitas", content=evento(), headers={}).status_code == 403
    assert client.post("/api/visitas", content=evento(tipo="borrar"), headers=ORIGEN).status_code == 422
    assert client.post("/api/visitas", content=evento(ruta="https://x"), headers=ORIGEN).status_code == 422
    assert client.post("/api/visitas", content="no es json", headers=ORIGEN).status_code == 400
    assert client.post("/api/visitas", content="x" * 3000, headers=ORIGEN).status_code == 413


def test_no_guarda_referente_propio_ni_dispositivo_desconocido(client):
    client.post(
        "/api/visitas",
        content=evento(referente="https://gervasio.sbs/proyectos/", dispositivo="nevera"),
        headers=ORIGEN,
    )
    datos = client.get("/api/panel/resumen", headers=autorizado()).json()
    assert dict(datos["referentes"]) == {"directo": 1}
    assert dict(datos["dispositivos"]) == {"desconocido": 1}


def test_panel_exige_clave_y_limita_intentos(client):
    assert client.get("/api/panel/resumen").status_code == 401
    for _ in range(4):
        assert client.get("/api/panel/resumen", headers=autorizado("mala")).status_code == 401
    assert client.get("/api/panel/resumen", headers=autorizado("mala")).status_code == 429
    # Bloqueado incluso con la clave correcta hasta que pase la ventana.
    assert client.get("/api/panel/resumen", headers=autorizado()).status_code == 429


def test_panel_sin_clave_configurada(tmp_path, monkeypatch):
    monkeypatch.delenv("PANEL_CLAVE", raising=False)
    c = TestClient(create_app(str(tmp_path / "b.db"), targets={"demo": "http://x"}))
    assert c.get("/api/panel/resumen", headers=autorizado()).status_code == 503


def test_cors_solo_para_la_portada(client):
    r = client.options("/api/panel/resumen", headers={"Origin": "https://gervasio.sbs"})
    assert r.headers["access-control-allow-origin"] == "https://gervasio.sbs"
    r = client.options("/api/panel/resumen", headers={"Origin": "https://malicioso.com"})
    assert "access-control-allow-origin" not in r.headers


def test_visitas_funcionan_con_modo_invitado(tmp_path, monkeypatch):
    monkeypatch.setenv("LABS_GUEST_MODE", "on")
    monkeypatch.setenv("PANEL_CLAVE", "clave-de-prueba")
    c = TestClient(create_app(str(tmp_path / "g.db"), targets={"demo": "http://x"}))
    assert c.post("/api/visitas", content=evento(), headers=ORIGEN).status_code == 204
    assert c.get("/api/panel/resumen", headers=autorizado()).status_code == 200
    assert c.get("/api/datasets").status_code == 401


def test_resumen_cuenta_por_dia_en_hora_de_chile():
    ahora = datetime(2026, 11, 26, 2, 30, tzinfo=timezone.utc)  # 23:30 del 25 en Chile
    eventos = [
        {"creado": (ahora - timedelta(minutes=10)).isoformat(), "sesion": "a", "tipo": "vista", "ruta": "/",
         "destino": "", "etiqueta": "", "referente": "", "dispositivo": "movil", "idioma": "es"},
        {"creado": (ahora - timedelta(days=2)).isoformat(), "sesion": "b", "tipo": "vista", "ruta": "/cv.html",
         "destino": "", "etiqueta": "", "referente": "", "dispositivo": "escritorio", "idioma": "es"},
    ]
    datos = resumir(eventos, 7, ahora)
    assert datos["por_dia"][-1] == {"dia": "2026-11-25", "vistas": 1, "sesiones": 1}
    assert datos["totales"]["activos_5min"] == 0
    assert datos["totales"]["vistas_7d"] == 2


def pregunta(**cambios):
    base = {"pregunta": "¿sabes kotlin?", "intencion": "stack", "confianza": 0.31, "motivo": "sin_respuesta", "ruta": "/"}
    base.update(cambios)
    return json.dumps(base)


def test_guarda_preguntas_del_asistente_y_las_muestra_en_el_panel(client):
    url = "/api/asistente/preguntas"
    assert client.post(url, content=pregunta(), headers=ORIGEN).status_code == 204
    assert client.post(url, content=pregunta(pregunta="¿Sabes   Kotlin?"), headers=ORIGEN).status_code == 204
    otra = pregunta(pregunta="¿qué edad tienes?", motivo="no_sirvio", intencion="datos_personales", confianza=0.9)
    assert client.post(url, content=otra, headers=ORIGEN).status_code == 204

    asistente = client.get("/api/panel/resumen", headers=autorizado()).json()["asistente"]
    assert asistente["total"] == 3
    assert asistente["sin_respuesta"] == 2 and asistente["no_sirvio"] == 1
    assert asistente["frecuentes"][0] == ["¿sabes kotlin?", 2]
    assert asistente["recientes"][0]["motivo"] == "no_sirvio"


def test_rechaza_preguntas_invalidas_o_de_otro_origen(client):
    url = "/api/asistente/preguntas"
    assert client.post(url, content=pregunta(), headers={"Origin": "https://malo.example"}).status_code == 403
    assert client.post(url, content=pregunta(motivo="otro"), headers=ORIGEN).status_code == 422
    assert client.post(url, content=pregunta(pregunta=""), headers=ORIGEN).status_code == 422
    assert client.post(url, content="x" * 2000, headers=ORIGEN).status_code == 413
    preflight = client.options(url, headers={"Origin": "https://gervasio.sbs", "Access-Control-Request-Method": "POST"})
    assert preflight.headers["access-control-allow-origin"] == "https://gervasio.sbs"


def test_limpia_parametros_de_prisma():
    from app.analitica import limpiar_url

    url = "postgresql://u:p@servidor:5432/base?schema=public&sslmode=require&connection_limit=5"
    assert limpiar_url(url) == "postgresql://u:p@servidor:5432/base?sslmode=require"


def test_si_postgres_no_responde_usa_sqlite(tmp_path, monkeypatch):
    monkeypatch.setenv("ANALITICA_DB_URL", "postgresql://nadie:nada@127.0.0.1:1/base?connect_timeout=1")
    monkeypatch.setenv("PANEL_CLAVE", "clave-de-prueba")
    monkeypatch.setenv("RATE_LIMIT", "off")
    cliente = TestClient(create_app(str(tmp_path / "a.db"), targets={"demo": "http://x"}))
    assert cliente.post("/api/visitas", content=evento(), headers=ORIGEN).status_code == 204
    assert cliente.get("/api/panel/resumen", headers=autorizado()).json()["totales"]["vistas_hoy"] == 1

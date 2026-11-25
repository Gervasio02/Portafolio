from fastapi.testclient import TestClient

from app import limites
from app.main import app


def test_limita_registros_por_ip(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT", "on")
    monkeypatch.setattr(limites, "limitador", limites.Limitador())
    client = TestClient(app)
    cabeceras = {"X-Forwarded-For": "203.0.113.7"}
    codigos = [
        client.post(
            "/auth/register",
            json={"username": f"limite_{i}", "password": "clave-segura-1"},
            headers=cabeceras,
        ).status_code
        for i in range(6)
    ]
    assert codigos[:5] == [200] * 5
    assert codigos[5] == 429
    # Otra IP no queda afectada.
    otra = client.post(
        "/auth/register",
        json={"username": "limite_otra", "password": "clave-segura-1"},
        headers={"X-Forwarded-For": "203.0.113.8"},
    )
    assert otra.status_code == 200


def test_cabeceras_de_seguridad():
    respuesta = TestClient(app).get("/health")
    assert respuesta.headers["x-content-type-options"] == "nosniff"
    assert respuesta.headers["x-frame-options"] == "DENY"

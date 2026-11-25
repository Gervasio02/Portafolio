from fastapi.testclient import TestClient
from app.main import app
from app import main
from sqlalchemy.exc import OperationalError
import pytest


def test_guest_game_flow():
    c = TestClient(app)
    token = c.post("/auth/guest").json()["token"]
    h = {"Authorization": "Bearer " + token}
    game = c.post("/games", json={"seed": 42, "difficulty": "facil"}, headers=h).json()
    result = c.post(
        f"/games/{game['id']}/question",
        json={"suspect_id": 0, "message": "¿Dónde estabas?"},
        headers=h,
    )
    assert result.status_code == 200 and "data:" in result.text
    result = c.post(f"/games/{game['id']}/accuse", json={"suspect_id": 0}, headers=h)
    assert result.status_code == 200 and "timeline" in result.json()
    assert c.get(f"/games/{game['id']}").status_code == 401


def test_readiness_checks_database(monkeypatch):
    client = TestClient(app)
    assert client.get("/ready").status_code == 200

    def unavailable():
        raise OperationalError("SELECT 1", {}, Exception("unavailable"))

    monkeypatch.setattr(main.engine, "connect", unavailable)
    response = client.get("/ready")
    assert response.status_code == 503
    assert "unavailable" not in response.text


def test_production_requires_strong_configured_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    for secret in ("", "solo-desarrollo-cambiar-antes-de-desplegar", "short"):
        monkeypatch.setenv("JWT_SECRET", secret)
        with pytest.raises(RuntimeError):
            main.signing_secret()
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    assert main.signing_secret() == "x" * 32


def test_development_secret_is_not_predictable(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.warns(RuntimeWarning):
        first = main.signing_secret()
    with pytest.warns(RuntimeWarning):
        second = main.signing_secret()
    assert first != second

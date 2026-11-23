import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from threading import Barrier
from urllib.parse import urlsplit

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from alembic import command
from app.main import create_app
from app.seed import seed
from app.settings import Settings, normalise_database_url
from app.time_slots import CHILE, db_utc, slot_time

PASSWORD = "Demo-reserva-2026"
ADMIN_EMAIL = "admin@reservaya.test"
SECRET = "local-tests-only-do-not-use-in-production"
DAY = (datetime.now(CHILE).date() + timedelta(days=2)).isoformat()


@pytest.fixture(scope="session")
def settings():
    url = os.getenv("RESERVAYA_TEST_DATABASE_URL")
    if not url:
        pytest.fail("Configura RESERVAYA_TEST_DATABASE_URL con una base PostgreSQL de pruebas.")
    assert urlsplit(url).path.endswith("_test"), "Usa una base aislada cuyo nombre termine en _test."
    return Settings(normalise_database_url(url), SECRET, False)


@pytest.fixture()
def app(settings, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", settings.database_url)
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    engine = create_engine(settings.database_url)
    with Session(engine) as session:
        seed(session, PASSWORD, ADMIN_EMAIL, PASSWORD)
    engine.dispose()
    return create_app(settings)


def login(client, email="cliente@reservaya.test", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def signup(client, email="nuevo@example.com"):
    return client.post("/api/auth/register", json={"email": email, "name": "Camila", "password": PASSWORD})


def reserve(client, service_id=1, hour=9):
    return client.post("/api/bookings", json={"service_id": service_id, "day": DAY, "hour": hour})


def test_health_openapi_and_public_list(app):
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"ok": True}
        assert client.get("/api/docs").status_code == 200
        assert "409" in client.get("/api/openapi.json").json()["paths"]["/api/bookings"]["post"]["responses"]
        services = client.get("/api/services").json()
        assert len(services) == 3 and services[0]["price"] == 24000
        assert client.get(f"/api/services/200/availability?day={DAY}").status_code == 404
        assert client.get("/api/services/1/availability?day=2010-01-01").status_code == 422
        assert client.get(f"/api/services/1/availability?day={DAY}").json()["slots"][1] == {
            "hour": 9,
            "available": True,
            "status": "available",
        }


def test_auth_protects_client_and_admin(app):
    with TestClient(app) as client:
        assert reserve(client).status_code == 401
        assert login(client, password="incorrecto").status_code == 401
        assert login(client, email="missing@example.com").status_code == 401
        response = signup(client, "NUEVO@example.com")
        assert response.status_code == 201
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        assert client.get("/api/auth/me").json()["email"] == "nuevo@example.com"
        assert client.get("/api/admin/bookings").status_code == 403
        assert signup(client).status_code == 409
        assert client.post("/api/auth/logout").status_code == 204
        assert client.get("/api/auth/me").status_code == 401
        client.cookies.set("reservaya_session", "bad-token", path="/api")
        assert client.get("/api/auth/me").status_code == 401


def test_admin_occupancy_excludes_blocked_slots_and_cancelled_bookings(app):
    with TestClient(app) as client, TestClient(app) as admin:
        assert login(client).status_code == 200
        assert client.get(f"/api/admin/occupancy?day={DAY}").status_code == 403
        assert login(admin, ADMIN_EMAIL).status_code == 200
        route = f"/api/admin/occupancy?day={DAY}&court_id=1"
        before = admin.get(route).json()
        booking = reserve(client, hour=9).json()
        after = admin.get(route).json()
        assert after["occupied"] == before["occupied"] + 1
        assert after["bookable"] == before["bookable"]
        assert client.delete(f"/api/bookings/{booking['id']}").status_code == 200
        assert admin.get(route).json()["occupied"] == before["occupied"]
        block = admin.post(
            "/api/admin/courts/1/blocks", json={"day": DAY, "hour": 9, "reason": "Mantenimiento"}
        )
        assert block.status_code == 201
        blocked = admin.get(route).json()
        assert blocked["blocked"] == before["blocked"] + 1
        assert blocked["bookable"] == before["bookable"] - 1
        assert admin.get(f"/api/admin/occupancy?day={DAY}&court_id=9999").status_code == 404


def test_booking_cancellation_releases_slot_and_preserves_history(app):
    with TestClient(app) as client, TestClient(app) as other:
        assert login(client).status_code == 200
        assert signup(other).status_code == 201
        result = reserve(client)
        assert result.status_code == 201
        booking = result.json()
        assert booking["price"] == 24000 and booking["status"] == "confirmed"
        assert reserve(other).status_code == 409
        assert other.delete(f"/api/bookings/{booking['id']}").status_code == 404
        assert client.get("/api/bookings").json() == [booking]
        assert client.delete(f"/api/bookings/{booking['id']}").json()["status"] == "cancelled"
        assert client.delete(f"/api/bookings/{booking['id']}").json()["status"] == "cancelled"
        assert reserve(other).status_code == 201


def test_two_simultaneous_requests_yield_exactly_one_booking(app):
    with TestClient(app) as first, TestClient(app) as second:
        assert signup(first, "uno@example.com").status_code == 201
        assert signup(second, "dos@example.com").status_code == 201
        barrier = Barrier(2)

        def submit(client):
            barrier.wait(timeout=5)
            return reserve(client).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(submit, [first, second]))
        assert sorted(results) == [201, 409]
        assert sum(len(client.get("/api/bookings").json()) for client in [first, second]) == 1


def test_two_services_share_same_court_lock(app):
    with TestClient(app) as admin, TestClient(app) as client:
        assert login(admin, ADMIN_EMAIL).status_code == 200
        data = {
            "name": "Fútbol tarde",
            "sport": "futbol",
            "description": "Tarifa especial",
            "price": 18000,
            "court_id": 1,
            "active": True,
        }
        extra = admin.post("/api/admin/services", json=data)
        assert extra.status_code == 201
        extra_id = extra.json()["id"]
        assert admin.get("/api/admin/services").status_code == 200
        assert admin.put(f"/api/admin/services/{extra_id}", json={**data, "court_id": 2}).status_code == 422
        assert login(client).status_code == 200
        assert reserve(client).status_code == 201
        assert reserve(client, extra_id).status_code == 409
        assert admin.put(f"/api/admin/services/{extra_id}", json={**data, "active": False}).status_code == 200
        assert all(item["id"] != extra_id for item in client.get("/api/services").json())
        assert reserve(client, extra_id).status_code == 404


def test_admin_block_prevents_reserving_and_can_be_removed(app):
    with TestClient(app) as admin, TestClient(app) as client:
        assert login(admin, ADMIN_EMAIL).status_code == 200
        assert login(client).status_code == 200
        assert len(admin.get("/api/admin/courts").json()) == 3
        url = "/api/admin/courts/1/blocks"
        block = {"day": DAY, "hour": 9, "reason": "Mantención"}
        saved = admin.post(url, json=block)
        assert saved.status_code == 201
        assert admin.post(url, json=block).status_code == 409
        assert reserve(client).status_code == 409
        availability = f"/api/services/1/availability?day={DAY}"
        assert client.get(availability).json()["slots"][1] == {
            "hour": 9,
            "available": False,
            "status": "blocked",
        }
        assert admin.get(url).json() == [saved.json()]
        block_url = f"/api/admin/blocks/{saved.json()['id']}"
        assert admin.delete(block_url).status_code == 204
        assert admin.delete(block_url).status_code == 404
        reservation = reserve(client)
        assert reservation.status_code == 201
        assert client.get(availability).json()["slots"][1] == {
            "hour": 9,
            "available": False,
            "status": "booked",
        }
        assert admin.post(url, json=block).status_code == 409
        assert len(admin.get("/api/admin/bookings").json()) == 1
        assert admin.delete(f"/api/bookings/{reservation.json()['id']}").status_code == 200
        assert admin.post(url, json=block).status_code == 201


def test_concurrent_booking_and_block_never_coexist(app):
    with TestClient(app) as admin, TestClient(app) as client:
        assert login(admin, ADMIN_EMAIL).status_code == 200
        assert login(client).status_code == 200
        barrier = Barrier(2)

        def block():
            barrier.wait(timeout=5)
            return admin.post("/api/admin/courts/1/blocks", json={"day": DAY, "hour": 9, "reason": "Evento"})

        def book():
            barrier.wait(timeout=5)
            return reserve(client)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(block), pool.submit(book)]
            results = [future.result(timeout=10).status_code for future in futures]
        assert sorted(results) == [201, 409]


def test_admin_can_change_weekly_schedule(app):
    with TestClient(app) as admin, TestClient(app) as client:
        assert login(admin, ADMIN_EMAIL).status_code == 200
        assert login(client).status_code == 200
        weekday = date.fromisoformat(DAY).weekday()
        url = "/api/admin/courts/1/schedule"
        assert admin.put(url, json={"weekday": weekday, "hours": [20, 8, 8]}).json()["hours"] == [8, 20]
        assert admin.get(url).json()[weekday]["hours"] == [8, 20]
        available = client.get(f"/api/services/1/availability?day={DAY}").json()
        assert available["slots"] == [
            {"hour": 8, "available": True, "status": "available"},
            {"hour": 20, "available": True, "status": "available"},
        ]
        assert reserve(client).status_code == 409
        assert reserve(client, hour=20).status_code == 201
        assert (
            admin.put("/api/admin/courts/999/schedule", json={"weekday": weekday, "hours": []}).status_code
            == 404
        )
        assert admin.put(url, json={"weekday": weekday, "hours": [23]}).status_code == 422


def test_chile_summer_and_winter_offset_and_serializer():
    assert slot_time(date(2027, 1, 5), 18).hour == 21
    assert slot_time(date(2027, 7, 5), 18).hour == 22
    assert db_utc(datetime(2027, 1, 5, 21)).tzinfo is UTC
    assert normalise_database_url("postgres://hi") == "postgresql+psycopg://hi"


def test_peak_tariffs_and_private_receipt_keep_the_confirmed_price(app):
    with TestClient(app) as client, TestClient(app) as other, TestClient(app) as admin:
        assert login(client).status_code == 200
        assert signup(other).status_code == 201
        assert login(admin, ADMIN_EMAIL).status_code == 200
        rates = client.get(f"/api/services/1/availability?day={DAY}").json()["rates"]
        assert rates["9"] == 24000
        assert rates["18"] == 28800
        booking = reserve(client, hour=18).json()
        assert booking["price"] == 28800
        route = f"/api/bookings/{booking['id']}/receipt"
        assert other.get(route).status_code == 404
        assert TestClient(app).get(route).status_code == 401
        service = admin.get("/api/admin/services").json()[0]
        service["price"] = 50000
        assert admin.put("/api/admin/services/1", json=service).status_code == 200
        receipt = client.get(route).json()
        assert receipt["simulated"] is True
        assert receipt["booking"]["price"] == 28800
        assert admin.get(route).status_code == 200
        assert client.delete(f"/api/bookings/{booking['id']}").status_code == 200
        assert client.get(route).json()["booking"]["status"] == "cancelled"


def test_peak_tariff_boundaries():
    from app.time_slots import slot_price

    assert [slot_price(24000, hour) for hour in [17, 18, 21, 22]] == [24000, 28800, 28800, 24000]

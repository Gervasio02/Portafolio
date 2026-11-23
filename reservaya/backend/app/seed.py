import os

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from .auth import passwords
from .models import Court, Schedule, Service, User
from .settings import normalise_database_url

COURTS = [
    (
        "Fútbol 5 | Cancha Norte",
        "Pastito Norte",
        "futbol",
        24000,
        "Pasto sintético, iluminación y camarines. Ideal para partidos entre amigos.",
    ),
    (
        "Pádel | Cancha Central",
        "Cristal Central",
        "padel",
        20000,
        "Cancha panorámica con muro de vidrio, césped rápido y arriendo de palas.",
    ),
    (
        "Tenis | Cancha Parque",
        "Club Parque",
        "tenis",
        16000,
        "Superficie dura, buena iluminación y acceso junto al parque.",
    ),
]


def seed(
    session: Session,
    demo_password: str | None,
    admin_email: str | None = None,
    admin_password: str | None = None,
) -> None:
    if not session.scalar(select(func.count(Court.id))):
        for court_name, name, sport, price, description in COURTS:
            court = Court(name=court_name)
            session.add(court)
            session.flush()
            session.add(
                Service(court_id=court.id, name=name, description=description, sport=sport, price=price)
            )
            session.add_all(
                [
                    Schedule(court_id=court.id, weekday=day, hour=hour)
                    for day in range(7)
                    for hour in range(8, 22 if day < 5 else 19)
                ]
            )
    accounts = []
    if demo_password:
        accounts.append(("cliente@reservaya.test", "Camila Rojas", "client", demo_password))
    if admin_email and admin_password:
        accounts.append((admin_email.lower(), "Administración", "admin", admin_password))
    for email, name, role, password in accounts:
        if len(password) < 10:
            raise ValueError("Las claves de seed requieren al menos 10 caracteres.")
        existing = session.scalar(select(User).where(User.email == email))
        if existing and existing.role != role:
            raise ValueError("El correo administrativo ya está registrado como cliente.")
        if not existing:
            session.add(User(email=email, name=name, role=role, password_hash=passwords.hash(password)))
    session.commit()


if __name__ == "__main__":
    engine = create_engine(normalise_database_url(os.environ["DATABASE_URL"]))
    with Session(engine) as session:
        seed(session, os.getenv("DEMO_PASSWORD"), os.getenv("ADMIN_EMAIL"), os.getenv("ADMIN_PASSWORD"))

import logging
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from starlette.staticfiles import StaticFiles

from .auth import COOKIE, DUMMY_HASH, passwords, session_id, set_session
from .models import Block, Booking, Court, Schedule, Service, User
from .schemas import (
    Account,
    AvailabilityOut,
    BlockData,
    BookingCreate,
    BookingOut,
    Login,
    ScheduleData,
    ServiceData,
    ServiceOut,
    SignUp,
    SlotOut,
)
from .settings import Settings
from .time_slots import available_day, db_utc, future_slot, now_utc, slot_price, slot_time

log = logging.getLogger("uvicorn.error")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.load()
    if len(settings.jwt_secret.encode()) < 32:
        raise ValueError("JWT_SECRET debe tener al menos 32 bytes.")

    engine = create_engine(settings.database_url, pool_pre_ping=True)
    sessions = sessionmaker(engine, expire_on_commit=False)
    app = FastAPI(
        title="ReservaYa API",
        description="Reserva canchas en franjas de una hora en la zona America/Santiago.",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    def db() -> Iterator[Session]:
        with sessions() as session:
            yield session

    DB = Annotated[Session, Depends(db)]

    def account(request: Request, session: DB) -> User:
        user = session.get(User, session_id(request, settings.jwt_secret))
        if user is None:
            raise HTTPException(401, "Sesión no válida.")
        return user

    AccountDep = Annotated[User, Depends(account)]

    def admin(user: AccountDep) -> User:
        if user.role != "admin":
            raise HTTPException(403, "Solo administración puede realizar esta acción.")
        return user

    AdminDep = Annotated[User, Depends(admin)]

    @app.get("/api/health", tags=["Sistema"])
    def health(session: DB) -> dict:
        session.execute(text("SELECT 1"))
        return {"ok": True}

    @app.post("/api/auth/register", response_model=Account, status_code=201, tags=["Sesión"])
    def register(data: SignUp, response: Response, session: DB) -> User:
        user = User(email=data.email.lower(), name=data.name, password_hash=passwords.hash(data.password))
        session.add(user)
        commit(session, "Ya existe una cuenta con ese correo.")
        set_session(response, settings.jwt_secret, user.id, settings.secure_cookies)
        return user

    @app.post("/api/auth/login", response_model=Account, tags=["Sesión"])
    def login(data: Login, response: Response, session: DB) -> User:
        user = session.scalar(select(User).where(User.email == data.email.lower()))
        valid = passwords.verify(data.password, user.password_hash if user else DUMMY_HASH)
        if not user or not valid:
            raise HTTPException(401, "Correo o contraseña incorrectos.")
        set_session(response, settings.jwt_secret, user.id, settings.secure_cookies)
        return user

    @app.post("/api/auth/logout", status_code=204, tags=["Sesión"])
    def logout(response: Response) -> None:
        response.delete_cookie(
            COOKIE, path="/api", httponly=True, secure=settings.secure_cookies, samesite="strict"
        )

    @app.get("/api/auth/me", response_model=Account, tags=["Sesión"])
    def me(user: AccountDep) -> User:
        return user

    @app.get("/api/services", response_model=list[ServiceOut], tags=["Disponibilidad"])
    def services(session: DB) -> list[ServiceOut]:
        return select_services(session, public=True)

    @app.get(
        "/api/services/{service_id}/availability",
        response_model=AvailabilityOut,
        tags=["Disponibilidad"],
    )
    def availability(service_id: int, day: date, session: DB) -> AvailabilityOut:
        available_day(day)
        service = get_service(session, service_id)
        hours = session.scalars(
            select(Schedule.hour)
            .where(Schedule.court_id == service.court_id, Schedule.weekday == day.weekday())
            .order_by(Schedule.hour)
        ).all()
        starts = [slot_time(day, hour) for hour in hours]
        reserved = session.scalars(
            select(Booking.starts_at).where(
                Booking.court_id == service.court_id,
                Booking.status == "confirmed",
                Booking.starts_at.in_(starts),
            )
        ).all()
        blocked = session.scalars(
            select(Block.starts_at).where(Block.court_id == service.court_id, Block.starts_at.in_(starts))
        ).all()
        reserved_times = {db_utc(value) for value in reserved}
        blocked_times = {db_utc(value) for value in blocked}
        now = now_utc()
        slots: list[SlotOut] = []
        for hour, starts_at in zip(hours, starts, strict=True):
            if starts_at <= now:
                status = "elapsed"
            elif starts_at in blocked_times:
                status = "blocked"
            elif starts_at in reserved_times:
                status = "booked"
            else:
                status = "available"
            slots.append(SlotOut(hour=hour, available=status == "available", status=status))
        return AvailabilityOut(
            day=day, slots=slots, rates={hour: slot_price(service.price, hour) for hour in hours}
        )

    @app.post(
        "/api/bookings",
        response_model=BookingOut,
        status_code=201,
        tags=["Reservas"],
        responses={409: {"description": "La franja ya fue reservada o bloqueada."}},
    )
    def book(data: BookingCreate, user: AccountDep, session: DB) -> BookingOut:
        starts_at = future_slot(data.day, data.hour)
        service = get_service(session, data.service_id)
        court = lock_court(session, service.court_id)
        session.refresh(service)
        if not service.active:
            raise HTTPException(404, "Servicio no disponible.")
        if not session.scalar(
            select(Schedule.id).where(
                Schedule.court_id == court.id,
                Schedule.weekday == data.day.weekday(),
                Schedule.hour == data.hour,
            )
        ):
            raise HTTPException(409, "Esta franja ya no está disponible.")
        if session.scalar(select(Block.id).where(Block.court_id == court.id, Block.starts_at == starts_at)):
            raise HTTPException(409, "Este horario está bloqueado.")
        reservation = Booking(
            user_id=user.id,
            service_id=service.id,
            court_id=court.id,
            starts_at=starts_at,
            created_at=now_utc(),
            price=slot_price(service.price, data.hour),
        )
        session.add(reservation)
        commit(session, "Otra persona ya reservó este horario.")
        log.info("confirmación de reserva simulada: reserva=%d", reservation.id)
        return as_booking(reservation, service.name, court.name)

    @app.get("/api/bookings/{booking_id}/receipt", tags=["Reservas"])
    def receipt(booking_id: int, user: AccountDep, session: DB) -> dict:
        query = select(Booking).where(Booking.id == booking_id)
        if user.role != "admin":
            query = query.where(Booking.user_id == user.id)
        reservation = session.scalar(query)
        if reservation is None:
            raise HTTPException(404, "Reserva no encontrada.")
        service = session.get(Service, reservation.service_id)
        court = session.get(Court, reservation.court_id)
        return {
            "reference": f"RY-{reservation.id}",
            "simulated": True,
            "booking": as_booking(reservation, service.name, court.name).model_dump(),
            "note": "Comprobante de reserva simulada, sin validez tributaria. El estado refleja la consulta actual.",
        }

    @app.get("/api/bookings", response_model=list[BookingOut], tags=["Reservas"])
    def bookings(user: AccountDep, session: DB) -> list[BookingOut]:
        return select_bookings(session, user.id)

    @app.delete("/api/bookings/{booking_id}", response_model=BookingOut, tags=["Reservas"])
    def cancel(booking_id: int, user: AccountDep, session: DB) -> BookingOut:
        query = select(Booking).where(Booking.id == booking_id)
        if user.role != "admin":
            query = query.where(Booking.user_id == user.id)
        reservation = session.scalar(query.with_for_update())
        if reservation is None:
            raise HTTPException(404, "Reserva no encontrada.")
        if reservation.status == "confirmed":
            if db_utc(reservation.starts_at) <= now_utc():
                raise HTTPException(409, "No se puede cancelar una reserva pasada.")
            reservation.status = "cancelled"
            session.commit()
        service = session.get(Service, reservation.service_id)
        court = session.get(Court, reservation.court_id)
        return as_booking(reservation, service.name, court.name)

    @app.get("/api/admin/bookings", response_model=list[BookingOut], tags=["Administración"])
    def list_admin_bookings(user: AdminDep, session: DB) -> list[BookingOut]:
        return select_bookings(session)

    @app.get("/api/admin/occupancy", tags=["Administración"])
    def occupancy(day: date, user: AdminDep, session: DB, court_id: int | None = None) -> dict:
        # A snapshot using today's configured schedule; later schedule changes can
        # alter historical reports, so this is not a historical capacity ledger.
        query = select(Schedule).where(Schedule.weekday == day.weekday())
        if court_id is not None:
            if session.get(Court, court_id) is None:
                raise HTTPException(404, "Cancha no encontrada.")
            query = query.where(Schedule.court_id == court_id)
        schedule = session.scalars(query).all()
        slots = {(item.court_id, slot_time(day, item.hour)) for item in schedule}
        times = {start for _, start in slots}
        court_ids = {court for court, _ in slots}
        blocked = {
            (item.court_id, db_utc(item.starts_at))
            for item in session.scalars(
                select(Block).where(Block.court_id.in_(court_ids), Block.starts_at.in_(times))
            )
        }
        reserved = {
            (item.court_id, db_utc(item.starts_at))
            for item in session.scalars(
                select(Booking).where(
                    Booking.court_id.in_(court_ids),
                    Booking.starts_at.in_(times),
                    Booking.status == "confirmed",
                )
            )
        }
        usable = slots - blocked
        occupied = len(usable & reserved)
        return {
            "day": day.isoformat(),
            "scheduled": len(slots),
            "blocked": len(slots & blocked),
            "bookable": len(usable),
            "occupied": occupied,
            "percentage": round(100 * occupied / len(usable), 1) if usable else None,
        }

    @app.get("/api/admin/courts", tags=["Administración"])
    def courts(user: AdminDep, session: DB) -> list[dict]:
        return [
            {"id": court.id, "name": court.name}
            for court in session.scalars(select(Court).order_by(Court.id))
        ]

    @app.get("/api/admin/services", response_model=list[ServiceOut], tags=["Administración"])
    def admin_services(user: AdminDep, session: DB) -> list[ServiceOut]:
        return select_services(session, public=False)

    @app.post("/api/admin/services", response_model=ServiceOut, status_code=201, tags=["Administración"])
    def create_service(data: ServiceData, user: AdminDep, session: DB) -> ServiceOut:
        court = lock_court(session, data.court_id)
        service = Service(**data.model_dump())
        session.add(service)
        session.commit()
        return as_service(service, court.name)

    @app.put("/api/admin/services/{service_id}", response_model=ServiceOut, tags=["Administración"])
    def update_service(service_id: int, data: ServiceData, user: AdminDep, session: DB) -> ServiceOut:
        service = get_service(session, service_id, public=False)
        if service.court_id != data.court_id:
            raise HTTPException(422, "Crea otro servicio para cambiar la cancha.")
        court = lock_court(session, data.court_id)
        for key, value in data.model_dump().items():
            setattr(service, key, value)
        session.commit()
        return as_service(service, court.name)

    @app.get(
        "/api/admin/courts/{court_id}/schedule", response_model=list[ScheduleData], tags=["Administración"]
    )
    def schedule(court_id: int, user: AdminDep, session: DB) -> list[ScheduleData]:
        rows = session.scalars(
            select(Schedule).where(Schedule.court_id == court_id).order_by(Schedule.weekday, Schedule.hour)
        ).all()
        return [
            ScheduleData(weekday=day, hours=[row.hour for row in rows if row.weekday == day])
            for day in range(7)
        ]

    @app.put("/api/admin/courts/{court_id}/schedule", response_model=ScheduleData, tags=["Administración"])
    def put_schedule(court_id: int, data: ScheduleData, user: AdminDep, session: DB) -> ScheduleData:
        lock_court(session, court_id)
        session.execute(
            delete(Schedule).where(Schedule.court_id == court_id, Schedule.weekday == data.weekday)
        )
        session.add_all([Schedule(court_id=court_id, weekday=data.weekday, hour=hour) for hour in data.hours])
        session.commit()
        return data

    @app.get("/api/admin/courts/{court_id}/blocks", tags=["Administración"])
    def blocks(court_id: int, user: AdminDep, session: DB) -> list[dict]:
        rows = session.scalars(
            select(Block)
            .where(Block.court_id == court_id, Block.starts_at > now_utc())
            .order_by(Block.starts_at)
        )
        return [{"id": row.id, "starts_at": db_utc(row.starts_at), "reason": row.reason} for row in rows]

    @app.post("/api/admin/courts/{court_id}/blocks", status_code=201, tags=["Administración"])
    def block(court_id: int, data: BlockData, user: AdminDep, session: DB) -> dict:
        starts_at = future_slot(data.day, data.hour)
        lock_court(session, court_id)
        if session.scalar(
            select(Booking.id).where(
                Booking.court_id == court_id, Booking.starts_at == starts_at, Booking.status == "confirmed"
            )
        ):
            raise HTTPException(409, "Cancela la reserva existente antes de bloquear.")
        item = Block(court_id=court_id, starts_at=starts_at, reason=data.reason)
        session.add(item)
        commit(session, "El horario ya está bloqueado.")
        return {"id": item.id, "starts_at": starts_at, "reason": item.reason}

    @app.delete("/api/admin/blocks/{block_id}", status_code=204, tags=["Administración"])
    def unblock(block_id: int, user: AdminDep, session: DB) -> None:
        item = session.get(Block, block_id)
        if item is None:
            raise HTTPException(404, "Bloqueo no encontrado.")
        lock_court(session, item.court_id)
        session.execute(delete(Block).where(Block.id == block_id))
        session.commit()

    site = Path(__file__).resolve().parent.parent / "public"
    if (site / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=site / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str) -> FileResponse:
            if path == "api" or path.startswith("api/"):
                raise HTTPException(404)
            return FileResponse(site / "index.html")

    return app


def commit(session: Session, message: str) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(409, message) from error


def get_service(session: Session, service_id: int, public: bool = True) -> Service:
    service = session.get(Service, service_id)
    if service is None or (public and not service.active):
        raise HTTPException(404, "Servicio no disponible.")
    return service


def lock_court(session: Session, court_id: int) -> Court:
    court = session.scalar(select(Court).where(Court.id == court_id).with_for_update())
    if court is None:
        raise HTTPException(404, "Cancha no encontrada.")
    return court


def as_booking(reservation: Booking, service: str, court: str) -> BookingOut:
    return BookingOut(
        id=reservation.id,
        service_id=reservation.service_id,
        service=service,
        court=court,
        starts_at=db_utc(reservation.starts_at),
        status=reservation.status,
        price=reservation.price,
    )


def select_bookings(session: Session, user_id: int | None = None) -> list[BookingOut]:
    query = (
        select(Booking, Service.name, Court.name)
        .join(Service, Service.id == Booking.service_id)
        .join(Court, Court.id == Booking.court_id)
        .order_by(Booking.starts_at.desc(), Booking.id.desc())
    )
    if user_id is not None:
        query = query.where(Booking.user_id == user_id)
    return [as_booking(booking, service, court) for booking, service, court in session.execute(query)]


def as_service(service: Service, court: str) -> ServiceOut:
    return ServiceOut(
        id=service.id, court=court, **ServiceData.model_validate(service, from_attributes=True).model_dump()
    )


def select_services(session: Session, public: bool) -> list[ServiceOut]:
    query = select(Service, Court.name).join(Court).order_by(Service.id)
    if public:
        query = query.where(Service.active)
    return [as_service(service, court) for service, court in session.execute(query)]

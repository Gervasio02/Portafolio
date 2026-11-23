from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

CHILE = ZoneInfo("America/Santiago")
MAX_ADVANCE = 60


def now_utc() -> datetime:
    return datetime.now(UTC)


def slot_time(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour, tzinfo=CHILE)).astimezone(UTC)


def db_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def available_day(day: date) -> None:
    today = now_utc().astimezone(CHILE).date()
    if not today <= day <= today + timedelta(days=MAX_ADVANCE):
        raise HTTPException(422, f"Elige una fecha dentro de los próximos {MAX_ADVANCE} días.")


def future_slot(day: date, hour: int) -> datetime:
    available_day(day)
    starts_at = slot_time(day, hour)
    if starts_at <= now_utc():
        raise HTTPException(422, "El horario ya pasó.")
    return starts_at


def slot_price(base_price: int, hour: int) -> int:
    """Demonstration tariff: 20% peak surcharge for starts between 18 and 21."""
    return (base_price * 120 + 50) // 100 if 18 <= hour <= 21 else base_price

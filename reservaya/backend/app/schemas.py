from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Email = Annotated[
    str,
    StringConstraints(max_length=254, strip_whitespace=True, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"),
]
Hour = Annotated[int, Field(ge=8, le=22)]
Weekday = Annotated[int, Field(ge=0, le=6)]
Sport = Literal["futbol", "padel", "tenis"]


class Login(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"email": "cliente@reservaya.test", "password": "tu-contraseña"}]}
    )
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=128)]


class SignUp(Login):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "Camila Pérez", "email": "camila@example.com", "password": "Una-clave-larga"}
            ]
        }
    )
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    password: Annotated[str, Field(min_length=10, max_length=128)]


class Account(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    role: Literal["client", "admin"]


class ServiceData(BaseModel):
    court_id: Annotated[int, Field(gt=0)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]
    sport: Sport
    price: Annotated[int, Field(ge=1, le=200000)]
    active: bool = True


class ServiceOut(ServiceData):
    model_config = ConfigDict(from_attributes=True)
    id: int
    court: str


class Slot(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"day": "2027-03-18", "hour": 18}]})
    day: date
    hour: Hour


class SlotOut(BaseModel):
    hour: int
    available: bool
    status: Literal["available", "booked", "blocked", "elapsed"]


class AvailabilityOut(BaseModel):
    day: date
    slots: list[SlotOut]
    rates: dict[int, int] = Field(default_factory=dict)


class BookingCreate(Slot):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"service_id": 1, "day": "2027-03-18", "hour": 18}]}
    )
    service_id: Annotated[int, Field(gt=0)]


class BookingOut(BaseModel):
    id: int
    service_id: int
    service: str
    court: str
    starts_at: datetime
    status: Literal["confirmed", "cancelled"]
    price: int


class ScheduleData(BaseModel):
    weekday: Weekday
    hours: Annotated[list[Hour], Field(max_length=15)]

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, hours: list[int]) -> list[int]:
        return sorted(set(hours))


class BlockData(Slot):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]

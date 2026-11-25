"""Límite de peticiones por IP, en memoria.

Suficiente para una sola réplica de demostración: protege el registro, el
inicio de sesión y las preguntas frente a abuso básico. Con varias réplicas
habría que moverlo a un almacenamiento compartido (por ejemplo, Redis).
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from threading import Lock

from starlette.requests import Request
from starlette.responses import JSONResponse

# (prefijo de ruta, método) -> (peticiones permitidas, ventana en segundos)
REGLAS: list[tuple[str, str, int, int]] = [
    ("/auth/register", "POST", 5, 60),
    ("/auth/login", "POST", 10, 60),
    ("/auth/guest", "POST", 20, 60),
    ("/games", "POST", 120, 60),
]
GLOBAL = (600, 60)


def activo() -> bool:
    return os.getenv("RATE_LIMIT", "on").lower() not in ("off", "0", "false")


class Limitador:
    def __init__(self) -> None:
        self._eventos: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def permitir(self, clave: tuple[str, str], limite: int, ventana: int) -> bool:
        ahora = time.monotonic()
        with self._lock:
            cola = self._eventos[clave]
            while cola and ahora - cola[0] > ventana:
                cola.popleft()
            if len(cola) >= limite:
                return False
            cola.append(ahora)
            return True


def ip_cliente(request: Request) -> str:
    # Azure Container Apps entrega la IP original en X-Forwarded-For.
    reenviada = request.headers.get("x-forwarded-for", "")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


limitador = Limitador()


async def middleware_limites(request: Request, call_next):
    if activo():
        ip = ip_cliente(request)
        reglas = [("*", *GLOBAL)] + [
            (prefijo, limite, ventana)
            for prefijo, metodo, limite, ventana in REGLAS
            if request.method == metodo and request.url.path.startswith(prefijo)
        ]
        for prefijo, limite, ventana in reglas:
            if not limitador.permitir((ip, prefijo), limite, ventana):
                return JSONResponse(
                    {"detail": "Demasiadas solicitudes. Espera un momento."},
                    status_code=429,
                    headers={"Retry-After": str(ventana)},
                )
    respuesta = await call_next(request)
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    respuesta.headers.setdefault("X-Frame-Options", "DENY")
    return respuesta

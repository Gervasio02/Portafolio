"""Ubicación aproximada de una visita, sin guardar la IP.

Para cada sesión nueva se consulta una vez el servicio gratuito ip-api.com
(uso no comercial) y se guarda solo país, región, ciudad y la red u
organización (proveedor de internet, empresa o universidad). La IP se usa en
memoria para la consulta y nunca se escribe en la base.

Se desactiva con ``ANALITICA_GEO=off``.
"""

from __future__ import annotations

import ipaddress
import os
import time

import httpx

URL = "http://ip-api.com/json/{ip}?fields=status,country,regionName,city,org,isp&lang=es"
VACIO = {"pais": "", "region": "", "ciudad": "", "red": ""}
_cache: dict[str, tuple[float, dict]] = {}
DURACION_CACHE = 6 * 3600


def _publica(ip: str) -> bool:
    try:
        direccion = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return direccion.is_global


def consultar(ip: str) -> dict:
    """Llama al servicio. Se reemplaza en las pruebas."""
    respuesta = httpx.get(URL.format(ip=ip), timeout=3)
    respuesta.raise_for_status()
    return respuesta.json()


def ubicar(ip: str) -> dict:
    if os.getenv("ANALITICA_GEO", "on").lower() == "off" or not _publica(ip):
        return dict(VACIO)
    ahora = time.monotonic()
    guardado = _cache.get(ip)
    if guardado and ahora - guardado[0] < DURACION_CACHE:
        return dict(guardado[1])
    try:
        datos = consultar(ip)
    except (httpx.HTTPError, ValueError):
        return dict(VACIO)
    if datos.get("status") != "success":
        resultado = dict(VACIO)
    else:
        resultado = {
            "pais": str(datos.get("country") or "")[:60],
            "region": str(datos.get("regionName") or "")[:60],
            "ciudad": str(datos.get("city") or "")[:60],
            "red": str(datos.get("org") or datos.get("isp") or "")[:80],
        }
    _cache[ip] = (ahora, resultado)
    if len(_cache) > 5000:
        _cache.clear()
    return dict(resultado)

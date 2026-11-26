"""Analítica privada y anónima del portafolio (gervasio.sbs).

- ``POST /api/visitas`` recibe eventos desde la portada (vistas de página y
  clics en enlaces). No usa cookies, no guarda IP ni datos personales: solo
  una sesión aleatoria por pestaña, la ruta, el destino del clic, el dominio
  de procedencia, el tipo de dispositivo y el idioma del navegador.
- ``GET /api/panel/resumen`` devuelve las métricas para el panel privado y
  exige la clave ``PANEL_CLAVE`` (variable de entorno, nunca en el código).

Los eventos se guardan en PostgreSQL si existe ``ANALITICA_DB_URL`` (así
sobreviven a los reinicios del contenedor) o en el SQLite de los laboratorios.
"""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
import time
from collections import Counter, defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response

ZONA = ZoneInfo("America/Santiago")
RETENCION_DIAS = 180
TIPOS = {"vista", "clic"}
DISPOSITIVOS = {"movil", "tablet", "escritorio"}
LIMITES = {"ruta": 200, "destino": 300, "etiqueta": 80, "referente": 120, "idioma": 12, "sesion": 40}


def _origenes() -> set[str]:
    crudo = os.getenv("PANEL_ORIGENES", "https://gervasio.sbs,https://www.gervasio.sbs")
    return {o.strip().rstrip("/") for o in crudo.split(",") if o.strip()}


def _texto(valor, limite: int) -> str:
    if not isinstance(valor, str):
        return ""
    return "".join(c for c in valor.strip() if c.isprintable())[:limite]


class Almacen:
    """Guarda y lee eventos en PostgreSQL o SQLite con la misma interfaz."""

    def __init__(self, sqlite_path: str):
        self.url = os.getenv("ANALITICA_DB_URL", "").strip()
        self.sqlite_path = sqlite_path
        self.postgres = self.url.startswith(("postgres://", "postgresql://"))
        self._crear()

    @contextmanager
    def _conexion(self):
        if self.postgres:
            import psycopg

            # Esquema propio para no mezclarse con las tablas de la app que
            # comparte el servidor PostgreSQL.
            with psycopg.connect(
                self.url, connect_timeout=5, options="-c search_path=analitica"
            ) as conexion:
                yield conexion
        else:
            conexion = sqlite3.connect(self.sqlite_path, timeout=5)
            try:
                with conexion:
                    yield conexion
            finally:
                conexion.close()

    def _sql(self, consulta: str) -> str:
        return consulta.replace("?", "%s") if self.postgres else consulta

    def _crear(self):
        clave = "BIGSERIAL PRIMARY KEY" if self.postgres else "INTEGER PRIMARY KEY"
        with self._conexion() as c:
            if self.postgres:
                c.execute("CREATE SCHEMA IF NOT EXISTS analitica")
            c.execute(
                f"""CREATE TABLE IF NOT EXISTS portafolio_eventos(
                    id {clave}, creado TEXT NOT NULL, sesion TEXT NOT NULL,
                    tipo TEXT NOT NULL, ruta TEXT NOT NULL, destino TEXT,
                    etiqueta TEXT, referente TEXT, dispositivo TEXT, idioma TEXT)"""
            )
            c.execute(
                "CREATE INDEX IF NOT EXISTS portafolio_eventos_creado ON portafolio_eventos(creado)"
            )

    def guardar(self, evento: dict):
        campos = ("creado", "sesion", "tipo", "ruta", "destino", "etiqueta", "referente", "dispositivo", "idioma")
        with self._conexion() as c:
            c.execute(
                self._sql(f"INSERT INTO portafolio_eventos({','.join(campos)}) VALUES({','.join('?' * len(campos))})"),
                tuple(evento[k] for k in campos),
            )

    def desde(self, inicio: datetime) -> list[dict]:
        with self._conexion() as c:
            cursor = c.execute(
                self._sql(
                    "SELECT creado,sesion,tipo,ruta,destino,etiqueta,referente,dispositivo,idioma "
                    "FROM portafolio_eventos WHERE creado>=? ORDER BY creado"
                ),
                (inicio.isoformat(),),
            )
            nombres = [d[0] for d in cursor.description]
            return [dict(zip(nombres, fila)) for fila in cursor.fetchall()]

    def purgar(self):
        limite = (datetime.now(timezone.utc) - timedelta(days=RETENCION_DIAS)).isoformat()
        with self._conexion() as c:
            c.execute(self._sql("DELETE FROM portafolio_eventos WHERE creado<?"), (limite,))


def _categoria(destino: str) -> str:
    if not destino:
        return "otro"
    if destino.startswith("mailto:"):
        return "correo"
    if destino.endswith(".pdf"):
        return "cv"
    host = urlsplit(destino).netloc
    if "github.com" in host:
        return "codigo"
    if "azurecontainerapps.io" in host:
        return "app"
    if "#demo" in destino:
        return "demo"
    return "navegacion"


def _proyecto(destino: str) -> str:
    for nombre in ("taskflow", "reservaya", "tiendanova", "snake", "interrogatorio", "datalab", "docflow", "cloudops", "labs"):
        if nombre in destino.lower():
            return nombre
    return ""


def resumir(eventos: list[dict], dias: int, ahora: datetime | None = None) -> dict:
    ahora = (ahora or datetime.now(timezone.utc)).astimezone(ZONA)
    hoy = ahora.date()
    for e in eventos:
        e["_local"] = datetime.fromisoformat(e["creado"]).astimezone(ZONA)
    vistas = [e for e in eventos if e["tipo"] == "vista"]
    clics = [e for e in eventos if e["tipo"] == "clic"]

    def en_dias(lista, n):
        return [e for e in lista if (hoy - e["_local"].date()).days < n]

    por_dia = []
    for i in range(dias - 1, -1, -1):
        dia = hoy - timedelta(days=i)
        del_dia = [e for e in vistas if e["_local"].date() == dia]
        por_dia.append({"dia": dia.isoformat(), "vistas": len(del_dia), "sesiones": len({e["sesion"] for e in del_dia})})

    clics_periodo = en_dias(clics, dias)
    vistas_periodo = en_dias(vistas, dias)
    proyectos = defaultdict(Counter)
    for e in clics_periodo:
        nombre = _proyecto(e["destino"] or "")
        if nombre:
            proyectos[nombre][_categoria(e["destino"])] += 1

    recientes = sorted(eventos, key=lambda e: e["creado"], reverse=True)[:30]
    return {
        "generado": ahora.isoformat(timespec="seconds"),
        "dias": dias,
        "totales": {
            "vistas_hoy": len(en_dias(vistas, 1)),
            "sesiones_hoy": len({e["sesion"] for e in en_dias(vistas, 1)}),
            "vistas_7d": len(en_dias(vistas, 7)),
            "sesiones_7d": len({e["sesion"] for e in en_dias(vistas, 7)}),
            "vistas_periodo": len(vistas_periodo),
            "sesiones_periodo": len({e["sesion"] for e in vistas_periodo}),
            "clics_periodo": len(clics_periodo),
            "activos_5min": len({e["sesion"] for e in eventos if ahora - e["_local"] <= timedelta(minutes=5)}),
        },
        "por_dia": por_dia,
        "paginas": Counter(e["ruta"] for e in vistas_periodo).most_common(10),
        "acciones": Counter(_categoria(e["destino"] or "") for e in clics_periodo).most_common(),
        "proyectos": sorted(
            ({"proyecto": k, "total": sum(v.values()), **v} for k, v in proyectos.items()),
            key=lambda x: -x["total"],
        ),
        "enlaces": Counter(e["etiqueta"] or e["destino"] for e in clics_periodo).most_common(12),
        "referentes": Counter(e["referente"] or "directo" for e in vistas_periodo).most_common(8),
        "dispositivos": Counter(e["dispositivo"] or "desconocido" for e in vistas_periodo).most_common(),
        "idiomas": Counter(e["idioma"] or "?" for e in vistas_periodo).most_common(5),
        "recientes": [
            {
                "hora": e["_local"].strftime("%d-%m %H:%M"),
                "tipo": e["tipo"],
                "ruta": e["ruta"],
                "detalle": e["etiqueta"] or e["destino"] or "",
                "dispositivo": e["dispositivo"],
            }
            for e in recientes
        ],
    }


def registrar(app: FastAPI, sqlite_path: str, ip_cliente, permitido) -> None:
    almacen = Almacen(sqlite_path)
    intentos: dict[str, deque] = defaultdict(deque)
    visitas_ip: dict[str, deque] = defaultdict(deque)

    def cors(request: Request, respuesta: Response) -> Response:
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen in _origenes():
            respuesta.headers["Access-Control-Allow-Origin"] = origen
            respuesta.headers["Vary"] = "Origin"
            respuesta.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            respuesta.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            respuesta.headers["Access-Control-Max-Age"] = "600"
        return respuesta

    @app.options("/api/visitas", include_in_schema=False)
    @app.options("/api/panel/resumen", include_in_schema=False)
    def preflight(request: Request):
        return cors(request, Response(status_code=204))

    @app.post("/api/visitas", status_code=204, tags=["analítica"])
    async def visita(request: Request):
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen not in _origenes():
            raise HTTPException(403, "Origen no permitido")
        if not permitido(visitas_ip, ip_cliente(request), 120, 60):
            return cors(request, Response(status_code=429))
        crudo = await request.body()
        if len(crudo) > 2048:
            raise HTTPException(413, "Evento demasiado grande")
        try:
            datos = json.loads(crudo or b"{}")
        except json.JSONDecodeError:
            raise HTTPException(400, "JSON inválido")
        tipo = _texto(datos.get("tipo"), 10)
        ruta = _texto(datos.get("ruta"), LIMITES["ruta"])
        sesion = _texto(datos.get("sesion"), LIMITES["sesion"])
        if tipo not in TIPOS or not ruta.startswith("/") or len(sesion) < 8:
            raise HTTPException(422, "Evento inválido")
        dispositivo = _texto(datos.get("dispositivo"), 12)
        referente = urlsplit(_texto(datos.get("referente"), LIMITES["referente"])).netloc
        almacen.guardar(
            {
                "creado": datetime.now(timezone.utc).isoformat(),
                "sesion": sesion,
                "tipo": tipo,
                "ruta": ruta,
                "destino": _texto(datos.get("destino"), LIMITES["destino"]),
                "etiqueta": _texto(datos.get("etiqueta"), LIMITES["etiqueta"]),
                "referente": "" if referente.endswith("gervasio.sbs") else referente,
                "dispositivo": dispositivo if dispositivo in DISPOSITIVOS else "",
                "idioma": _texto(datos.get("idioma"), LIMITES["idioma"]),
            }
        )
        return cors(request, Response(status_code=204))

    @app.get("/api/panel/resumen", tags=["analítica"])
    def resumen(request: Request, dias: int = 30):
        clave = os.getenv("PANEL_CLAVE", "")
        if not clave:
            return cors(request, JSONResponse({"detail": "El panel no está configurado"}, status_code=503))
        ip = ip_cliente(request)
        cola = intentos[ip]
        ahora = time.monotonic()
        while cola and ahora - cola[0] > 900:
            cola.popleft()
        if len(cola) >= 5:
            return cors(request, JSONResponse({"detail": "Demasiados intentos. Espera 15 minutos."}, status_code=429))
        enviado = request.headers.get("authorization", "")
        if not secrets.compare_digest(enviado.encode(), f"Bearer {clave}".encode()):
            cola.append(ahora)
            return cors(request, JSONResponse({"detail": "Clave incorrecta"}, status_code=401))
        dias = max(1, min(dias, 90))
        almacen.purgar()
        inicio = datetime.now(timezone.utc) - timedelta(days=dias + 1)
        respuesta = JSONResponse(resumir(almacen.desde(inicio), dias))
        respuesta.headers["Cache-Control"] = "no-store"
        return cors(request, respuesta)

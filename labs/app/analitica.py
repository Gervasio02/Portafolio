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
import logging
import os
import secrets
import sqlite3
import time
from collections import Counter, defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from . import geo

ZONA = ZoneInfo("America/Santiago")
RETENCION_DIAS = 180
TIPOS = {"vista", "clic", "salida"}
COLUMNAS_EVENTOS = ("creado", "sesion", "tipo", "ruta", "destino", "etiqueta", "referente", "dispositivo", "idioma", "pais", "region", "ciudad", "red", "duracion", "scroll")
NUEVAS_COLUMNAS = {
    "portafolio_eventos": {"pais": "TEXT", "region": "TEXT", "ciudad": "TEXT", "red": "TEXT", "duracion": "INTEGER", "scroll": "INTEGER"},
    "asistente_preguntas": {"sesion": "TEXT"},
}
DISPOSITIVOS = {"movil", "tablet", "escritorio"}
LIMITES = {"ruta": 200, "destino": 300, "etiqueta": 80, "referente": 120, "idioma": 12, "sesion": 40}


def _origenes() -> set[str]:
    crudo = os.getenv("PANEL_ORIGENES", "https://gervasio.sbs,https://www.gervasio.sbs")
    return {o.strip().rstrip("/") for o in crudo.split(",") if o.strip()}


def _entero(valor, minimo: int, maximo: int) -> int | None:
    try:
        return max(minimo, min(maximo, int(valor)))
    except (TypeError, ValueError):
        return None


def _texto(valor, limite: int) -> str:
    if not isinstance(valor, str):
        return ""
    return "".join(c for c in valor.strip() if c.isprintable())[:limite]


registro = logging.getLogger("labs.analitica")

# Parámetros que entiende libpq. Las cadenas de Prisma traen otros
# (schema, connection_limit, pgbouncer...) que psycopg rechaza.
PARAMETROS_LIBPQ = {
    "sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout",
    "application_name", "target_session_attrs", "channel_binding",
}


def limpiar_url(url: str) -> str:
    """Deja una cadena de conexión PostgreSQL aceptable para psycopg."""
    partes = urlsplit(url)
    consulta = [(k, v) for k, v in parse_qsl(partes.query) if k in PARAMETROS_LIBPQ]
    return urlunsplit(partes._replace(query=urlencode(consulta)))


class Almacen:
    """Guarda y lee eventos en PostgreSQL o SQLite con la misma interfaz.

    Si PostgreSQL no responde al arrancar, usa SQLite para que Labs siga
    funcionando (las visitas de ese período no sobreviven a un reinicio).
    """

    def __init__(self, sqlite_path: str):
        crudo = os.getenv("ANALITICA_DB_URL", "").strip()
        self.sqlite_path = sqlite_path
        self.postgres = crudo.startswith(("postgres://", "postgresql://"))
        self.url = limpiar_url(crudo) if self.postgres else ""
        try:
            self._crear()
        except Exception as error:  # noqa: BLE001 - cualquier fallo de conexión
            if not self.postgres:
                raise
            registro.warning("Analítica: PostgreSQL no disponible (%s); se usa SQLite.", type(error).__name__)
            self.postgres = False
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
            c.execute(
                f"""CREATE TABLE IF NOT EXISTS asistente_preguntas(
                    id {clave}, creado TEXT NOT NULL, pregunta TEXT NOT NULL,
                    intencion TEXT, confianza REAL, motivo TEXT NOT NULL, ruta TEXT)"""
            )
            # Columnas agregadas después: se suman sin perder los datos guardados.
            for tabla, columnas in NUEVAS_COLUMNAS.items():
                if self.postgres:
                    for nombre, tipo in columnas.items():
                        c.execute(f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS {nombre} {tipo}")
                else:
                    existentes = {fila[1] for fila in c.execute(f"PRAGMA table_info({tabla})")}
                    for nombre, tipo in columnas.items():
                        if nombre not in existentes:
                            c.execute(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo}")

    def guardar(self, evento: dict):
        campos = COLUMNAS_EVENTOS
        with self._conexion() as c:
            c.execute(
                self._sql(f"INSERT INTO portafolio_eventos({','.join(campos)}) VALUES({','.join('?' * len(campos))})"),
                tuple(evento.get(k) for k in campos),
            )

    def desde(self, inicio: datetime) -> list[dict]:
        with self._conexion() as c:
            cursor = c.execute(
                self._sql(
                    f"SELECT {','.join(COLUMNAS_EVENTOS)} "
                    "FROM portafolio_eventos WHERE creado>=? ORDER BY creado"
                ),
                (inicio.isoformat(),),
            )
            nombres = [d[0] for d in cursor.description]
            return [dict(zip(nombres, fila)) for fila in cursor.fetchall()]

    def guardar_pregunta(self, pregunta: dict):
        campos = ("creado", "pregunta", "intencion", "confianza", "motivo", "ruta", "sesion")
        with self._conexion() as c:
            c.execute(
                self._sql(f"INSERT INTO asistente_preguntas({','.join(campos)}) VALUES({','.join('?' * len(campos))})"),
                tuple(pregunta.get(k) for k in campos),
            )

    def preguntas_desde(self, inicio: datetime) -> list[dict]:
        with self._conexion() as c:
            cursor = c.execute(
                self._sql(
                    "SELECT creado,pregunta,intencion,confianza,motivo,ruta,sesion "
                    "FROM asistente_preguntas WHERE creado>=? ORDER BY creado"
                ),
                (inicio.isoformat(),),
            )
            nombres = [d[0] for d in cursor.description]
            return [dict(zip(nombres, fila)) for fila in cursor.fetchall()]

    def purgar(self):
        limite = (datetime.now(timezone.utc) - timedelta(days=RETENCION_DIAS)).isoformat()
        with self._conexion() as c:
            c.execute(self._sql("DELETE FROM portafolio_eventos WHERE creado<?"), (limite,))
            c.execute(self._sql("DELETE FROM asistente_preguntas WHERE creado<?"), (limite,))


MOTIVOS = {"sin_respuesta", "no_sirvio"}


def resumir_preguntas(preguntas: list[dict], ahora: datetime | None = None) -> dict:
    """Lo que el asistente no supo responder, para enseñarle."""
    ahora = (ahora or datetime.now(timezone.utc)).astimezone(ZONA)
    frecuentes = Counter(" ".join(p["pregunta"].lower().split()) for p in preguntas)
    return {
        "total": len(preguntas),
        "sin_respuesta": sum(p["motivo"] == "sin_respuesta" for p in preguntas),
        "no_sirvio": sum(p["motivo"] == "no_sirvio" for p in preguntas),
        "frecuentes": frecuentes.most_common(10),
        "recientes": [
            {
                "hora": datetime.fromisoformat(p["creado"]).astimezone(ZONA).strftime("%d-%m %H:%M"),
                "pregunta": p["pregunta"],
                "intencion": p["intencion"] or "",
                "confianza": p["confianza"],
                "motivo": p["motivo"],
            }
            for p in reversed(preguntas[-50:])
        ],
    }


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


def _lugar(e: dict) -> str:
    partes = [e.get("ciudad"), e.get("region"), e.get("pais")]
    return ", ".join(dict.fromkeys(x for x in partes if x)) or "Desconocida"


def resumir_detalle(eventos: list[dict], preguntas: list[dict], dias: int, ahora: datetime | None = None) -> dict:
    """Ubicación, comportamiento y recorrido exacto de cada visita (anónimo)."""
    ahora = (ahora or datetime.now(timezone.utc)).astimezone(ZONA)
    limite = ahora.date() - timedelta(days=dias - 1)
    sesiones: dict[str, list[dict]] = defaultdict(list)
    for e in eventos:
        local = datetime.fromisoformat(e["creado"]).astimezone(ZONA)
        if local.date() >= limite:
            sesiones[e["sesion"]].append({**e, "_local": local})
    preguntas_por_sesion = Counter(p.get("sesion") for p in preguntas if p.get("sesion"))

    vistas = [e for lista in sesiones.values() for e in lista if e["tipo"] == "vista"]
    salidas = [e for lista in sesiones.values() for e in lista if e["tipo"] == "salida"]

    # Tiempo y scroll promedio por página (eventos de salida).
    por_pagina: dict[str, list[dict]] = defaultdict(list)
    for e in salidas:
        por_pagina[e["ruta"]].append(e)
    paginas = sorted(
        (
            {
                "ruta": ruta,
                "vistas": sum(1 for v in vistas if v["ruta"] == ruta),
                "segundos": round(sum((x.get("duracion") or 0) for x in lista) / len(lista) / 1000),
                "scroll": round(sum((x.get("scroll") or 0) for x in lista) / len(lista)),
            }
            for ruta, lista in por_pagina.items()
        ),
        key=lambda x: -x["vistas"],
    )[:12]

    recorridos = []
    duraciones = []
    entradas, finales = Counter(), Counter()
    rebotes = 0
    for sesion, lista in sesiones.items():
        lista.sort(key=lambda e: e["creado"])
        vistas_sesion = [e for e in lista if e["tipo"] == "vista"]
        if not vistas_sesion:
            continue
        entradas[vistas_sesion[0]["ruta"]] += 1
        finales[vistas_sesion[-1]["ruta"]] += 1
        if len(vistas_sesion) == 1:
            rebotes += 1
        # La salida se registra al dejar la página, así que la diferencia entre
        # el primer y el último evento cubre el tiempo real de la visita.
        duracion = (lista[-1]["_local"] - lista[0]["_local"]).total_seconds()
        duraciones.append(duracion)
        pasos = []
        for e in lista:
            if e["tipo"] == "vista":
                pasos.append({"hora": e["_local"].strftime("%H:%M:%S"), "tipo": "vista", "ruta": e["ruta"]})
            elif e["tipo"] == "clic":
                pasos.append({"hora": e["_local"].strftime("%H:%M:%S"), "tipo": "clic", "ruta": e["ruta"], "detalle": e.get("etiqueta") or e.get("destino") or ""})
            else:
                pasos.append({"hora": e["_local"].strftime("%H:%M:%S"), "tipo": "salida", "ruta": e["ruta"], "segundos": round((e.get("duracion") or 0) / 1000), "scroll": e.get("scroll")})
        primera = vistas_sesion[0]
        recorridos.append(
            {
                "inicio": primera["_local"].strftime("%d-%m %H:%M"),
                "_orden": primera["creado"],
                "duracion": round(duracion),
                "paginas": len(vistas_sesion),
                "clics": sum(1 for e in lista if e["tipo"] == "clic"),
                "preguntas": preguntas_por_sesion.get(sesion, 0),
                "lugar": _lugar(primera),
                "red": primera.get("red") or "",
                "referente": primera.get("referente") or "directo",
                "dispositivo": primera.get("dispositivo") or "",
                "idioma": primera.get("idioma") or "",
                "pasos": pasos[-60:],
            }
        )
    recorridos.sort(key=lambda r: r["_orden"], reverse=True)
    for r in recorridos:
        del r["_orden"]
    total = len(recorridos)
    primeras = [next(e for e in sorted(lista, key=lambda e: e["creado"]) if e["tipo"] == "vista") for lista in sesiones.values() if any(e["tipo"] == "vista" for e in lista)]
    return {
        "comportamiento": {
            "sesiones": total,
            "rebote": round(100 * rebotes / total) if total else 0,
            "duracion_media": round(sum(duraciones) / len(duraciones)) if duraciones else 0,
            "paginas_por_sesion": round(len(vistas) / total, 1) if total else 0,
            "entradas": entradas.most_common(6),
            "salidas": finales.most_common(6),
            "paginas": paginas,
        },
        "ubicacion": {
            "paises": Counter(e.get("pais") or "Desconocido" for e in primeras).most_common(8),
            "lugares": Counter(_lugar(e) for e in primeras).most_common(10),
            "redes": Counter(e.get("red") or "Desconocida" for e in primeras).most_common(10),
        },
        "sesiones": recorridos[:40],
    }


def registrar(app: FastAPI, sqlite_path: str, ip_cliente, permitido) -> None:
    almacen = Almacen(sqlite_path)
    intentos: dict[str, deque] = defaultdict(deque)
    visitas_ip: dict[str, deque] = defaultdict(deque)
    ubicaciones: dict[str, tuple[float, dict]] = {}

    def cors(request: Request, respuesta: Response) -> Response:
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen in _origenes():
            respuesta.headers["Access-Control-Allow-Origin"] = origen
            respuesta.headers["Vary"] = "Origin"
            respuesta.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            respuesta.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            respuesta.headers["Access-Control-Max-Age"] = "600"
        return respuesta

    preguntas_ip: dict[str, deque] = defaultdict(deque)

    @app.options("/api/visitas", include_in_schema=False)
    @app.options("/api/asistente/preguntas", include_in_schema=False)
    @app.options("/api/panel/resumen", include_in_schema=False)
    def preflight(request: Request):
        return cors(request, Response(status_code=204))

    @app.post("/api/visitas", status_code=204, tags=["analítica"])
    async def visita(request: Request, tareas: BackgroundTasks):
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
        evento = {
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
        if tipo == "salida":
            evento["duracion"] = _entero(datos.get("duracion"), 0, 2 * 3600 * 1000)
            evento["scroll"] = _entero(datos.get("scroll"), 0, 100)
        if tipo == "vista":
            # La ubicación se busca después de responder, con la IP solo en
            # memoria; a la base llegan país, región, ciudad y red.
            ip = ip_cliente(request)
            tareas.add_task(guardar_con_ubicacion, evento, ip)
        else:
            almacen.guardar(evento)
        return cors(request, Response(status_code=204))

    def guardar_con_ubicacion(evento: dict, ip: str):
        guardada = ubicaciones.get(evento["sesion"])
        if guardada and time.monotonic() - guardada[0] < 4 * 3600:
            lugar = guardada[1]
        else:
            lugar = geo.ubicar(ip)
            ubicaciones[evento["sesion"]] = (time.monotonic(), lugar)
            if len(ubicaciones) > 5000:
                ubicaciones.clear()
        evento.update(lugar)
        almacen.guardar(evento)

    @app.post("/api/asistente/preguntas", status_code=204, tags=["analítica"])
    async def pregunta_asistente(request: Request):
        """Guarda una pregunta que el asistente no supo responder (sin datos personales)."""
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen not in _origenes():
            raise HTTPException(403, "Origen no permitido")
        if not permitido(preguntas_ip, ip_cliente(request), 30, 60):
            return cors(request, Response(status_code=429))
        crudo = await request.body()
        if len(crudo) > 1024:
            raise HTTPException(413, "Pregunta demasiado grande")
        try:
            datos = json.loads(crudo or b"{}")
        except json.JSONDecodeError:
            raise HTTPException(400, "JSON inválido")
        pregunta = _texto(datos.get("pregunta"), 200)
        motivo = _texto(datos.get("motivo"), 20)
        intencion = _texto(datos.get("intencion"), 40)
        try:
            confianza = float(datos.get("confianza"))
        except (TypeError, ValueError):
            confianza = None
        if len(pregunta) < 2 or motivo not in MOTIVOS:
            raise HTTPException(422, "Pregunta inválida")
        if confianza is not None and not 0 <= confianza <= 1:
            confianza = None
        almacen.guardar_pregunta(
            {
                "creado": datetime.now(timezone.utc).isoformat(),
                "pregunta": pregunta,
                "intencion": intencion if intencion.replace("_", "").isalnum() else "",
                "confianza": confianza,
                "motivo": motivo,
                "ruta": _texto(datos.get("ruta"), LIMITES["ruta"]),
                "sesion": _texto(datos.get("sesion"), LIMITES["sesion"]),
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
        eventos = almacen.desde(inicio)
        preguntas = almacen.preguntas_desde(inicio)
        datos = resumir([dict(e) for e in eventos], dias)
        datos["asistente"] = resumir_preguntas(preguntas)
        datos.update(resumir_detalle(eventos, preguntas, dias))
        respuesta = JSONResponse(datos)
        respuesta.headers["Cache-Control"] = "no-store"
        return cors(request, respuesta)

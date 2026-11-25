"""Local demonstration workbench. No external paid services."""

import hashlib
import json
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from .data import ingest, clean, profile, export_csv, numeric, MAX_BYTES
from .documents import extract, extract_file, validate


class Invoice(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class Review(BaseModel):
    fields: dict
    decision: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(min_length=1, max_length=500)


class Incident(BaseModel):
    service: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=5, max_length=1000)


class AlertRule(BaseModel):
    enabled: bool = False
    consecutive_failures: int = Field(default=2, ge=1, le=10)


class DatasetQuery(BaseModel):
    group_by: str | None = Field(default=None, max_length=200)
    metric: str | None = Field(default=None, max_length=200)
    operation: str = Field(default="count", pattern="^(count|sum|average|min|max)$")
    equals: dict[str, str] = Field(default_factory=dict)


def configured_identities(production: bool) -> dict[str, str]:
    """Map opaque bearer tokens to stable, non-secret owner identifiers."""
    raw = os.getenv("LABS_USER_TOKENS", "")
    identities = {}
    if raw:
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError
            for owner, token in parsed.items():
                if (
                    not isinstance(owner, str)
                    or not owner.strip()
                    or not isinstance(token, str)
                    or len(token) < 32
                ):
                    raise ValueError
                identities[token] = owner.strip()[:80]
        except (json.JSONDecodeError, ValueError) as error:
            raise RuntimeError(
                "LABS_USER_TOKENS debe ser un objeto JSON usuario:token con claves de 32+ caracteres"
            ) from error
    legacy = os.getenv("LABS_ACCESS_TOKEN", "")
    if legacy:
        if len(legacy) < 32:
            raise RuntimeError("LABS_ACCESS_TOKEN debe contener al menos 32 caracteres")
        identities[legacy] = "shared-legacy"
    guest_mode = os.getenv("LABS_GUEST_MODE", "off").lower() in ("on", "1", "true")
    if production and not guest_mode and (
        not identities or set(identities.values()) == {"shared-legacy"}
    ):
        raise RuntimeError(
            "Configura LABS_USER_TOKENS con identidades aisladas en producción"
        )
    return identities


def create_app(database=None, targets=None):
    database = database or os.getenv("LABS_DB", "data/labs.db")
    production = os.getenv("APP_ENV", "development").lower() == "production"
    identities = configured_identities(production)
    # Modo invitado: cada visitante recibe una identidad aislada y temporal,
    # sin registrarse. Sus datos se borran pasadas GUEST_TTL_HOURS horas.
    guest_mode = os.getenv("LABS_GUEST_MODE", "off").lower() in ("on", "1", "true")
    guest_ttl = timedelta(hours=float(os.getenv("GUEST_TTL_HOURS", "24")))
    guest_hits: dict[str, deque] = defaultdict(deque)
    write_hits: dict[str, deque] = defaultdict(deque)
    rate_limit = os.getenv("RATE_LIMIT", "on").lower() not in ("off", "0", "false")
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    app = FastAPI(title="Laboratorios de ingeniería", version="0.1.0")
    services = targets or {
        # La portada puede publicarse en otro servidor (GitHub Pages, Azure...).
        "portal": os.getenv(
            "PORTAL_URL", "https://gervasio.sbs"
        ),
        "taskflow": "https://taskflow-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
        "reservaya": "https://reservaya-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
        "tiendanova": "https://tiendanova-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
        "snake": "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
        "interrogatorio": "https://interrogatorio-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
    }

    @contextmanager
    def db():
        connection = sqlite3.connect(database, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS datasets(id INTEGER PRIMARY KEY, owner TEXT NOT NULL DEFAULT 'local-demo', name TEXT, payload TEXT);
        CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, owner TEXT NOT NULL DEFAULT 'local-demo', digest TEXT NOT NULL, payload TEXT, state TEXT, UNIQUE(owner,digest));
        CREATE TABLE IF NOT EXISTS decisions(id INTEGER PRIMARY KEY, document_id INTEGER, payload TEXT);
        CREATE TABLE IF NOT EXISTS checks(id INTEGER PRIMARY KEY, service TEXT, checked_at TEXT, success INTEGER, latency REAL, code INTEGER);
        CREATE TABLE IF NOT EXISTS check_runs(id INTEGER PRIMARY KEY, started_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS incidents(id INTEGER PRIMARY KEY, owner TEXT NOT NULL DEFAULT 'local-demo', service TEXT NOT NULL, description TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT);
        CREATE TABLE IF NOT EXISTS alerts(owner TEXT NOT NULL DEFAULT 'local-demo', service TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 2, PRIMARY KEY(owner,service));
        CREATE TABLE IF NOT EXISTS guests(token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
        """)
        # Migrate the earlier single-user demonstration without losing its records.
        for table in ("datasets", "incidents"):
            columns = {
                row[1] for row in connection.execute(f"PRAGMA table_info({table})")
            }
            if "owner" not in columns:
                connection.execute(
                    f"ALTER TABLE {table} ADD COLUMN owner TEXT NOT NULL DEFAULT 'local-demo'"
                )
        document_sql = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'"
        ).fetchone()[0]
        if (
            "owner"
            not in {
                row[1] for row in connection.execute("PRAGMA table_info(documents)")
            }
            or "digest TEXT UNIQUE" in document_sql
        ):
            connection.executescript("""
            ALTER TABLE documents RENAME TO documents_legacy;
            CREATE TABLE documents(id INTEGER PRIMARY KEY, owner TEXT NOT NULL DEFAULT 'local-demo', digest TEXT NOT NULL, payload TEXT, state TEXT, UNIQUE(owner,digest));
            INSERT INTO documents(id,owner,digest,payload,state) SELECT id,'local-demo',digest,payload,state FROM documents_legacy;
            DROP TABLE documents_legacy;
            """)
        alert_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(alerts)")
        }
        if "owner" not in alert_columns:
            connection.executescript("""
            ALTER TABLE alerts RENAME TO alerts_legacy;
            CREATE TABLE alerts(owner TEXT NOT NULL DEFAULT 'local-demo', service TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 2, PRIMARY KEY(owner,service));
            INSERT INTO alerts(owner,service,enabled,consecutive_failures) SELECT 'local-demo',service,enabled,consecutive_failures FROM alerts_legacy;
            DROP TABLE alerts_legacy;
            """)
        owners = set(identities.values()) or {"local-demo"}
        connection.executemany(
            "INSERT OR IGNORE INTO alerts(owner,service) VALUES(?,?)",
            [(owner, name) for owner in owners for name in services],
        )

    def client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "desconocida"

    def allowed(store: dict, key: str, limit: int, window: float) -> bool:
        if not rate_limit:
            return True
        now = time.monotonic()
        queue = store[key]
        while queue and now - queue[0] > window:
            queue.popleft()
        if len(queue) >= limit:
            return False
        queue.append(now)
        return True

    def guest_owner(supplied: str) -> str | None:
        if not guest_mode or not supplied.startswith("Bearer "):
            return None
        digest = hashlib.sha256(supplied[7:].encode()).hexdigest()
        limit = (datetime.now(timezone.utc) - guest_ttl).isoformat()
        with db() as connection:
            row = connection.execute(
                "SELECT owner FROM guests WHERE token_hash=? AND created_at>=?",
                (digest, limit),
            ).fetchone()
        return row[0] if row else None

    def purge_expired_guests(connection):
        limit = (datetime.now(timezone.utc) - guest_ttl).isoformat()
        expired = [
            row[0]
            for row in connection.execute(
                "SELECT owner FROM guests WHERE created_at<?", (limit,)
            )
        ]
        for owner in expired:
            connection.execute(
                "DELETE FROM decisions WHERE document_id IN (SELECT id FROM documents WHERE owner=?)",
                (owner,),
            )
            for table in ("datasets", "documents", "incidents", "alerts", "guests"):
                connection.execute(f"DELETE FROM {table} WHERE owner=?", (owner,))

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        request.state.owner = "local-demo"
        if request.method not in ("GET", "HEAD", "OPTIONS") and not allowed(
            write_hits, client_ip(request), 60, 60
        ):
            return Response(
                "Demasiadas solicitudes. Espera un momento.",
                status_code=429,
                headers={"Retry-After": "60"},
            )
        public = request.url.path == "/api/guest"
        if (
            request.url.path.startswith("/api/")
            and not public
            and (identities or guest_mode)
        ):
            supplied = request.headers.get("authorization", "")
            owner = next(
                (
                    owner
                    for token, owner in identities.items()
                    if secrets.compare_digest(supplied, "Bearer " + token)
                ),
                None,
            ) or guest_owner(supplied)
            if owner is None:
                return Response(
                    "Acceso requerido",
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"},
                )
            request.state.owner = owner
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if origin and urlsplit(origin).netloc != request.headers.get("host"):
                return Response("Origen no permitido", status_code=403)
            size = 0
            chunks = []
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_BYTES:
                    return Response("Archivo demasiado grande", status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'"
        )
        return response

    def load(table, ident, owner):
        with db() as connection:
            row = connection.execute(
                f"SELECT * FROM {table} WHERE id=? AND owner=?", (ident, owner)
            ).fetchone()
        if row is None:
            raise HTTPException(404, "Registro no encontrado")
        return dict(row)

    @app.get("/health")
    def health():
        with db() as connection:
            connection.execute("SELECT 1")
        return {"status": "ok"}

    @app.get("/api/session")
    def session(request: Request):
        return {
            "owner": request.state.owner,
            "isolated": bool(identities) or guest_mode,
            "guest_mode": guest_mode,
        }

    @app.post("/api/guest", status_code=201)
    def create_guest(request: Request):
        if not guest_mode:
            raise HTTPException(404, "El modo invitado no está activo")
        if not allowed(guest_hits, client_ip(request), 10, 3600):
            raise HTTPException(429, "Demasiadas sesiones nuevas desde esta red")
        token = secrets.token_urlsafe(32)
        owner = "invitado-" + secrets.token_hex(4)
        with db() as connection:
            purge_expired_guests(connection)
            connection.execute(
                "INSERT INTO guests(token_hash,owner,created_at) VALUES(?,?,?)",
                (
                    hashlib.sha256(token.encode()).hexdigest(),
                    owner,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            connection.executemany(
                "INSERT OR IGNORE INTO alerts(owner,service) VALUES(?,?)",
                [(owner, name) for name in services],
            )
        return {"token": token, "owner": owner, "expires_in_hours": guest_ttl.total_seconds() / 3600}

    @app.post("/api/datasets", status_code=201)
    async def dataset(
        request: Request, filename: str = "datos.csv", drop_incomplete: bool = False
    ):
        try:
            headers, source = ingest(await request.body(), filename)
            rows, report = clean(source, drop_incomplete)
        except ValueError as error:
            raise HTTPException(422, str(error))
        payload = {
            "headers": headers,
            "source": source,
            "rows": rows,
            "report": report,
            "profile": profile(headers, rows),
        }
        with db() as connection:
            ident = connection.execute(
                "INSERT INTO datasets(owner,name,payload) VALUES(?,?,?)",
                (request.state.owner, Path(filename).name[:120], json.dumps(payload)),
            ).lastrowid
        return {"id": ident, **payload}

    @app.get("/api/datasets")
    def datasets(request: Request):
        with db() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    "SELECT id,name FROM datasets WHERE owner=? ORDER BY id DESC LIMIT 100",
                    (request.state.owner,),
                )
            ]

    @app.get("/api/datasets/{ident}")
    def get_dataset(ident: int, request: Request):
        row = load("datasets", ident, request.state.owner)
        return {"id": ident, "name": row["name"], **json.loads(row["payload"])}

    @app.get("/api/datasets/{ident}/export")
    def export(ident: int, request: Request):
        data = json.loads(load("datasets", ident, request.state.owner)["payload"])
        return Response(
            export_csv(data["headers"], data["rows"]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="resultado.csv"'},
        )

    @app.post("/api/datasets/{ident}/query")
    def query_dataset(ident: int, query: DatasetQuery, request: Request):
        data = json.loads(load("datasets", ident, request.state.owner)["payload"])
        headers, rows = data["headers"], data["rows"]
        if any(name not in headers for name in query.equals) or (
            query.group_by and query.group_by not in headers
        ):
            raise HTTPException(422, "Columna de filtro o agrupación inválida")
        if query.operation != "count" and (
            not query.metric or query.metric not in headers
        ):
            raise HTTPException(422, "Selecciona una columna métrica válida")
        indexes = {name: headers.index(name) for name in headers}
        filtered = [
            row
            for row in rows
            if all(row[indexes[name]] == value for name, value in query.equals.items())
        ]
        groups = {}
        for row in filtered:
            key = row[indexes[query.group_by]] if query.group_by else "Total"
            groups.setdefault(key, []).append(row)
        result = []
        for key, members in sorted(groups.items(), key=lambda item: item[0]):
            values = (
                []
                if query.operation == "count"
                else [
                    value
                    for row in members
                    if (value := numeric(row[indexes[query.metric]])) is not None
                ]
            )
            if query.operation == "count":
                value = len(members)
            elif not values:
                value = None
            elif query.operation == "sum":
                value = sum(values)
            elif query.operation == "average":
                value = sum(values) / len(values)
            elif query.operation == "min":
                value = min(values)
            else:
                value = max(values)
            result.append(
                {
                    "group": key,
                    "value": value,
                    "rows": len(members),
                    "numeric_values": len(values),
                }
            )
        return {
            "dataset_id": ident,
            "operation": query.operation,
            "metric": query.metric,
            "group_by": query.group_by,
            "filtered_rows": len(filtered),
            "results": result,
        }

    @app.post("/api/documents", status_code=201)
    def document(data: Invoice, request: Request):
        digest = hashlib.sha256(data.text.strip().encode()).hexdigest()
        fields = extract(data.text)
        payload = {
            "source": data.text,
            "fields": fields,
            "issues": validate(fields),
            "extraction": "reglas deterministas; sin OCR ni modelo",
        }
        with db() as connection:
            try:
                ident = connection.execute(
                    "INSERT INTO documents(owner,digest,payload,state) VALUES(?,?,?,?)",
                    (request.state.owner, digest, json.dumps(payload), "review"),
                ).lastrowid
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Documento repetido")
        return {"id": ident, "state": "review", **payload}

    @app.post("/api/documents/upload", status_code=201)
    async def upload_document(request: Request, filename: str):
        content = await request.body()
        try:
            source, method = extract_file(content, Path(filename).name)
        except ValueError as error:
            raise HTTPException(422, str(error))
        digest = hashlib.sha256(content).hexdigest()
        fields = extract(source)
        payload = {
            "source": source,
            "filename": Path(filename).name[:120],
            "fields": fields,
            "issues": validate(fields),
            "extraction": method,
        }
        with db() as connection:
            try:
                ident = connection.execute(
                    "INSERT INTO documents(owner,digest,payload,state) VALUES(?,?,?,?)",
                    (request.state.owner, digest, json.dumps(payload), "review"),
                ).lastrowid
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Documento repetido para este usuario")
        return {"id": ident, "state": "review", **payload}

    @app.get("/api/documents")
    def documents(request: Request):
        with db() as connection:
            return [
                {"id": row["id"], "state": row["state"], **json.loads(row["payload"])}
                for row in connection.execute(
                    "SELECT * FROM documents WHERE owner=? ORDER BY id DESC LIMIT 100",
                    (request.state.owner,),
                )
            ]

    @app.get("/api/documents/{ident}")
    def get_document(ident: int, request: Request):
        row = load("documents", ident, request.state.owner)
        with db() as connection:
            audit = [
                json.loads(r[0])
                for r in connection.execute(
                    "SELECT payload FROM decisions WHERE document_id=? ORDER BY id",
                    (ident,),
                )
            ]
        return {
            "id": ident,
            "state": row["state"],
            **json.loads(row["payload"]),
            "decisions": audit,
        }

    @app.post("/api/documents/{ident}/review")
    def review(ident: int, data: Review, request: Request):
        allowed = {"supplier", "rut", "folio", "date", "net", "tax", "total"}
        if set(data.fields) != allowed or any(
            value is not None and not isinstance(value, (str, int))
            for value in data.fields.values()
        ):
            raise HTTPException(422, "Campos de factura inválidos")
        if any(
            not isinstance(data.fields[k], (str, type(None)))
            for k in ("supplier", "rut", "folio", "date")
        ):
            raise HTTPException(422, "Los identificadores y fecha deben ser texto")
        issues = validate(data.fields)
        if data.decision == "approved" and issues:
            raise HTTPException(422, issues)
        with db() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM documents WHERE id=? AND owner=?",
                (ident, request.state.owner),
            ).fetchone()
            if row is None:
                raise HTTPException(404, "Documento no encontrado")
            if row["state"] != "review":
                raise HTTPException(409, "El documento ya fue revisado")
            payload = json.loads(row["payload"])
            payload.update(fields=data.fields, issues=issues)
            connection.execute(
                "UPDATE documents SET payload=?,state=? WHERE id=?",
                (json.dumps(payload), data.decision, ident),
            )
            connection.execute(
                "INSERT INTO decisions(document_id,payload) VALUES(?,?)",
                (
                    ident,
                    json.dumps(
                        {
                            **data.model_dump(),
                            "at": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                ),
            )
        return get_document(ident, request)

    @app.get("/api/cloudops")
    def cloudops():
        with db() as connection:
            rows = [
                dict(row)
                for row in connection.execute(
                    "SELECT * FROM checks ORDER BY id DESC LIMIT 200"
                )
            ]
        summaries = []
        for name in services:
            samples = [row for row in rows if row["service"] == name]
            latencies = sorted(row["latency"] for row in samples)
            summaries.append(
                {
                    "service": name,
                    "sample_count": len(samples),
                    "successful_samples": sum(row["success"] for row in samples),
                    "observed_success_percent": round(
                        sum(row["success"] for row in samples) * 100 / len(samples), 2
                    )
                    if samples
                    else None,
                    "average_latency_ms": round(sum(latencies) / len(latencies), 2)
                    if latencies
                    else None,
                    "p95_latency_ms": latencies[
                        min(len(latencies) - 1, int(len(latencies) * 0.95))
                    ]
                    if latencies
                    else None,
                    "last_check": samples[0]["checked_at"] if samples else None,
                    "last_success": bool(samples[0]["success"]) if samples else None,
                }
            )
        return {
            "services": services,
            "history": rows,
            "summary": summaries,
            "deployment": None,
            "version": None,
            "note": "Porcentaje observado sobre las últimas 200 muestras, no uptime continuo. Despliegue y versión no disponibles sin fuente autorizada.",
        }

    @app.get("/api/cloudops/incidents")
    def incidents(request: Request):
        with db() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    "SELECT * FROM incidents WHERE owner=? ORDER BY id DESC LIMIT 100",
                    (request.state.owner,),
                )
            ]

    @app.post("/api/cloudops/incidents", status_code=201)
    def create_incident(data: Incident, request: Request):
        if data.service not in services:
            raise HTTPException(422, "Servicio no configurado")
        with db() as connection:
            ident = connection.execute(
                "INSERT INTO incidents(owner,service,description,source,created_at) VALUES(?,?,?,?,?)",
                (
                    request.state.owner,
                    data.service,
                    data.description,
                    "manual",
                    datetime.now(timezone.utc).isoformat(),
                ),
            ).lastrowid
        return {"id": ident}

    @app.post("/api/cloudops/incidents/{ident}/resolve")
    def resolve_incident(ident: int, request: Request):
        with db() as connection:
            cursor = connection.execute(
                "UPDATE incidents SET resolved_at=? WHERE id=? AND owner=? AND resolved_at IS NULL",
                (datetime.now(timezone.utc).isoformat(), ident, request.state.owner),
            )
            if not cursor.rowcount:
                raise HTTPException(409, "Incidente inexistente o ya resuelto")
        return {"state": "resolved"}

    @app.get("/api/cloudops/alerts")
    def alert_rules(request: Request):
        with db() as connection:
            connection.executemany(
                "INSERT OR IGNORE INTO alerts(owner,service) VALUES(?,?)",
                [(request.state.owner, name) for name in services],
            )
            return [
                dict(row)
                for row in connection.execute(
                    "SELECT service,enabled,consecutive_failures FROM alerts WHERE owner=? ORDER BY service",
                    (request.state.owner,),
                )
            ]

    @app.put("/api/cloudops/alerts/{service}")
    def set_alert(service: str, data: AlertRule, request: Request):
        if service not in services:
            raise HTTPException(422, "Servicio no configurado")
        with db() as connection:
            connection.execute(
                "INSERT INTO alerts(owner,service,enabled,consecutive_failures) VALUES(?,?,?,?) ON CONFLICT(owner,service) DO UPDATE SET enabled=excluded.enabled,consecutive_failures=excluded.consecutive_failures",
                (
                    request.state.owner,
                    service,
                    int(data.enabled),
                    data.consecutive_failures,
                ),
            )
        return {"service": service, **data.model_dump()}

    @app.post("/api/cloudops/check")
    def check(request: Request):
        with db() as connection:
            connection.execute("BEGIN IMMEDIATE")
            previous = connection.execute(
                "SELECT started_at FROM check_runs ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if (
                previous
                and (
                    datetime.now(timezone.utc) - datetime.fromisoformat(previous[0])
                ).total_seconds()
                < 60
            ):
                raise HTTPException(429, "Espera 60 segundos entre comprobaciones")
            connection.execute(
                "INSERT INTO check_runs(started_at) VALUES(?)",
                (datetime.now(timezone.utc).isoformat(),),
            )
            connection.execute(
                "DELETE FROM check_runs WHERE id NOT IN (SELECT id FROM check_runs ORDER BY id DESC LIMIT 100)"
            )
        for name, url in services.items():
            start = time.perf_counter()
            code = None
            try:
                result = httpx.get(url, timeout=3, follow_redirects=False)
                code = result.status_code
            except httpx.HTTPError:
                pass
            with db() as connection:
                connection.execute(
                    "INSERT INTO checks(service,checked_at,success,latency,code) VALUES(?,?,?,?,?)",
                    (
                        name,
                        datetime.now(timezone.utc).isoformat(),
                        int(code is not None and 200 <= code < 300),
                        round((time.perf_counter() - start) * 1000, 2),
                        code,
                    ),
                )
                rule = connection.execute(
                    "SELECT * FROM alerts WHERE owner=? AND service=? AND enabled=1",
                    (request.state.owner, name),
                ).fetchone()
                if rule:
                    samples = connection.execute(
                        "SELECT success FROM checks WHERE service=? ORDER BY id DESC LIMIT ?",
                        (name, rule["consecutive_failures"]),
                    ).fetchall()
                    open_incident = connection.execute(
                        "SELECT id FROM incidents WHERE owner=? AND service=? AND source='alert' AND resolved_at IS NULL",
                        (request.state.owner, name),
                    ).fetchone()
                    if (
                        len(samples) == rule["consecutive_failures"]
                        and not any(row[0] for row in samples)
                        and not open_incident
                    ):
                        connection.execute(
                            "INSERT INTO incidents(owner,service,description,source,created_at) VALUES(?,?,?,?,?)",
                            (
                                request.state.owner,
                                name,
                                f"Alerta local: {len(samples)} comprobaciones consecutivas fallidas. Causa sin determinar.",
                                "alert",
                                datetime.now(timezone.utc).isoformat(),
                            ),
                        )
                connection.execute(
                    "DELETE FROM checks WHERE id NOT IN (SELECT id FROM checks ORDER BY id DESC LIMIT 5000)"
                )
        return cloudops()

    site = Path(__file__).parent.parent / "web"

    @app.get("/workbench.js", include_in_schema=False)
    def script():
        return FileResponse(site / "workbench.js")

    @app.get("/workbench.css", include_in_schema=False)
    def style():
        return FileResponse(site / "workbench.css")

    @app.get("/{page}", include_in_schema=False)
    def page(page: str):
        if page not in ("datalab", "docflow", "cloudops"):
            raise HTTPException(404)
        return FileResponse(site / "index.html")

    return app

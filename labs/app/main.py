"""Local demonstration workbench. No external paid services."""
import hashlib
import json
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from .data import ingest, clean, profile, export_csv, MAX_BYTES
from .documents import extract, validate

class Invoice(BaseModel):
    text: str = Field(min_length=1, max_length=20000)

class Review(BaseModel):
    fields: dict
    decision: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(min_length=1, max_length=500)

def create_app(database="data/labs.db", targets=None):
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    app = FastAPI(title="Laboratorios de ingeniería", version="0.1.0")
    services = targets or {
        "portal": "https://portafolio-gervasio-torres.aloycmexico-9087.chatgpt.site",
        "taskflow": "https://taskflow-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
        "reservaya": "https://reservaya-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
        "tiendanova": "https://tiendanova-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/health",
        "snake": "https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/api/health",
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
        connection.executescript('''
        CREATE TABLE IF NOT EXISTS datasets(id INTEGER PRIMARY KEY, name TEXT, payload TEXT);
        CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, digest TEXT UNIQUE, payload TEXT, state TEXT);
        CREATE TABLE IF NOT EXISTS decisions(id INTEGER PRIMARY KEY, document_id INTEGER, payload TEXT);
        CREATE TABLE IF NOT EXISTS checks(id INTEGER PRIMARY KEY, service TEXT, checked_at TEXT, success INTEGER, latency REAL, code INTEGER);
        ''')
    @app.middleware("http")
    async def boundaries(request: Request, call_next):
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
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'"
        return response
    def load(table, ident):
        with db() as connection:
            row = connection.execute(f"SELECT * FROM {table} WHERE id=?", (ident,)).fetchone()
        if row is None:
            raise HTTPException(404, "Registro no encontrado")
        return dict(row)
    @app.get("/health")
    def health():
        with db() as connection:
            connection.execute("SELECT 1")
        return {"status": "ok"}
    @app.post("/api/datasets", status_code=201)
    async def dataset(request: Request, filename: str = "datos.csv", drop_incomplete: bool = False):
        try:
            headers, source = ingest(await request.body(), filename)
            rows, report = clean(source, drop_incomplete)
        except ValueError as error:
            raise HTTPException(422, str(error))
        payload = {"headers": headers, "source": source, "rows": rows, "report": report, "profile": profile(headers, rows)}
        with db() as connection:
            ident = connection.execute("INSERT INTO datasets(name,payload) VALUES(?,?)", (Path(filename).name[:120], json.dumps(payload))).lastrowid
        return {"id": ident, **payload}
    @app.get("/api/datasets")
    def datasets():
        with db() as connection:
            return [dict(row) for row in connection.execute("SELECT id,name FROM datasets ORDER BY id DESC LIMIT 100")]
    @app.get("/api/datasets/{ident}")
    def get_dataset(ident: int):
        row = load("datasets", ident)
        return {"id": ident, "name": row["name"], **json.loads(row["payload"])}
    @app.get("/api/datasets/{ident}/export")
    def export(ident: int):
        data = json.loads(load("datasets", ident)["payload"])
        return Response(export_csv(data["headers"], data["rows"]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="resultado.csv"'})
    @app.post("/api/documents", status_code=201)
    def document(data: Invoice):
        digest = hashlib.sha256(data.text.strip().encode()).hexdigest()
        fields = extract(data.text)
        payload = {"source": data.text, "fields": fields, "issues": validate(fields), "extraction": "reglas deterministas; sin OCR ni modelo"}
        with db() as connection:
            try:
                ident = connection.execute("INSERT INTO documents(digest,payload,state) VALUES(?,?,?)", (digest, json.dumps(payload), "review")).lastrowid
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Documento repetido")
        return {"id": ident, "state": "review", **payload}
    @app.get("/api/documents")
    def documents():
        with db() as connection:
            return [{"id": row["id"], "state": row["state"], **json.loads(row["payload"])} for row in connection.execute("SELECT * FROM documents ORDER BY id DESC LIMIT 100")]
    @app.get("/api/documents/{ident}")
    def get_document(ident: int):
        row = load("documents", ident)
        with db() as connection:
            audit = [json.loads(r[0]) for r in connection.execute("SELECT payload FROM decisions WHERE document_id=? ORDER BY id", (ident,))]
        return {"id": ident, "state": row["state"], **json.loads(row["payload"]), "decisions": audit}
    @app.post("/api/documents/{ident}/review")
    def review(ident: int, data: Review):
        allowed = {"supplier", "rut", "folio", "date", "net", "tax", "total"}
        if set(data.fields) != allowed or any(value is not None and not isinstance(value, (str, int)) for value in data.fields.values()):
            raise HTTPException(422, "Campos de factura inválidos")
        if any(not isinstance(data.fields[k], (str, type(None))) for k in ("supplier", "rut", "folio", "date")):
            raise HTTPException(422, "Los identificadores y fecha deben ser texto")
        issues = validate(data.fields)
        if data.decision == "approved" and issues:
            raise HTTPException(422, issues)
        with db() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM documents WHERE id=?", (ident,)).fetchone()
            if row is None:
                raise HTTPException(404, "Documento no encontrado")
            if row["state"] != "review":
                raise HTTPException(409, "El documento ya fue revisado")
            payload = json.loads(row["payload"])
            payload.update(fields=data.fields, issues=issues)
            connection.execute("UPDATE documents SET payload=?,state=? WHERE id=?", (json.dumps(payload), data.decision, ident))
            connection.execute("INSERT INTO decisions(document_id,payload) VALUES(?,?)", (ident, json.dumps({**data.model_dump(), "at": datetime.now(timezone.utc).isoformat()})))
        return get_document(ident)
    @app.get("/api/cloudops")
    def cloudops():
        with db() as connection:
            rows = [dict(row) for row in connection.execute("SELECT * FROM checks ORDER BY id DESC LIMIT 200")]
        return {"services": services, "history": rows, "deployment": None, "version": None, "note": "Comprobaciones manuales; sin uptime continuo ni datos de despliegue disponibles"}
    @app.post("/api/cloudops/check")
    def check():
        with db() as connection:
            connection.execute("BEGIN IMMEDIATE")
            previous = connection.execute("SELECT checked_at FROM checks ORDER BY id DESC LIMIT 1").fetchone()
            if previous and (datetime.now(timezone.utc) - datetime.fromisoformat(previous[0])).total_seconds() < 60:
                raise HTTPException(429, "Espera 60 segundos entre comprobaciones")
            for name, url in services.items():
                start = time.perf_counter()
                code = None
                try:
                    result = httpx.get(url, timeout=3, follow_redirects=False)
                    code = result.status_code
                except httpx.HTTPError:
                    pass
                connection.execute("INSERT INTO checks(service,checked_at,success,latency,code) VALUES(?,?,?,?,?)", (name, datetime.now(timezone.utc).isoformat(), int(code is not None and 200 <= code < 300), round((time.perf_counter()-start)*1000, 2), code))
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

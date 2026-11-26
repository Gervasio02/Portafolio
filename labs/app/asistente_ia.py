"""Respaldo con IA para el asistente del portafolio.

La red neuronal del portal responde lo que conoce. Cuando no reconoce una
pregunta, el navegador la envía a ``POST /api/asistente/ia`` y este módulo la
responde con un modelo de lenguaje del plan gratuito de Groq (API compatible
con OpenAI).

- Solo se activa si existe ``ASISTENTE_IA_CLAVE`` (secreto; sin ella responde
  503 y el chat usa su respuesta de siempre).
- El contexto sobre Gervasio sale del mismo modelo publicado del asistente
  (``/asistente/modelo.json``), así no hay dos fuentes de verdad.
- Límites: por IP (6 por minuto y 40 al día) y un tope diario global, por
  debajo del cupo gratuito del proveedor.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from collections import defaultdict, deque
from datetime import date

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from .analitica import _origenes

registro = logging.getLogger("labs.asistente_ia")

URL_GROQ = "https://api.groq.com/openai/v1/chat/completions"
# Modelos de producción de Groq, en orden de preferencia. Si la cuenta no
# tiene acceso a uno (404 model_not_found), se prueba el siguiente y se
# recuerda el que funcionó. ASISTENTE_IA_MODELO, si existe, va primero.
MODELOS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"]
TOPE_DIARIO = 800
CHARLA = {"saludo", "despedida", "gracias", "acuse", "como_estas", "hora", "molestia", "fuera_de_tema"}

REGLAS = """Eres el asistente del portafolio web de Gervasio Torres (https://gervasio.sbs).
Responde siempre en español de Chile, en primera persona como si fueras Gervasio
cuando hablas de él, en un máximo de 90 palabras y sin listas largas.

Reglas:
1. Sobre Gervasio usa SOLO los datos del CONTEXTO. Si algo no está ahí, di que
   no lo sabes y sugiere escribir a Gervasiot19@gmail.com. Nunca inventes datos
   personales, sueldos, experiencia ni tecnologías.
2. Para clima, noticias, resultados deportivos, precios o cualquier dato que
   cambie a diario, no des cifras: di que no tienes el dato al día y sugiere
   buscarlo en una fuente confiable.
3. Puedes responder preguntas generales breves (conceptos de programación,
   cultura general, conversación amable) y luego ofrecer volver al portafolio.
4. No ayudes con nada dañino, ilegal ni ofensivo; responde con amabilidad que
   solo puedes ayudar con temas del portafolio.
5. Entiendes chilenismos (pega, lucas, cachai, al tiro, po...).
6. Si incluyes un enlace, que sea https y real; ante la duda, no incluyas enlaces.

CONTEXTO:
{contexto}"""


def _texto_plano(respuesta: str) -> str:
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", respuesta)
    return re.sub(r"\{[a-z_]+\}", "", texto).strip()


def construir_contexto(modelo: dict, limite: int = 9000) -> str:
    lineas = [
        f"- {_texto_plano(i['respuesta'])}"
        for i in modelo.get("intenciones", [])
        if i.get("id") not in CHARLA and i.get("respuesta")
    ]
    return "\n".join(lineas)[:limite]


class Contexto:
    """Descarga el modelo publicado del asistente y lo guarda una hora."""

    def __init__(self):
        self.texto = ""
        self.hasta = 0.0

    def obtener(self) -> str:
        if self.texto and time.monotonic() < self.hasta:
            return self.texto
        portal = os.getenv("PORTAL_URL", "https://gervasio.sbs").rstrip("/")
        try:
            respuesta = httpx.get(f"{portal}/asistente/modelo.json", timeout=10)
            respuesta.raise_for_status()
            self.texto = construir_contexto(respuesta.json())
            self.hasta = time.monotonic() + 3600
        except (httpx.HTTPError, ValueError):
            if not self.texto:
                self.texto = "Gervasio Torres es analista programador y egresado de Ingeniería Informática (INACAP)."
            self.hasta = time.monotonic() + 300
        return self.texto


def llamar_modelo(mensajes: list[dict], clave: str, modelo: str) -> str:
    """Llama al proveedor. Se reemplaza en las pruebas."""
    cuerpo = {"model": modelo, "messages": mensajes, "temperature": 0.3, "max_tokens": 350}
    if modelo.startswith("openai/gpt-oss"):
        # Modelos con razonamiento: poco razonamiento y espacio para la respuesta.
        cuerpo.update(max_tokens=900, reasoning_effort="low")
    respuesta = httpx.post(URL_GROQ, headers={"Authorization": f"Bearer {clave}"}, json=cuerpo, timeout=25)
    respuesta.raise_for_status()
    return respuesta.json()["choices"][0]["message"]["content"]


def registrar(app: FastAPI, ip_cliente, permitido) -> None:
    contexto = Contexto()
    por_minuto: dict[str, deque] = defaultdict(deque)
    por_dia: dict[str, int] = defaultdict(int)
    uso = {"dia": date.today(), "total": 0}
    elegido: dict[str, str] = {}

    def candidatos() -> list[str]:
        preferido = os.getenv("ASISTENTE_IA_MODELO", "").strip()
        orden = ([elegido["modelo"]] if "modelo" in elegido else []) + ([preferido] if preferido else []) + MODELOS
        return list(dict.fromkeys(orden))

    def consultar(mensajes: list[dict], clave: str) -> tuple[str, str]:
        ultimo_error: Exception | None = None
        for modelo in candidatos():
            try:
                texto = llamar_modelo(mensajes, clave, modelo)
                elegido["modelo"] = modelo
                return texto, modelo
            except httpx.HTTPStatusError as error:
                if error.response.status_code in (400, 404) and "model" in error.response.text:
                    registro.warning("IA: sin acceso a %s, se prueba otro modelo.", modelo)
                    ultimo_error = error
                    continue
                raise
        raise ultimo_error or httpx.HTTPError("Sin modelos disponibles")

    def cors(request: Request, respuesta: Response) -> Response:
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen in _origenes():
            respuesta.headers["Access-Control-Allow-Origin"] = origen
            respuesta.headers["Vary"] = "Origin"
            respuesta.headers["Access-Control-Allow-Headers"] = "Content-Type"
            respuesta.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            respuesta.headers["Access-Control-Max-Age"] = "600"
        return respuesta

    @app.options("/api/asistente/ia", include_in_schema=False)
    def preflight(request: Request):
        return cors(request, Response(status_code=204))

    @app.post("/api/asistente/ia", tags=["asistente"])
    async def responder(request: Request):
        origen = (request.headers.get("origin") or "").rstrip("/")
        if origen not in _origenes():
            raise HTTPException(403, "Origen no permitido")
        clave = os.getenv("ASISTENTE_IA_CLAVE", "").strip()
        if not clave:
            return cors(request, JSONResponse({"detail": "IA no configurada"}, status_code=503))

        crudo = await request.body()
        if len(crudo) > 1024:
            raise HTTPException(413, "Pregunta demasiado grande")
        try:
            pregunta = str(json.loads(crudo or b"{}").get("pregunta", "")).strip()
        except (json.JSONDecodeError, AttributeError):
            raise HTTPException(400, "JSON inválido")
        if not 2 <= len(pregunta) <= 200:
            raise HTTPException(422, "Pregunta inválida")

        ip = ip_cliente(request)
        hoy = date.today()
        if uso["dia"] != hoy:
            uso.update(dia=hoy, total=0)
            por_dia.clear()
        if (
            not permitido(por_minuto, ip, 6, 60)
            or por_dia[ip] >= 40
            or uso["total"] >= TOPE_DIARIO
        ):
            return cors(request, JSONResponse({"detail": "Límite de preguntas alcanzado"}, status_code=429))
        por_dia[ip] += 1
        uso["total"] += 1

        mensajes = [
            {"role": "system", "content": REGLAS.format(contexto=contexto.obtener())},
            {"role": "user", "content": pregunta},
        ]
        try:
            texto, modelo = consultar(mensajes, clave)
            texto = texto.strip()
        except httpx.HTTPStatusError as error:
            # Solo el código y el mensaje del proveedor; nunca la clave.
            registro.warning("IA: el proveedor respondió %s: %s", error.response.status_code, error.response.text[:300])
            return cors(request, JSONResponse({"detail": "La IA no respondió", "codigo": error.response.status_code}, status_code=502))
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
            registro.warning("IA: fallo al consultar el proveedor (%s)", type(error).__name__)
            return cors(request, JSONResponse({"detail": "La IA no respondió"}, status_code=502))
        # Quita razonamientos que algunos modelos devuelven entre etiquetas.
        texto = re.sub(r"<think>.*?</think>", "", texto, flags=re.S).strip()[:1200]
        if not texto:
            return cors(request, JSONResponse({"detail": "La IA no respondió"}, status_code=502))
        respuesta = JSONResponse({"respuesta": texto, "modelo": modelo})
        respuesta.headers["Cache-Control"] = "no-store"
        return cors(request, respuesta)

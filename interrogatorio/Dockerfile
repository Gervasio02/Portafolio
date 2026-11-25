# Imagen única para producción: compila la interfaz y la sirve desde FastAPI.
FROM node:22-alpine AS interfaz
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Vacío = la API vive en el mismo dominio que la interfaz.
ENV VITE_API_URL=""
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/static DATABASE_URL=sqlite:////data/interrogatorio.db
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && useradd --create-home --uid 10001 detective \
 && mkdir -p /data && chown detective /data
COPY backend/app ./app
COPY --from=interfaz /web/dist ./static
USER detective
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

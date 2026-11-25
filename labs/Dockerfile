FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 LABS_DB=/data/labs.db
# Tesseract para el OCR local de DocFlow (español).
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-spa \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && useradd --create-home --uid 10001 labs && mkdir -p /data && chown labs /data
COPY app ./app
COPY web ./web
USER labs
EXPOSE 8001
CMD ["sh", "-c", "uvicorn 'app.main:create_app' --factory --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips '*'"]

# Laboratorios locales

DataLab conserva archivos tabulares normalizados en SQLite, con perfil de columnas, duplicados, tratamiento opcional de incompletos, distribuciones y exportación CSV protegida contra fórmulas. Admite CSV UTF-8 y XLSX sin fórmulas, hasta 5 MB, 10.000 filas y 64 columnas. La API conserva tanto origen como resultado y política aplicada. No ejecuta SQL ni fórmulas enviados por usuarios.

DocFlow extrae etiquetas de facturas ficticias desde texto UTF-8, PDF con texto o imágenes PNG/JPG mediante Tesseract local. Valida RUT, fecha e importes CLP y requiere revisión humana antes de aprobar. Conserva la fuente, el método de extracción y la auditoría de decisiones; no inventa campos ni usa modelos externos. Limita cada archivo a 5 MB, los PDF a 20 páginas y las imágenes a 16 megapíxeles.

CloudOps registra comprobaciones manuales del portal y cuatro aplicaciones publicadas con latencia y HTTP reales. Limita su frecuencia a una por minuto, usa una lista de destinos de servidor y nunca acepta URLs del visitante. Conserva hasta 5.000 muestras; no bloquea SQLite mientras consulta la red. Permite registrar y resolver incidentes y configurar alertas locales por entre 1 y 10 fallos consecutivos. Las alertas se evalúan al solicitar comprobaciones y abren un incidente sin duplicarlo mientras siga abierto. No envía correos, no tiene supervisión en segundo plano ni integración con Azure Monitor. No calcula uptime continuo ni inventa despliegues o versiones.

## Inicio

Desde `labs`, con Python 3.12:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:create_app --factory --port 8001
```

Abrir `http://localhost:8001/datalab`, `/docflow` o `/cloudops`. API en `/docs`. Usar el servidor estático del portal en 8080 para el enlace de regreso. Los datos quedan en `labs/data/labs.db` y no se versionan. Las pruebas usan una base temporal: `python -m pytest -q` desde esta carpeta.

Es una demostración con datos ficticios. El comando escucha solo en la interfaz local. Para varios usuarios configura `LABS_USER_TOKENS` como un objeto JSON `usuario:token`, con claves opacas de al menos 32 caracteres. Cada dataset, documento, incidente y regla de alerta queda aislado por esa identidad. La interfaz conserva el token solo durante la sesión de la pestaña y nunca lo añade a URLs. `LABS_ACCESS_TOKEN` se mantiene únicamente para compatibilidad local compartida; `APP_ENV=production` exige identidades separadas. La publicación también requiere HTTPS y una política de retención. No debe procesar documentos reales sin una evaluación adicional y no se ha desplegado.

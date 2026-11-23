# Laboratorios locales

DataLab conserva archivos tabulares normalizados en SQLite, con perfil de columnas, duplicados, tratamiento opcional de incompletos, distribuciones y exportación CSV protegida contra fórmulas. Admite CSV UTF-8 y XLSX sin fórmulas, hasta 5 MB, 10.000 filas y 64 columnas. La API conserva tanto origen como resultado y política aplicada. No ejecuta SQL ni fórmulas enviados por usuarios.

DocFlow extrae etiquetas de facturas ficticias de texto, valida RUT, fecha e importes CLP y requiere revisión humana antes de aprobar. Conserva la fuente y auditoría de decisiones; no inventa campos. La detección de duplicados usa el hash del texto. Esta versión no procesa imágenes, PDF ni OCR y no usa modelos de IA.

CloudOps registra comprobaciones manuales del portal y cuatro aplicaciones publicadas con latencia y HTTP reales. Limita su frecuencia a una por minuto, usa una lista de destinos de servidor y nunca acepta URLs del visitante. Conserva hasta 5.000 muestras; no bloquea SQLite mientras consulta la red. Permite registrar y resolver incidentes y configurar alertas locales por entre 1 y 10 fallos consecutivos. Las alertas se evalúan al solicitar comprobaciones y abren un incidente sin duplicarlo mientras siga abierto. No envía correos, no tiene supervisión en segundo plano ni integración con Azure Monitor. No calcula uptime continuo ni inventa despliegues o versiones.

## Inicio

Desde `labs`, con Python 3.12:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:create_app --factory --port 8001
```

Abrir `http://localhost:8001/datalab`, `/docflow` o `/cloudops`. API en `/docs`. Usar el servidor estático del portal en 8080 para el enlace de regreso. Los datos quedan en `labs/data/labs.db` y no se versionan. Las pruebas usan una base temporal: `python -m pytest -q` desde esta carpeta.

Es una demostración local compartida con datos ficticios. El comando escucha solo en la interfaz local. Opcionalmente configura `LABS_ACCESS_TOKEN` para proteger todas las lecturas, escrituras y exportaciones de `/api/` con `Authorization: Bearer ...`. La interfaz permite introducir la clave en «Acceso al laboratorio» y la guarda solo durante la sesión de esa pestaña; nunca se añade a URLs. Con `APP_ENV=production` se exige una clave de al menos 32 caracteres al arrancar. Una clave compartida no proporciona cuentas ni aislamiento de datos entre usuarios: la publicación multiusuario exige identidad y autorización por registro, además de HTTPS y política de retención. No debe exponerse esta base compartida con documentos reales en Internet. No se ha desplegado.

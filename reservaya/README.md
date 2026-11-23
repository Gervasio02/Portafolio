# ReservaYa

Sistema de reservas para un centro deportivo ficticio de Rancagua, Chile. Permite encontrar canchas de fútbol, pádel y tenis, confirmar un turno de 60 minutos, consultar el historial y cancelar antes de que comience. El objetivo es reducir la coordinación manual de turnos y evitar que una cancha se venda dos veces. La administración controla servicios, disponibilidad y bloqueos. El calendario visual anuncia el próximo turno libre, distingue reservas, bloqueos y horas pasadas, y refleja los cambios de disponibilidad al volver a la página o cada 30 segundos mientras está visible. El panel administrativo desglosa las reservas y su monto por fecha y cancha.

**Tecnologías:** React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, FastAPI, SQLAlchemy, PostgreSQL y Alembic.

## Demo local

Requiere Docker con Compose. Desde la carpeta `reservaya`:

```bash
docker compose up --build
```

- Aplicación: [http://localhost:8000](http://localhost:8000).
- Swagger: [http://localhost:8000/api/docs](http://localhost:8000/api/docs).
- Cliente local: `cliente@reservaya.test` / `CanchaDemo2026`.
- Administración local: `admin@reservaya.test` / `AdminDemo2026`.

Estas cuentas son de muestra para el entorno local. El correo de confirmación se simula en el log de la API. El seed crea tres canchas y horarios en la primera ejecución y conserva los datos existentes.

Prueba el flujo eligiendo una cancha, una fecha futura y una hora, e ingresando con la cuenta cliente. Confirma y visita **Mis reservas**. En el panel administrativo puedes editar servicios, filtrar el calendario por fecha y bloquear horarios.

## Desarrollo

Desde `reservaya`, ejecuta `docker compose up -d db`. Después, desde `backend`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql+psycopg://reservaya:reservaya_local@127.0.0.1:5434/reservaya
export JWT_SECRET=reservaya-local-only-use-a-different-key-in-production
export COOKIE_SECURE=false
alembic upgrade head
DEMO_PASSWORD=CanchaDemo2026 ADMIN_EMAIL=admin@reservaya.test ADMIN_PASSWORD=AdminDemo2026 python -m app.seed
uvicorn app.main:create_app --factory --reload --port 8000
```

En otra terminal, desde `frontend`:

```bash
npm ci
npm run dev
```

Vite atiende en `localhost:5174` y envía `/api` al puerto 8000. Se recomienda Node 24.

## Pruebas y calidad

Desde `backend` con el entorno virtual activo:

```bash
export RESERVAYA_TEST_DATABASE_URL=postgresql+psycopg://reservaya:reservaya_local@127.0.0.1:5434/reservaya_test
ruff check app alembic tests
ruff format --check app alembic tests
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

La suite usa una BD separada cuyo nombre termina en `_test` porque aplica y revierte migraciones entre pruebas. Dos hilos intentan reservar la misma cancha y se comprueba que solo uno logra confirmar. Otra prueba cruza el bloqueo administrativo con la reserva concurrente.

Desde `frontend`:

```bash
npm run lint
npm test
npm run build
```

## API y arquitectura

| Método y ruta | Función |
|---|---|
| POST `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Crear cuenta, entrar y salir |
| GET `/api/auth/me` | Sesión actual |
| GET `/api/services`, `/api/services/{id}/availability?day=YYYY-MM-DD` | Catálogo y disponibilidad |
| GET / POST `/api/bookings` | Historial y creación |
| DELETE `/api/bookings/{id}` | Cancelación |
| GET `/api/admin/bookings`, `/api/admin/courts` | Calendario y canchas |
| GET / POST `/api/admin/services`, PUT `/api/admin/services/{id}` | Servicios |
| GET / PUT `/api/admin/courts/{id}/schedule` | Horario semanal |
| GET / POST `/api/admin/courts/{id}/blocks`, DELETE `/api/admin/blocks/{id}` | Bloqueos puntuales |

Consulta el [modelo de datos y las decisiones](docs/design.md).

Capturas del flujo real con datos de muestra: [catálogo](docs/screenshots/catalogo.png), [reserva](docs/screenshots/reserva.png), [panel de administración](docs/screenshots/admin.png) y [vista móvil](docs/screenshots/movil.png).

## Despliegue público

La aplicación se empaqueta como una imagen Docker con frontend y API bajo el mismo dominio. Puede correrse en un servicio de contenedores que soporte HTTPS y con una base PostgreSQL accesible mediante TLS.

1. Construye la imagen desde `reservaya` con `docker build -t reservaya:1.0.0 .`. Crea una BD PostgreSQL exclusiva para ReservaYa y guarda su conexión con TLS.
2. Configura las variables privadas en el hospedaje. Usa `DATABASE_URL` con `sslmode=require`, `JWT_SECRET` (32 bytes o más, por ejemplo `openssl rand -hex 32`), `COOKIE_SECURE=true` y tus credenciales administrativas en `ADMIN_EMAIL` y `ADMIN_PASSWORD`. La contraseña debe tener al menos 10 caracteres. `DEMO_PASSWORD` es opcional y crea solo una cuenta cliente de muestra.
3. Configura el puerto 8000 (o define `PORT`), el endpoint de salud `/api/health` y una réplica inicial. Arranca la imagen con HTTPS. El arranque aplica migraciones Alembic, incorpora el seed inicial y atiende la API y la web.
4. Comprueba desde el dominio HTTPS que se carguen las canchas y que se pueda iniciar sesión, crear una reserva y verla en el historial. Verifica el acceso administrativo desde una sesión independiente.
5. Si el despliegue usa servicios de pago, verifica antes los créditos, las cuotas y el costo de mantener PostgreSQL y el contenedor. Los contenedores y PostgreSQL también se pueden alojar en un mismo servidor con Docker y un proxy de HTTPS, configurando credenciales propias, respaldo de la BD y acceso privado para PostgreSQL.

Futuras mejoras: recordatorios por correo, exportación CSV, lista de espera y una sesión con revocación del lado del servidor.

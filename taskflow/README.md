# TaskFlow

## SLA y notificaciones internas

Cada tarjeta permite configurar un SLA de 1 a 8.760 horas corridas desde su creación. No usa horario laboral ni sustituye la fecha límite del calendario. Editar la cantidad de horas recalcula el vencimiento desde la creación original; dejarla vacía retira el SLA. Solo dueños y editores pueden modificarlo.

El centro de control consulta `/api/operations` y muestra cumplimiento, tareas fuera de SLA y estadísticas por responsable usando únicamente los tableros accesibles para la sesión. Las alertas corresponden a tareas abiertas cuyo SLA venció. La marca de lectura es persistente y privada por usuario y vencimiento. No se envían correos ni notificaciones del sistema operativo.

Mover una tarjeta a Hecho registra su fecha de cierre; reabrirla la elimina y un cierre posterior vuelve a evaluarse. Los cierres anteriores a esta función mantienen fecha desconocida: no se inventa cumplimiento histórico. Las alertas desaparecen cuando se cierra la tarjeta o se retira su SLA. Se actualizan con el mecanismo de consulta periódica existente, que suspende las consultas en pestañas ocultas.

Tablero Kanban colaborativo para equipos que coordinan entregas e incidencias.
El objetivo es detectar a tiempo el trabajo que puede bloquear una entrega.
Cada tablero puede describir su objetivo y tiene su propio propietario,
editores y lectores. PostgreSQL guarda tarjetas, prioridades, plazos y roles.

El **Centro de control** abre al iniciar sesión. Muestra avance y distribución
por estado, prioridad y tablero, y ordena las tarjetas vencidas abiertas.
Desde allí puedes ir al tablero correspondiente y trabajar la excepción.

## Inicio rápido

Con Docker y Docker Compose:

```sh
docker compose up --build
```

Abre [localhost:3001](http://localhost:3001). Selecciona **Entrar como invitado de
demo** para conocer el centro de control y dos tableros de muestra. Esta
cuenta tiene permisos de lectura. Registra una cuenta propia para crear un tablero, añadir y mover tarjetas
e invitar a alguien. En Docker local también puedes usar
`equipo@taskflow.example` / `TaskFlow-local-owner-2026` para editar el tablero de
muestra. Estas credenciales de ejemplo son para ejecución local.

Las invitaciones generan un enlace para copiar y compartir de forma manual al
correo indicado. El destinatario accede con ese correo y canjea el enlace una
sola vez. El enlace es válido durante siete días.

## Desarrollo

Node.js 24 recomendado. Copia `.env.example` a `.env`, ajusta las variables si no
usas la base local de Compose y ejecuta:

```sh
docker compose up -d db
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run api:dev
```

En otra terminal, `npm run dev` y abre [localhost:5173](http://localhost:5173).
Vite pasa las llamadas de `/api` a Express en el puerto 3001. En Docker y en
producción Express sirve el frontend compilado y la API desde el mismo origen.

## Historias de usuario

- Como usuario nuevo, puedo registrarme, crear un tablero y dar de alta tarjetas.
- Como dueño, puedo describir el objetivo, editar o eliminar el tablero,
  invitar y administrar miembros.
- Como editor, puedo agregar, editar, ordenar y mover tarjetas.
- Como lector, puedo consultar y filtrar tarjetas sin cambiar el tablero.
- Como miembro de un equipo, puedo revisar indicadores de mis tableros,
  localizar tarjetas vencidas y ver los cambios de otra sesión.

## Modelo y decisiones

```mermaid
erDiagram
  USER ||--o{ SESSION : inicia
  USER ||--o{ MEMBERSHIP : tiene
  BOARD ||--o{ MEMBERSHIP : permite
  BOARD ||--o{ INVITATION : genera
  BOARD ||--|{ COLUMN : contiene
  COLUMN ||--o{ CARD : ordena
```

`src/` contiene la app React y sus pruebas. `server/` separa Express,
autenticación, reglas de tableros y consultas del centro de control. `prisma/`
contiene el esquema, las migraciones y los datos de ejemplo. `tests/` ejecuta la API real contra PostgreSQL.

- **Express y Prisma.** Express permite que el control de acceso sea visible en
  cada ruta. Prisma versiona el esquema y crea consultas con parámetros.
- **Sesiones.** Bcrypt guarda contraseñas hasheadas. El JWT de acceso dura 15
  minutos y vive en memoria del cliente. El JWT de renovación se rota mediante
  cookie HttpOnly; en PostgreSQL se guarda solo su hash. Cerrar sesión elimina
  esa sesión de renovación y borra su cookie.
- **Orden de tarjetas.** Las escrituras relacionadas bloquean la fila del
  tablero en PostgreSQL y comprueban el rol dentro de la transacción. Esto
  serializa altas y movimientos concurrentes en el mismo tablero. Una sola
  sentencia parametrizada guarda el orden de toda la columna de destino.
- **Invitaciones.** Solo el dueño puede emitirlas. Se guarda el hash de un token
  aleatorio, no el enlace. La persona debe demostrar que recibió el enlace y
  autenticarse con el correo correspondiente. El sistema registra el correo
  declarado pero no autentica todos los correos con un proveedor externo.
- **Drag and drop.** dnd-kit habilita ratón y teclado. La ficha de tarjeta también
  permite cambiar la columna desde un selector, incluso con filtros activos.
- **Indicadores.** La API calcula los resúmenes en PostgreSQL dentro de una
  transacción de solo lectura lógica con aislamiento de lectura repetible. Los
  filtros de membresía preceden los conteos. Se define como vencida una tarjeta
  fuera de «Hecho» cuya fecha límite es anterior al día en la zona horaria del
  navegador. El avance es el porcentaje de tarjetas en «Hecho».
- **Actualización.** El navegador consulta el servidor cada ocho segundos
  mientras la pestaña está visible y al regresar a ella. En el tablero pausa
  las consultas durante un arrastre, cambio o edición y las retoma al terminar.
  El centro de control conserva la última lectura si falla la red.
- **Errores.** Zod valida solicitudes. La API devuelve errores JSON. Los logs
  indican duración, resultado y un identificador, sin cuerpos ni tokens.

## API

| Ruta                                                        | Acceso y uso                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/dashboard?tz=America%2FSantiago`                  | Autenticado. Indicadores y hasta 20 tarjetas vencidas de tableros accesibles.            |
| `GET /api/health`                                           | Público. Comprueba conexión con PostgreSQL.                                              |
| `POST /api/auth/register`, `/login`                         | Público. JSON con correo/contraseña; el registro también recibe nombre.                  |
| `POST /api/auth/refresh`, `/logout`                         | Cookie de renovación.                                                                    |
| `GET /api/boards`, `GET /api/boards/:id`                    | Miembro. Lista y detalle, respectivamente.                                               |
| `POST /api/boards`                                          | Autenticado. Creación con `title` y `objective` opcional.                                |
| `PATCH /api/boards/:id`, `DELETE /api/boards/:id`           | Dueño. Actualiza `title` y `objective` opcional, o elimina.                              |
| `POST /api/boards/:id/cards`                                | Dueño/editor. Recibe `title`, `columnId`, `description`, `priority`, `dueAt` y `labels`. |
| `PATCH /api/boards/:id/cards/:cardId`, `DELETE …/:cardId`   | Dueño/editor. Modifica o elimina una tarjeta.                                            |
| `POST /api/boards/:id/cards/:cardId/move`                   | Dueño/editor. Recibe `columnId` y `beforeId` opcional.                                   |
| `POST /api/boards/:id/invitations`                          | Dueño. Recibe `email` y `role` (`EDITOR` o `VIEWER`).                                    |
| `POST /api/invitations/accept`                              | Autenticado. Recibe `token` como JSON.                                                   |
| `PATCH /api/boards/:id/members/:userId`, `DELETE …/:userId` | Dueño. Modifica rol o retira a un miembro.                                               |

En rutas protegidas envía `Authorization: Bearer <accessToken>`.
Las fechas límite usan `AAAA-MM-DD` y las prioridades son `LOW`,
`MEDIUM` y `HIGH`.

## Calidad y pruebas

Para verificación local con Compose, crea la base de datos separada una vez:

```sh
docker compose exec db createdb -U taskflow taskflow_test
DATABASE_URL=postgresql://taskflow:taskflow_local_only@localhost:5433/taskflow_test npm run db:migrate
TEST_DATABASE_URL=postgresql://taskflow:taskflow_local_only@localhost:5433/taskflow_test npm test
npm run lint
npm run build
```

Jest incluye pruebas unitarias del orden de tarjetas. Jest y Supertest prueban sesiones, aislamiento, permisos, invitaciones, CRUD y
concurrencia de tarjetas contra PostgreSQL. El umbral de API es 70 % para
ramas, funciones, líneas y sentencias. React Testing Library cubre registro,
errores de acceso, filtro de tarjetas y recuperación del centro de control.
Los tests verifican la actualización de indicadores luego de cambios desde otra
sesión y que un lector nunca cuente tableros privados o con acceso revocado. GitHub Actions arranca PostgreSQL y
ejecuta migración, lint, pruebas y compilación en cada push/PR.

Sugerencias de commits por fase: `docs: define taskflow requirements`,
`feat: implement boards and sessions`, `test: exercise authorization and card order`,
`feat: build kanban workspace`, `test: cover sign-up and filtering`,
`chore: configure compose and ci`, `docs: document taskflow architecture`,
`chore: prepare container deployment`.

## Despliegue de demo

La aplicación puede desplegarse como un contenedor Docker con una base PostgreSQL
administrada o existente:

1. Publica el código en tu repositorio personal y usa esta carpeta como contexto
   de compilación. Ejecuta `docker build -t taskflow .` para reproducir la imagen.
2. Crea una base PostgreSQL dedicada y un usuario con permisos para crear y
   modificar las tablas de TaskFlow. Copia la URL de conexión directa, con TLS
   habilitado si el proveedor lo requiere.
3. Configura `DATABASE_URL`, `ACCESS_TOKEN_SECRET` y `REFRESH_TOKEN_SECRET`
   en el entorno del contenedor. Los secretos deben ser distintos y tener al
   menos 32 caracteres. Usa `NODE_ENV=production`, conserva el puerto 3001 o
   define `PORT` según el proveedor y sirve la aplicación con HTTPS.
4. Si hay exactamente un proxy inverso de confianza delante de Express, define
   `TRUST_PROXY=1`. La aplicación sirve frontend y API desde el mismo origen
   por defecto; omite `APP_ORIGIN` en este caso.
5. La imagen de aplicación ejecuta `prisma migrate deploy` antes de abrir el
   servidor, de modo que una revisión nueva no atiende tráfico con un esquema
   antiguo. Si tu plataforma exige separar ese paso, crea la imagen de
   migraciones con `docker build --target db-tools -t taskflow-db-tools .` y
   ejecútala una sola vez antes de actualizar el servicio.
6. Inicia la imagen de aplicación y comprueba `/api/health`. Registra un
   usuario y verifica crear y mover una tarjeta. Para habilitar la cuenta de
   demo, ejecuta previamente `NODE_ENV=production npm run db:seed` en un
   entorno con las herramientas de Prisma o en la imagen `taskflow-db-tools`,
   pasando `DATABASE_URL` y `DEMO_OWNER_PASSWORD` (16–72 bytes).

Consulta las capturas del centro de control en
[escritorio](docs/screenshots/taskflow-control.png) y
[móvil](docs/screenshots/taskflow-control-mobile.png), y del tablero en
[escritorio](docs/screenshots/taskflow-desktop.png) y
[móvil](docs/screenshots/taskflow-mobile.png). Para repetir el flujo visual,
registra una cuenta nueva, crea un tablero y una tarjeta, arrástrala a
**En progreso** y recarga para comprobar la persistencia.

Para una versión posterior: eventos en tiempo real, documentación OpenAPI y un buzón de
correo para automatizar el envío de invitaciones.

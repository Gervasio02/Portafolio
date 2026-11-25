# Portafolio de Gervasio Torres

Cinco aplicaciones y tres laboratorios de ingeniería informática, con datos
ficticios y almacenamiento aislado. La portada en `portal/` incluye un carrusel,
un catálogo común de ocho proyectos y demos interactivas. Abre
`portal/index.html` para probarlas.

| Aplicación                                 | Stack                                           | Decisión que conviene explicar en una entrevista                                                                         |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [TaskFlow](taskflow/README.md)             | React, Express, Prisma y PostgreSQL             | Supervisa entregas e incidentes por tablero. El panel resume la distribución y usa los permisos de cada miembro.         |
| [ReservaYa](reservaya/README.md)           | React, FastAPI, SQLAlchemy y PostgreSQL         | Consulta la cancha, elige un turno y controla su ocupación. La base impide las reservas duplicadas.                      |
| [TiendaNova](tiendanova/README.md)         | Next.js, Auth.js, Prisma y PostgreSQL           | Recorre la compra y sigue el pedido hasta la entrega. La confirmación descuenta el inventario dentro de una transacción. |
| [Snake](snake/README.md)                   | React, TypeScript, Express, Prisma y PostgreSQL | Reproduce la partida en el servidor para validar puntajes y conserva desafíos, logros e historial.                       |
| [Interrogatorio](interrogatorio/README.md) | React, FastAPI, SQLAlchemy y PostgreSQL/SQLite  | Genera expedientes deterministas con cronología y conexiones de evidencias sin depender de un modelo externo.            |
| [Laboratorios](labs/README.md)             | FastAPI, Python y SQLite                        | DataLab, DocFlow y CloudOps mantienen resultados, auditoría e identidad aislada sin inventar telemetría.                 |

## Ejecutar en el computador

Instala Git y Docker con Compose. Descomprime el proyecto y sigue el README de cada aplicación para configurar su `.env.example` y ejecutar `docker compose up --build` desde la carpeta correspondiente. Cada README indica los puertos, la migración y las credenciales de demostración si aplica. Para la portada, abre `portal/index.html` o ejecuta `python -m http.server 8080 --directory portal` desde esta carpeta.

El repositorio público [Gervasio02/Portafolio](https://github.com/Gervasio02/Portafolio)
reúne la portada, las aplicaciones y los laboratorios. Sus flujos de GitHub
Actions están en `.github/workflows/`.

## Cuenta personal de GitHub

La sesión de GitHub abierta en el navegador y la sesión de Git en la terminal se comprueban por separado. En el PC, usa `gh auth status` para verificar qué cuenta está activa. Si la personal no aparece, ejecuta `gh auth login --hostname github.com --web` y selecciona tu perfil personal en la pantalla de GitHub. Si ambas aparecen, usa `gh auth switch --hostname github.com` para seleccionar la personal. No uses la cuenta de empresa como destino de este código.

Para dar acceso a ChatGPT, abre Configuración → Complementos → GitHub y autoriza el perfil personal. Si necesitas el proyecto local desde el teléfono, abre Configuración → Conexiones en la aplicación de escritorio del PC y selecciona el equipo desde Codex o Remote en el teléfono después de emparejarlo.

## Operación y costos

- **Portada**: alojamiento estático. [Vista publicada](https://portafolio-gervasio-torres.aloycmexico-9087.chatgpt.site). Su código es portable.
- **TaskFlow, ReservaYa, Snake e Interrogatorio**: un servicio HTTPS por
  aplicación que ejecute su contenedor y una base autorizada cuando corresponda.
  Si el proveedor pausa servicios por inactividad, la primera solicitud puede
  demorar.
- **TiendaNova**: Vercel Hobby para el proyecto personal y un PostgreSQL administrado, por ejemplo una base dedicada en Supabase. Las compras son simuladas.
- Mantén las credenciales en las variables de entorno de cada proveedor. Crea los datos de demo según el README respectivo. Antes de enlazar una demo pública desde la portada, prueba su flujo principal desde la URL publicada.

Referencias oficiales: [PostgreSQL en Supabase](https://supabase.com/docs/guides/database/overview) y [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Consulta [PUBLICACION.md](PUBLICACION.md) para preparar GitHub y Azure.

## Catálogo y laboratorios

El catálogo en `portal/proyectos/` permite buscar por nombre, tipo y tecnologías
y consultar arquitectura y aprendizajes. DataLab, DocFlow y CloudOps se ejecutan
localmente desde [labs/README.md](labs/README.md); sus enlaces indican esa
condición. La certificación de las once fases, pruebas y límites de publicación
está en [docs/ROADMAP.md](docs/ROADMAP.md).

## Administrar el portafolio

El repositorio de GitHub funciona como gestor de archivos con historial y
recuperación. Abre [Gervasio02/Portafolio](https://github.com/Gervasio02/Portafolio),
elige una carpeta y usa **Edit file** para modificar un archivo; la tecla `.`
abre el editor completo de GitHub. Los cambios de TaskFlow, ReservaYa,
TiendaNova y Snake que llegan a `main` se prueban, construyen y despliegan en
Azure. La operación, las URL públicas y el procedimiento de recuperación están
en [GESTION_PORTAFOLIO.md](GESTION_PORTAFOLIO.md).

## Pruebas con PostgreSQL local en Windows

Usa PowerShell 7, Node 24, las dependencias npm instaladas y el entorno Python de ReservaYa en `reservaya/backend/.venv` con `requirements-dev.txt`. Los [binarios oficiales de PostgreSQL para Windows](https://www.enterprisedb.com/download-postgresql-binaries) pueden extraerse fuera del repositorio, sin instalar un servicio del sistema. En este equipo se verificó PostgreSQL 16.15.

```powershell
.\scripts\Test-LocalDatabases.ps1 -PgBin 'C:\ruta\pgsql\bin'
# Repetir solo una aplicación:
.\scripts\Test-LocalDatabases.ps1 -Application taskflow
```

El valor predeterminado de `PgBin` es `%LOCALAPPDATA%/CodexTools/postgresql-test/pgsql/bin`. El script crea su propio clúster bajo `%LOCALAPPDATA%/CodexTools/postgresql-test/server`, escucha en `127.0.0.1:55432` y mantiene tres bases cuyos nombres terminan en `_test`. Aplica migraciones, genera clientes y ejecuta pruebas de API, interfaz y cobertura existentes. ReservaYa prueba además migraciones de ida y vuelta y operaciones concurrentes.

La contraseña se genera aleatoriamente y se conserva cifrada con la cuenta Windows mediante Export-Clixml. No se guarda en el repositorio ni se imprime. El servidor se detiene al terminar si lo inició el script y las variables de entorno se restauran. El script no descarga dependencias ni modifica bases productivas. Las pruebas de ReservaYa reinician su esquema de pruebas; utiliza exclusivamente el clúster aislado indicado.

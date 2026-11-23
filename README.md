# Portafolio de Gervasio Torres

Tres aplicaciones full stack de ingeniería informática, con datos ficticios y bases PostgreSQL separadas. La portada en `portal/` incluye un carrusel y una página y demo interactiva para cada aplicación. Las demos públicas usan datos ficticios en el navegador. Abre `portal/index.html` para probarlas.

| Aplicación | Stack | Decisión que conviene explicar en una entrevista |
| --- | --- | --- |
| [TaskFlow](taskflow/README.md) | React, Express, Prisma y PostgreSQL | Supervisa entregas e incidentes por tablero. El panel resume la distribución y usa los permisos de cada miembro. |
| [ReservaYa](reservaya/README.md) | React, FastAPI, SQLAlchemy y PostgreSQL | Consulta la cancha, elige un turno y controla su ocupación. La base impide las reservas duplicadas. |
| [TiendaNova](tiendanova/README.md) | Next.js, Auth.js, Prisma y PostgreSQL | Recorre la compra y sigue el pedido hasta la entrega. La confirmación descuenta el inventario dentro de una transacción. |

## Ejecutar en el computador

Instala Git y Docker con Compose. Descomprime el proyecto y sigue el README de cada aplicación para configurar su `.env.example` y ejecutar `docker compose up --build` desde la carpeta correspondiente. Cada README indica los puertos, la migración y las credenciales de demostración si aplica. Para la portada, abre `portal/index.html` o ejecuta `python -m http.server 8080 --directory portal` desde esta carpeta.

El repositorio público [Gervasio02/Portafolio](https://github.com/Gervasio02/Portafolio) reúne la portada y las tres aplicaciones. Sus flujos de GitHub Actions están en `.github/workflows/`.

## Cuenta personal de GitHub

La sesión de GitHub abierta en el navegador y la sesión de Git en la terminal se comprueban por separado. En el PC, usa `gh auth status` para verificar qué cuenta está activa. Si la personal no aparece, ejecuta `gh auth login --hostname github.com --web` y selecciona tu perfil personal en la pantalla de GitHub. Si ambas aparecen, usa `gh auth switch --hostname github.com` para seleccionar la personal. No uses la cuenta de empresa como destino de este código.

Para dar acceso a ChatGPT, abre Configuración → Complementos → GitHub y autoriza el perfil personal. Si necesitas el proyecto local desde el teléfono, abre Configuración → Conexiones en la aplicación de escritorio del PC y selecciona el equipo desde Codex o Remote en el teléfono después de emparejarlo.

## Operación y costos

- **Portada**: alojamiento estático. [Vista publicada](https://portafolio-gervasio-torres.aloycmexico-9087.chatgpt.site). Su código es portable.
- **TaskFlow y ReservaYa**: un servicio HTTPS por aplicación que ejecute el Dockerfile y un PostgreSQL administrado. Si el proveedor pausa servicios por inactividad, la primera solicitud puede demorar. Consulta los límites y las condiciones vigentes antes de contratar recursos.
- **TiendaNova**: Vercel Hobby para el proyecto personal y un PostgreSQL administrado, por ejemplo una base dedicada en Supabase. Las compras son simuladas.
- Mantén las credenciales en las variables de entorno de cada proveedor. Crea los datos de demo según el README respectivo. Antes de enlazar una demo pública desde la portada, prueba su flujo principal desde la URL publicada.

Referencias oficiales: [PostgreSQL en Supabase](https://supabase.com/docs/guides/database/overview) y [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Consulta [PUBLICACION.md](PUBLICACION.md) para preparar GitHub y Azure.

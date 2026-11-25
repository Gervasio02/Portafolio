# Snake

Juego de Snake para el portafolio de Gervasio Torres. Se puede jugar como
invitado y elegir entre tres modos. Las cuentas permiten guardar puntajes
verificados y consultar ranking, historial y logros. El desafío diario usa una
meta y una semilla estables para la fecha local.

## Ejecución

Con Node.js 22 y PostgreSQL, copia `.env.example` a `.env`, configura los secretos y ejecuta `npm ci`, `npx prisma generate`, `npx prisma migrate deploy` y `npm run dev:api`. En otra terminal ejecuta `npm run dev`, con `VITE_API_URL=http://localhost:3001`. Con Docker, `docker compose up --build` sirve el juego en `http://localhost:8080`; la imagen de API aplica las migraciones antes de iniciar el servidor.

`npm test` ejecuta las pruebas del motor, progreso y API; `npm run build`
compila la interfaz. El resultado incluye manifiesto, icono y service worker para
instalación básica como PWA. El service worker no almacena respuestas de
`/api/`.

## Arquitectura y seguridad

El motor de `src/engine.ts` es independiente del navegador y utiliza una semilla. El servidor reproduce los movimientos y rechaza puntajes que no coinciden o partidas incompletas. Esto no impide automatizar una partida ni fabricar una secuencia válida: no es protección completa contra trampas. El servidor usa Express, Zod, PostgreSQL y Prisma; las contraseñas se guardan con bcrypt, el token de acceso es de corta duración y la sesión renovable se guarda como hash y se transmite en una cookie HttpOnly. El acceso y los envíos tienen límites de frecuencia.

## API

- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- `GET /api/ranking?mode=classic|wrap|timed`
- `GET /api/profile`
- `POST /api/games` y `GET /api/games/:id/replay`

## Progreso y límites

La interfaz muestra avance de logros por puntaje, partidas y modos, además del
desafío diario. La mejor marca y el desafío se conservan localmente para
invitados; el ranking y el perfil global requieren el servidor y una sesión. La
repetición se conserva como datos de API, todavía sin controles visuales de
reproducción. La validación del servidor dificulta puntajes inventados, pero no
impide automatizar una secuencia de movimientos válida.

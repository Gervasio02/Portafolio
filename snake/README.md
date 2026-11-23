# Snake

Juego de Snake para el portafolio de Gervasio Torres. Se puede jugar como invitado y elegir entre tres modos. Las cuentas permiten guardar puntajes verificados y consultar el ranking y el historial.

## Ejecución

Con Node.js 22 y PostgreSQL, copia `.env.example` a `.env`, configura los secretos y ejecuta `npm ci`, `npx prisma generate`, `npx prisma migrate deploy` y `npm run dev:api`. En otra terminal ejecuta `npm run dev`, con `VITE_API_URL=http://localhost:3001`. Con Docker, `docker compose up --build` sirve el juego en `http://localhost:8080`.

`npm test` ejecuta las pruebas disponibles y `npm run build` compila la interfaz.

## Arquitectura y seguridad

El motor de `src/engine.ts` es independiente del navegador y utiliza una semilla. El servidor reproduce los movimientos y rechaza puntajes que no coinciden o partidas incompletas. Esto no impide automatizar una partida ni fabricar una secuencia válida: no es protección completa contra trampas. El servidor usa Express, Zod, PostgreSQL y Prisma; las contraseñas se guardan con bcrypt, el token de acceso es de corta duración y la sesión renovable se guarda como hash y se transmite en una cookie HttpOnly. El acceso y los envíos tienen límites de frecuencia.

## API

- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- `GET /api/ranking?mode=classic|wrap|timed`
- `GET /api/profile`
- `POST /api/games` y `GET /api/games/:id/replay`

## Límites

La repetición existe como datos de API, sin controles visuales. Faltan PWA, selector de temas, OpenAPI, pruebas completas de extremo a extremo, las metas de cobertura originales, datos de muestra, la estructura de monorepo y herramientas de calidad del requerimiento. La mejor marca local pertenece al navegador; el ranking global requiere el servidor y una sesión.

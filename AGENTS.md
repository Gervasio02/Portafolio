# Instrucciones para agentes (Codex, Claude y otros)

Este archivo es la fuente única de reglas para cualquier asistente de IA que
trabaje en el repositorio. Codex lo lee como `AGENTS.md`; Claude lo carga
desde `CLAUDE.md`. Si cambias una regla, cámbiala **aquí**.

Responde y escribe siempre en **español** (código, commits y documentación).

## Qué es este repositorio

Portafolio de Gervasio Torres (estudiante de ingeniería informática, Chile).
Cuenta de GitHub personal: `Gervasio02`. Nunca uses una cuenta de empresa.

| Carpeta           | Stack                                        | Despliegue                        |
| ----------------- | -------------------------------------------- | --------------------------------- |
| `portal/`         | HTML, CSS y JS sin frameworks                | GitHub Pages (y Azure SWA opcional) |
| `taskflow/`       | React, Express, Prisma, PostgreSQL           | Azure Container Apps              |
| `reservaya/`      | React, FastAPI, SQLAlchemy, PostgreSQL       | Azure Container Apps              |
| `tiendanova/`     | Next.js, Auth.js, Prisma, PostgreSQL         | Azure Container Apps              |
| `snake/`          | React, TypeScript, Express, Prisma           | Azure Container Apps              |
| `interrogatorio/` | React, FastAPI, SQLAlchemy                   | Sin desplegar (solo demo en portal) |
| `labs/`           | FastAPI, Python, SQLite                      | Solo local                        |
| `tests/interrogatorio/` | Playwright para todo `portal/`         | CI                                |

URLs públicas y recuperación: `GESTION_PORTAFOLIO.md`. Publicación: `PUBLICACION.md`.

## Trabajo entre dos IAs (evitar conflictos)

1. **Antes de empezar:** `git pull` (o `git fetch` + revisar `git log origin/main`).
   La otra IA puede haber subido cambios desde otra copia del repo.
2. **Trabaja en una rama** con prefijo de la herramienta: `codex/<tema>` o
   `claude/<tema>`. Abre un pull request hacia `main`; no hagas push directo a
   `main` salvo que Gervasio lo pida.
3. **Un tema por rama.** No mezcles rediseños con cambios de backend.
4. Al terminar, deja en la descripción del PR: qué cambió, cómo se probó y qué
   quedó pendiente. Así la otra IA puede continuar sin adivinar.
5. No reescribas historial (`push --force`) en ramas compartidas.

## Reglas de código

- Mantén el stack y el estilo de cada app; no mezcles frameworks entre proyectos.
- `portal/` debe funcionar sin backend y sin pasos de build: abrir
  `portal/index.html` tiene que bastar. Usa rutas **relativas** (se publica en
  `https://gervasio02.github.io/Portafolio/`, no en la raíz del dominio).
- Imágenes del portal en `portal/capturas/`, en WebP (720 y 1200 px) con un
  PNG/JPG de respaldo solo cuando se use en `<picture>`.
- La portada (`portal/index.html`) es HTML estático escrito a mano.
  El catálogo (`portal/proyectos/`) se genera desde `portal/projects-data.js`.
  Si agregas o cambias un proyecto, actualiza **ambos**.
- El texto de la portada está en primera persona y con tono humano: evita
  frases de marketing genéricas y no inventes datos personales. Los bloques
  marcados `<!-- EDITA: ... -->` los completa Gervasio.
- Solo datos ficticios. Nada de credenciales reales en el repo: van en `.env`
  (ignorado) y en `.env.example` solo con valores de ejemplo.
- Al cambiar una app, actualiza su `README.md` (ejecución, puertos,
  migraciones, credenciales de demo).

## Comandos de verificación

| Qué                  | Comando (desde la carpeta indicada)                                   |
| -------------------- | --------------------------------------------------------------------- |
| Portal               | `tests/interrogatorio`: `npm ci && npx playwright install chromium && npm test` |
| Ver portal en local  | raíz: `python -m http.server 8080 --directory portal`                 |
| TaskFlow             | `taskflow`: `npm ci && npm run lint && npm test && npm run build` (requiere PostgreSQL) |
| ReservaYa backend    | `reservaya/backend`: `python -m pytest`                               |
| ReservaYa frontend   | `reservaya/frontend`: `npm ci && npm run lint && npm test && npm run build` |
| TiendaNova           | `tiendanova`: `npm ci && npm run lint && npm test && npm run build`   |
| Snake                | `snake`: `npm ci && npm test && npm run build`                        |
| Interrogatorio       | `interrogatorio/backend`: `python -m pytest`; `interrogatorio/frontend`: `npm run build` |
| Labs                 | `labs`: `python -m pytest -q`                                         |

Si no puedes ejecutar algo (por ejemplo, falta PostgreSQL), dilo en el PR con
el comando exacto. CI (`.github/workflows/`) corre todo en cada push y PR.

Antes de dar por terminado un cambio en `portal/`, revísalo en 1440, 390 y
320 px de ancho, sin desbordes horizontales.

## Despliegue (ojo: llegar a `main` publica)

- Push a `main` con cambios en `taskflow/`, `reservaya/`, `tiendanova/` o
  `snake/` → pruebas → imagen en Azure Container Registry → nueva revisión en
  Azure Container Apps (grupo `rg-portafolio-gervasio`).
- Push a `main` con cambios en `portal/` → pruebas Playwright → GitHub Pages.
- Nunca escribas tokens, secretos ni cadenas de conexión: los configura
  Gervasio en GitHub (Settings → Secrets and variables) o en Azure.

## Archivos locales que no se suben

`CONTROL.local.md` y cualquier `.env` están en `.gitignore`.

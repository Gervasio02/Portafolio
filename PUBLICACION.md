# Publicación del portafolio

La portada (`portal/`) es un sitio estático: HTML, CSS y JavaScript sin build.
Se puede alojar en cualquier servidor de archivos. Las aplicaciones completas
(TaskFlow, ReservaYa, TiendaNova y Snake) ya se despliegan solas en Azure
Container Apps; ver `GESTION_PORTAFOLIO.md`.

## Opción recomendada: GitHub Pages (gratis, automático)

Con esta opción editas la portada desde cualquier lugar (GitHub web, el
teléfono, Codex o Claude) y se publica sola al llegar a `main`.

**Configuración (una sola vez):**

1. Abre <https://github.com/Gervasio02/Portafolio/settings/pages>.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a **Actions → Publicar portada → Run workflow** (rama `main`).
4. Cuando termine, la portada queda en
   **<https://gervasio02.github.io/Portafolio/>**.

**Después:** cada push a `main` que toque `portal/` ejecuta las pruebas de
Playwright y, si pasan, publica la nueva versión en 1–2 minutos.

**Editar desde cualquier lugar:**

- En el navegador: abre el repositorio y pulsa la tecla `.` para abrir
  `github.dev` (VS Code en la web). Edita `portal/index.html`, haz commit en una
  rama y abre un pull request; al hacer merge se publica.
- Desde Codex o Claude: pídeles el cambio; siguen las reglas de `AGENTS.md`
  (rama + PR).
- En el PC: GitHub Desktop → *Pull* → editar → *Commit* → *Push*.

**Dominio propio (opcional):** en la misma página de Pages, escribe tu dominio
en **Custom domain** y crea en tu proveedor DNS un registro `CNAME` hacia
`gervasio02.github.io`. Activa **Enforce HTTPS** cuando aparezca.

## Opción alternativa: Azure Static Web Apps (plan Free)

Útil si quieres tener todo en Azure. El mismo flujo publica en ambos sitios si
lo configuras:

1. En [Azure Portal](https://portal.azure.com/) crea un recurso
   **Static Web Apps**, plan **Free**, origen **Other / Otro**.
2. En el recurso: **Overview → Manage deployment token**. Copia el token a
   GitHub: **Settings → Secrets and variables → Actions → Secrets**, con el
   nombre `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. En **Actions → Variables**, crea `AZURE_STATIC_WEB_APPS_READY` = `true`.
4. Ejecuta **Publicar portada** con *Run workflow*. Azure aplica además los
   encabezados de seguridad de `portal/staticwebapp.config.json`.

Documentación: [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal) ·
[Token de despliegue](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-token-management).

## Otras opciones compatibles

Como `portal/` no necesita build, también sirve en Netlify, Cloudflare Pages o
Vercel: conecta el repositorio y define **`portal`** como directorio de
publicación, sin comando de build.

## Después de cambiar de dirección

Cuando la portada tenga su URL definitiva:

- Actualiza la fila **Portada** de `GESTION_PORTAFOLIO.md`.
- Si usas CloudOps, define `PORTAL_URL` con la nueva dirección (ver
  `labs/README.md`).
- La dirección anterior en ChatGPT Sites deja de ser necesaria.

## Aplicaciones completas

Siguen en Azure Container Apps (`rg-portafolio-gervasio`) y se actualizan solas
con cada push a `main` en su carpeta. Se apagan sin tráfico: la primera visita
tarda unos 30 segundos. Para evitarlo hay que fijar al menos una réplica
mínima en cada Container App (*Scale → Min replicas = 1*), lo que tiene costo.
DataLab, DocFlow y CloudOps se mantienen locales hasta disponer de HTTPS,
identidades y una política de retención.

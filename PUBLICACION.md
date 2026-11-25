# Publicación del portafolio

| Parte                      | Dónde                                   | Cómo se actualiza                      |
| -------------------------- | --------------------------------------- | -------------------------------------- |
| Portada, CV y demos (`portal/`) | Azure Static Web Apps (plan Free) → **https://gervasio.sbs** | Push a `main` → flujo **Publicar portada** |
| TaskFlow, ReservaYa, TiendaNova, Snake, Interrogatorio, Laboratorios | Azure Container Apps (`rg-portafolio-gervasio`) | Push a `main` en su carpeta → su flujo |

Todo se edita desde GitHub (web, `github.dev` con la tecla `.`, GitHub
Desktop, Codex o Claude) y se publica solo al llegar a `main`.

## 1. Sitio estático en Azure (una vez)

1. Azure Portal → **Crear un recurso → Static Web App**.
   - Grupo de recursos: `rg-portafolio-gervasio`.
   - Nombre: `portafolio-gervasio`. Plan: **Free**.
   - Origen de implementación: **Otro** (el flujo del repositorio publica).
2. En el recurso: **Información general → Administrar token de implementación**.
   Copia el token y guárdalo en GitHub: **Settings → Secrets and variables →
   Actions → New repository secret**, nombre `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. En la pestaña **Variables** crea `AZURE_STATIC_WEB_APPS_READY` = `true`.
4. GitHub → **Actions → Publicar portada → Run workflow** (rama `main`).
   La portada queda en la URL `*.azurestaticapps.net` del recurso.

## 2. Dominio gervasio.sbs (DNS en Hostinger)

En Azure: recurso Static Web App → **Dominios personalizados → Agregar →
Dominio personalizado en otro DNS**.

**a) `www.gervasio.sbs`** (validación por CNAME)

| Tipo  | Nombre | Apunta a                                  | TTL     |
| ----- | ------ | ----------------------------------------- | ------- |
| CNAME | `www`  | `<nombre>.azurestaticapps.net` (sin https) | 3600    |

**b) `gervasio.sbs`** (dominio raíz; validación por TXT)

| Tipo  | Nombre | Valor                                          |
| ----- | ------ | ---------------------------------------------- |
| TXT   | `@`    | código que muestra Azure al agregar el dominio |
| ALIAS | `@`    | `<nombre>.azurestaticapps.net`                 |

Si el editor DNS de Hostinger no ofrece `ALIAS`, borra el registro `A` que
Hostinger crea por defecto para `@` y usa la opción **registro A** de Azure
(Azure muestra la IP), o redirige `gervasio.sbs` → `https://www.gervasio.sbs`
desde Hostinger (**Dominios → Redirigir**).

Hostinger: **hPanel → Dominios → gervasio.sbs → DNS / Nameservers**. Elimina
los registros `A`/`CNAME` de estacionamiento que apunten a Hostinger para `@`
y `www` antes de crear los nuevos. La propagación tarda de minutos a unas
horas; Azure emite el certificado HTTPS automáticamente al validar.

Documentación: [dominios en Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/custom-domain) ·
[dominio raíz con DNS externo](https://learn.microsoft.com/azure/static-web-apps/apex-domain-external).

## 3. Apps sin espera

Las Container Apps escalan a cero cuando nadie las usa (sin costo en
reposo). `portal/despertar.js` las despierta en cuanto alguien abre la portada,
el catálogo o una página de proyecto, y muestra «En línea» cuando ya
responden. Si algún día prefieres que nunca se apaguen: en cada Container App,
**Escala → Mínimo de réplicas = 1** (tiene costo mensual).

## 4. Apps nuevas (Interrogatorio y Laboratorios)

Sus flujos (`interrogatorio.yml`, `labs.yml`) usan
`scripts/azure-desplegar-app.sh`: construyen la imagen, la suben al registro y,
si la Container App no existe, la crean en el mismo entorno que Snake. El
secreto `JWT_SECRET` de Interrogatorio se genera dentro del flujo; nadie lo ve.

## Comprobación final (usuarios finales)

Desde un teléfono y un computador que no sean el tuyo:

1. Abre https://gervasio.sbs y espera a que los proyectos marquen «En línea».
2. Snake: juega una partida y revisa el ranking.
3. Interrogatorio: entra como invitado, interroga y acusa.
4. TaskFlow, ReservaYa, TiendaNova: usa las credenciales de demo de cada README.
5. Laboratorios: procesa los datos de ejemplo en DataLab, extrae una factura en
   DocFlow y ejecuta una comprobación en CloudOps.
6. Descarga el CV en PDF desde la sección de contacto.

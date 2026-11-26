# Publicación del portafolio

| Parte | Dónde | Cómo se actualiza |
| --- | --- | --- |
| Portada, CV y demos (`portal/`) | GitHub Pages → **https://gervasio.sbs** | Push a `main` → flujo **Publicar portada** |
| TaskFlow, ReservaYa, TiendaNova, Snake, Interrogatorio, Laboratorios | Azure Container Apps (`rg-portafolio-gervasio`, Chile Central) | Push a `main` en su carpeta → su flujo |

Todo se edita desde GitHub (web, `github.dev` con la tecla `.`, GitHub
Desktop, Codex o Claude) y se publica solo al llegar a `main`.

> **¿Por qué la portada no está en Azure?** La suscripción *Azure for Students*
> solo permite crear recursos en Chile Central, México Central, North Central
> US, South Africa North y Canada East, y Azure Static Web Apps no existe en
> ninguna de esas regiones. GitHub Pages es gratis, sirve HTTPS con tu dominio
> y no se apaga nunca (sin arranque en frío). Las apps sí siguen en Azure.

## 1. GitHub Pages (una vez)

1. https://github.com/Gervasio02/Portafolio/settings/pages
2. **Build and deployment → Source: GitHub Actions**.
3. **Custom domain:** `gervasio.sbs` → **Save**. Cuando el DNS valide, marca
   **Enforce HTTPS**.
4. **Actions → Publicar portada → Run workflow** (rama `main`).

## 2. DNS en Hostinger (hPanel → Dominios → gervasio.sbs → DNS / Nameservers)

Borra primero los registros `A` de `@` y el `CNAME` de `www` que Hostinger crea
por defecto (estacionamiento) y agrega:

| Tipo  | Nombre | Apunta a              |
| ----- | ------ | --------------------- |
| A     | `@`    | `185.199.108.153`     |
| A     | `@`    | `185.199.109.153`     |
| A     | `@`    | `185.199.110.153`     |
| A     | `@`    | `185.199.111.153`     |
| CNAME | `www`  | `gervasio02.github.io` |

La propagación tarda de minutos a unas horas. GitHub emite el certificado
HTTPS automáticamente. Documentación:
[dominio personalizado en GitHub Pages](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## 3. Apps sin espera

Las Container Apps escalan a cero cuando nadie las usa (sin costo en reposo).
`portal/despertar.js` las despierta en cuanto alguien abre la portada, el
catálogo o una página de proyecto, y muestra «En línea» cuando ya responden.
Si algún día prefieres que nunca se apaguen: en cada Container App,
**Escala → Mínimo de réplicas = 1** (tiene costo mensual).

## 4. Interrogatorio y Laboratorios

`interrogatorio-gervasio-std` y `labs-gervasio-std` existen en el entorno
`portfolio-gervasio-standard` con la identidad `id-portafolio-apps-pull` para
leer el registro. Sus flujos (`interrogatorio.yml`, `labs.yml`) usan
`scripts/azure-desplegar-app.sh` para publicar cada versión. El secreto
`JWT_SECRET` de Interrogatorio se genera dentro del flujo; nadie lo ve.

## 5. BodegaNet (.NET)

`bodeganet-gervasio-std` la crea el flujo `bodeganet.yml` la primera vez que
llega a `main`, copiando el entorno y la identidad de registro de Snake
(`scripts/azure-desplegar-app.sh`). Sin configurar nada, la demo usa SQLite
dentro del contenedor y se reinicia cada vez que la app se apaga por
inactividad (vuelve a sembrar los datos de ejemplo).

Si quieres que los movimientos se conserven, crea en GitHub → *Settings →
Secrets and variables → Actions* el secreto `BODEGANET_DATABASE_URL` con la URL
de un PostgreSQL (`postgres://usuario:clave@host:5432/base?sslmode=require`) y
vuelve a ejecutar *Actions → BodegaNet → Run workflow* en `main`. El flujo lo
pasa como `DATABASE_URL` solo si existe; las migraciones se aplican al arrancar.

## 6. Panel privado de visitas

1. GitHub → *Settings → Secrets and variables → Actions → New repository secret*:
   - `PANEL_CLAVE`: la clave que usarás para entrar (no va en el código porque
     el repositorio es público).
   - `ANALITICA_DB_URL` (recomendado): cadena de un PostgreSQL para que las
     visitas no se pierdan; puede ser el mismo servidor de TaskFlow, porque se
     guardan en un esquema aparte (`analitica`).
2. *Actions → Laboratorios → Run workflow* (rama `main`) para aplicar los cambios.
3. Entra en https://gervasio.sbs/panel/ (también desde el punto discreto «·» al
   final del pie de la portada). Marca «No contar mis visitas» para no inflar
   las cifras.

## 6. Asistente del portafolio

No necesita configuración: el modelo se entrena en GitHub Actions al publicar
la portada. Para enseñarle, revisa la sección «Asistente» del panel privado y
edita `asistente/conocimiento.yml` (detalle en `asistente/README.md`).

## Comprobación final (usuarios finales)

Desde un teléfono y un computador que no sean el tuyo:

1. Abre https://gervasio.sbs y espera a que los proyectos marquen «En línea».
2. Snake: juega una partida y revisa el ranking.
3. Interrogatorio: entra como invitado, interroga y acusa.
4. TaskFlow, ReservaYa, TiendaNova: usa las credenciales de demo de cada README.
   BodegaNet: «Entrar como invitado», registra una salida y revisa el kardex.
5. Laboratorios: procesa los datos de ejemplo en DataLab, extrae una factura en
   DocFlow y ejecuta una comprobación en CloudOps.
6. Descarga el CV en PDF desde la sección de contacto.

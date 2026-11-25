# Publicación y seguimiento de Portafolio

## Qué está incluido

`portal/` contiene una portada estática, un catálogo de ocho proyectos y demos
didácticas con datos ficticios. Las demos estáticas son independientes y no se
conectan a PostgreSQL; los enlaces indican cuándo una experiencia completa es
local o externa. Para ejecutar las aplicaciones completas, sigue el README de
cada carpeta.

## GitHub

El código de las cinco aplicaciones, los tres laboratorios y la portada está en
[Gervasio02/Portafolio](https://github.com/Gervasio02/Portafolio). Para ver qué
cambios tienes pendientes, abre la carpeta en GitHub Desktop o ejecuta
`git status` desde ella.

Para obtener una copia en otro equipo, abre una terminal en la carpeta donde quieras guardar el proyecto y ejecuta este comando.

```powershell
git clone https://github.com/Gervasio02/Portafolio.git
```

Para subir cambios desde el PC, autentícate en GitHub Desktop o en Git con tu cuenta personal `Gervasio02`, revisa los archivos modificados y envía el commit. Los flujos de `.github/workflows/` verifican las aplicaciones en GitHub Actions.

## Azure Static Web Apps

1. En [Azure Portal](https://portal.azure.com/) crea un recurso **Static Web Apps**, selecciona la suscripción y el plan **Free**. Si usarás el flujo incluido, selecciona **Other / Otro** como origen para evitar crear dos flujos.
2. En el recurso abre **Overview / Información general → Manage deployment token**. Copia el token directamente a **Settings → Secrets and variables → Actions → Secrets** en el repositorio. El nombre es `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. En **Actions → Variables** del repositorio crea `AZURE_STATIC_WEB_APPS_READY` con valor `true`. Inicia el flujo **Publicar portada en Azure** con **Run workflow**, o sube un cambio de la carpeta `portal/` a `main`.
4. Cuando el flujo termine, abre la URL del recurso desde otro equipo. Prueba el
   carrusel, la búsqueda, los filtros y cada enlace.
5. Las aplicaciones completas necesitan alojamientos para sus servidores y
   bases cuando corresponda. Usa sus README antes de enlazar URLs de ejecución.
   DataLab, DocFlow y CloudOps permanecen locales hasta disponer de HTTPS,
   identidades y una política de retención autorizada.

## Estado comprobado

La certificación local está en [docs/ROADMAP.md](docs/ROADMAP.md). El 25 de
noviembre de 2026 se publicó automáticamente la revisión `33ad30f` de TaskFlow,
ReservaYa, TiendaNova y Snake en `rg-portafolio-gervasio`. GitHub Actions y
Azure confirmaron las cuatro revisiones en ejecución; sus comprobaciones de
salud respondieron HTTP 200. La portada pública también respondió HTTP 200 y
conserva la URL indicada en el repositorio.

GitHub quedó como gestor de archivos con la cuenta personal `Gervasio02`. Los
flujos de publicación usan directamente el grupo de recursos de producción,
con la variable opcional `AZURE_RESOURCE_GROUP` y el valor seguro predeterminado
`rg-portafolio-gervasio`; ya no dependen de enumerar toda la suscripción.
La identidad `id-portafolio-github-push` tiene el rol integrado
`Container Apps Contributor` únicamente en ese grupo de recursos, de modo que
los flujos pueden actualizar las aplicaciones sin administrar permisos ni la
facturación de la suscripción.

Documentación: [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal) · [Token de despliegue](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-token-management).

## Copia en el Escritorio de Windows

Abre `portal/index.html` para revisar la portada o la carpeta `Portafolio` del Escritorio en Visual Studio Code para continuar. Usa la rama `main` para sincronizar los cambios con GitHub.

# Publicación y seguimiento de Portafolio

## Qué está incluido

`portal/` contiene una portada estática con un carrusel operable por teclado y tres páginas con demos didácticas en `taskflow/index.html`, `reservaya/index.html` y `tiendanova/index.html` dentro de `portal/`. Las demos son independientes, no se conectan a PostgreSQL y usan únicamente datos ficticios. Puedes abrir `portal/index.html` directamente después de descomprimir. Para ejecutar las aplicaciones completas, sigue el README de cada carpeta.

## GitHub

El destino solicitado es un repositorio público nuevo llamado `Portafolio` bajo `Gervasio02`. Si `gh auth status` muestra esa cuenta como activa, desde la raíz del proyecto ejecuta:

```powershell
git init -b main
git add .
git status --short
git commit -m "feat: publicar portafolio y demos"
gh repo create Gervasio02/Portafolio --public --source . --remote origin --push
```

Si el repositorio ya existe, abre y revisa su contenido antes de usarlo. No ejecutes el comando de creación ni reemplaces historial en ese caso. Usa los flujos que están en `.github/workflows/` para verificar las aplicaciones.

## Azure Static Web Apps

1. En [Azure Portal](https://portal.azure.com/) crea un recurso **Static Web Apps**, selecciona la suscripción y el plan **Free**. Si usarás el flujo incluido, selecciona **Other / Otro** como origen para evitar crear dos flujos.
2. En el recurso abre **Overview / Información general → Manage deployment token**. Copia el token directamente a **Settings → Secrets and variables → Actions → Secrets** en el repositorio. El nombre es `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. En **Actions → Variables** del repositorio crea `AZURE_STATIC_WEB_APPS_READY` con valor `true`. Inicia el flujo **Publicar portada en Azure** con **Run workflow**, o sube un cambio de la carpeta `portal/` a `main`.
4. Cuando el flujo termine, abre la URL del recurso desde otro equipo. Prueba el carrusel, abre cada demo y ejecuta su flujo. Prueba también sin iniciar sesión.
5. Las aplicaciones completas necesitan alojamientos para sus servidores y bases PostgreSQL. Usa los README de TaskFlow, ReservaYa y TiendaNova antes de enlazar sus URLs de ejecución. Las interfaces de prueba de `portal/` se publican con el sitio estático.

Documentación: [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal) · [Token de despliegue](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-token-management).

## Copia en el Escritorio de Windows

Descarga y descomprime el ZIP en el Escritorio. La carpeta extraída se llama **Portafolio**. Abre `portal/index.html` para la portada o la carpeta Portafolio en Visual Studio Code para continuar. Esta copia se puede actualizar descargando una nueva versión o, cuando exista el repositorio, clonándolo y trabajando con Git.

# Publicación y seguimiento de Portafolio

## Qué está incluido

`portal/` contiene una portada estática con un carrusel operable por teclado y tres páginas con demos didácticas en `taskflow/index.html`, `reservaya/index.html` y `tiendanova/index.html` dentro de `portal/`. Las demos son independientes, no se conectan a PostgreSQL y usan únicamente datos ficticios. Puedes abrir `portal/index.html` directamente después de descomprimir. Para ejecutar las aplicaciones completas, sigue el README de cada carpeta.

## GitHub

El código de las tres aplicaciones y de la portada está en [Gervasio02/Portafolio](https://github.com/Gervasio02/Portafolio). La carpeta `Portafolio` del Escritorio está vinculada a la rama `main` de ese repositorio. Para ver qué cambios tienes pendientes, abre esa carpeta en GitHub Desktop o ejecuta `git status` desde ella.

Para obtener una copia en otro equipo, abre una terminal en la carpeta donde quieras guardar el proyecto y ejecuta este comando.

```powershell
git clone https://github.com/Gervasio02/Portafolio.git
```

Para subir cambios desde el PC, autentícate en GitHub Desktop o en Git con tu cuenta personal `Gervasio02`, revisa los archivos modificados y envía el commit. Los flujos de `.github/workflows/` verifican las aplicaciones en GitHub Actions.

## Azure Static Web Apps

1. En [Azure Portal](https://portal.azure.com/) crea un recurso **Static Web Apps**, selecciona la suscripción y el plan **Free**. Si usarás el flujo incluido, selecciona **Other / Otro** como origen para evitar crear dos flujos.
2. En el recurso abre **Overview / Información general → Manage deployment token**. Copia el token directamente a **Settings → Secrets and variables → Actions → Secrets** en el repositorio. El nombre es `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. En **Actions → Variables** del repositorio crea `AZURE_STATIC_WEB_APPS_READY` con valor `true`. Inicia el flujo **Publicar portada en Azure** con **Run workflow**, o sube un cambio de la carpeta `portal/` a `main`.
4. Cuando el flujo termine, abre la URL del recurso desde otro equipo. Prueba el carrusel, abre cada demo y ejecuta su flujo. Prueba también sin iniciar sesión.
5. Las aplicaciones completas necesitan alojamientos para sus servidores y bases PostgreSQL. Usa los README de TaskFlow, ReservaYa y TiendaNova antes de enlazar sus URLs de ejecución. Las interfaces de prueba de `portal/` se publican con el sitio estático.

Documentación: [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal) · [Token de despliegue](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-token-management).

## Copia en el Escritorio de Windows

Abre `portal/index.html` para revisar la portada o la carpeta `Portafolio` del Escritorio en Visual Studio Code para continuar. Usa la rama `main` para sincronizar los cambios con GitHub.

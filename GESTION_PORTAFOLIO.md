# Gestión directa del portafolio

## Gestor de archivos

El gestor principal es [GitHub](https://github.com/Gervasio02/Portafolio). El
repositorio está fijado en la cuenta `Gervasio02` y conserva cada versión, por lo
que un cambio se puede revisar o revertir sin editar servidores directamente.

1. Abre la carpeta que quieras modificar.
2. Abre el archivo y selecciona **Edit file**, o pulsa `.` para abrir el editor
   completo de GitHub.
3. Guarda el cambio en `main` con un mensaje breve y descriptivo.
4. Revisa [Actions](https://github.com/Gervasio02/Portafolio/actions) hasta que
   las pruebas y el despliegue terminen correctamente.

No se habilita FTP: Azure Container Apps ejecuta imágenes inmutables. Un archivo
copiado por FTP se perdería al reiniciar o escalar el servicio y omitiría las
pruebas, el historial y la recuperación que sí ofrece GitHub.

## Producción

| Servicio | Dirección pública | Salud |
| --- | --- | --- |
| Portada | <https://portafolio-gervasio-torres.aloycmexico-9087.chatgpt.site/> | `/` |
| TaskFlow | <https://taskflow-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/> | `/api/health` |
| ReservaYa | <https://reservaya-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/> | `/api/health` |
| TiendaNova | <https://tiendanova-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/> | `/health` |
| Snake | <https://snake-gervasio-std.purpleocean-4aad06ee.chilecentral.azurecontainerapps.io/> | `/api/health` |

Las cuatro aplicaciones contenedorizadas están en el grupo
`rg-portafolio-gervasio`. Un cambio de las carpetas `taskflow/`, `reservaya/`,
`tiendanova/` o `snake/` activa su flujo de GitHub Actions: prueba el proyecto,
publica una imagen privada en Azure Container Registry, crea una revisión nueva
y comprueba su URL de salud.

La automatización usa la identidad `id-portafolio-github-push`, con permiso
`Container Apps Contributor` limitado a `rg-portafolio-gervasio`. El 25 de
noviembre de 2026 se verificó el despliegue automático completo de la revisión
`33ad30f` para las cuatro aplicaciones.

La portada se administra desde `portal/` y su publicación actual está en
ChatGPT Sites. No guardes contraseñas, tokens ni cadenas de conexión en el
repositorio; usa exclusivamente secretos o variables del proveedor.

## Recuperación

Si un despliegue falla, la revisión anterior de Azure continúa disponible. Abre
Azure Portal, grupo `rg-portafolio-gervasio`, selecciona la aplicación y entra a
**Revisiones y réplicas**. Comprueba los registros antes de mover tráfico o
reactivar una revisión anterior. No borres revisiones ni bases de datos para
resolver un fallo de publicación.

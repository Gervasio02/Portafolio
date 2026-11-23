# Seguimiento de evolución del portafolio

Actualizado: 2026-11-23. Ninguna fase se considera terminada sin implementar y verificar todos sus criterios.

| Fase | Estado | Siguiente tarea |
| --- | --- | --- |
| 1. Estabilidad, seguridad e infraestructura | En curso | Completar la línea base de compilaciones, pruebas, arranque y revisión de seguridad de todas las aplicaciones; investigar las URLs Azure. |
| 2. Rediseño visual | Pendiente | Evaluar la portada y su accesibilidad. |
| 3. Explorador de proyectos | Pendiente | Diseñar el catálogo a partir de una fuente común. |
| 4. TaskFlow 2.0 | Pendiente | Identificar y verificar funcionalidades existentes. |
| 5. ReservaYa 2.0 | Pendiente | Verificar disponibilidad y concurrencia con PostgreSQL. |
| 6. TiendaNova 2.0 | Pendiente | Verificar compra e inventario con PostgreSQL. |
| 7. Snake e Interrogatorio | Pendiente | Evaluar los juegos y su progreso. |
| 8. CloudOps | Pendiente | Definir fuentes reales de estado y restricciones de consulta. |
| 9. DataLab | Pendiente | Definir arquitectura y alcance verificable. |
| 10. DocFlow AI | Pendiente | Definir extracción, validación y revisión humana. |
| 11. Consolidación | Pendiente | Integrar y verificar después de las fases anteriores. |

## Fase 1: avance verificado

- Checkout de trabajo: `interrogatorio-integration`, rama `feat/interrogatorio-demo`, basada en `e819dc1` con trabajo previo `7dd265f`. La copia `snake-integration` tiene cambios anteriores sin integrar y debe preservarse.
- Interrogatorio: `bd0591a` elimina la clave JWT pública por defecto, exige una clave configurada en modo producción, agrega `/ready` con consulta a base de datos y configura CI para backend y compilación frontend. La clave temporal de desarrollo invalida sesiones al reiniciar.
- Pruebas locales: 110 pruebas de backend de Interrogatorio aprobadas con SQLite y compilación frontend aprobada. El workflow nuevo todavía no se ha ejecutado en GitHub. No se ha comprobado PostgreSQL ni Docker Compose.
- Compilaciones locales aprobadas: TaskFlow, ReservaYa frontend, Snake y TiendaNova. Pruebas aprobadas: TaskFlow frontend (5), ReservaYa frontend (2) y Snake (10; tras `npx prisma generate`).
- TaskFlow: el conjunto completo de API no se ejecutó por ausencia de `TEST_DATABASE_URL` para PostgreSQL aislado. TiendaNova: 7 pruebas pasaron y 2 se omitieron; el comando falló por no alcanzar el umbral de cobertura sin las pruebas de base de datos. ReservaYa backend también requiere PostgreSQL aislado (`RESERVAYA_TEST_DATABASE_URL`).
- La portada publicada indicada en el README respondió HTTP 200; las cuatro URLs Azure de aplicaciones agotaron el tiempo de espera desde este entorno. Esto no identifica la causa ni acredita una caída general. No se desplegaron cambios.
- Bloqueos y riesgos: Docker no está disponible en PATH. Interrogatorio sigue siendo un prototipo no apto para exposición pública; faltan controles de acceso y concurrencia descritos en su README. Falta ejecutar pruebas y compilaciones del resto de aplicaciones y verificar los servicios y bases de datos reales.
- Próximo paso: completar lint y pruebas pendientes; ejecutar pruebas con PostgreSQL y revisar arranque y despliegues cuando exista acceso al entorno correspondiente. ReservaYa backend: dependencias instaladas en `.venv`, una prueba pasó y ocho requieren la base aislada.

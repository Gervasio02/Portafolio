# Seguimiento de evolución del portafolio

Actualizado: 2026-11-23. Ninguna fase se considera terminada sin implementar y verificar todos sus criterios.

| Fase | Estado | Siguiente tarea |
| --- | --- | --- |
| 1. Estabilidad, seguridad e infraestructura | En curso | Completar la línea base de compilaciones, pruebas, arranque y revisión de seguridad de todas las aplicaciones; investigar las URLs Azure. |
| 2. Rediseño visual | Pendiente | Evaluar la portada y su accesibilidad. |
| 3. Explorador de proyectos | Pendiente | Diseñar el catálogo a partir de una fuente común. |
| 4. TaskFlow 2.0 | En curso | Verificar migraciones y concurrencia con PostgreSQL; completar calendario, SLA y notificaciones. |
| 5. ReservaYa 2.0 | Pendiente | Verificar disponibilidad y concurrencia con PostgreSQL. |
| 6. TiendaNova 2.0 | Pendiente | Verificar compra e inventario con PostgreSQL. |
| 7. Snake e Interrogatorio | Pendiente | Evaluar los juegos y su progreso. |
| 8. CloudOps | Pendiente | Definir fuentes reales de estado y restricciones de consulta. |
| 9. DataLab | Pendiente | Definir arquitectura y alcance verificable. |
| 10. DocFlow AI | Pendiente | Definir extracción, validación y revisión humana. |
| 11. Consolidación | Pendiente | Integrar y verificar después de las fases anteriores. |

## Fase 1: avance verificado

- Continuación retomada: los cambios parciales del catálogo, laboratorios y responsables/WIP ya tienen implementación y pruebas locales. Persisten las limitaciones de PostgreSQL y producción indicadas abajo.

- Checkout de trabajo: `interrogatorio-integration`, rama `feat/interrogatorio-demo`, basada en `e819dc1` con trabajo previo `7dd265f`. La copia `snake-integration` tiene cambios anteriores sin integrar y debe preservarse.
- Interrogatorio: `bd0591a` elimina la clave JWT pública por defecto, exige una clave configurada en modo producción, agrega `/ready` con consulta a base de datos y configura CI para backend y compilación frontend. La clave temporal de desarrollo invalida sesiones al reiniciar.
- Pruebas locales: 110 pruebas de backend de Interrogatorio aprobadas con SQLite y compilación frontend aprobada. El workflow nuevo todavía no se ha ejecutado en GitHub. No se ha comprobado PostgreSQL ni Docker Compose.
- Compilaciones locales aprobadas: TaskFlow, ReservaYa frontend, Snake y TiendaNova. Pruebas aprobadas: TaskFlow frontend (5), ReservaYa frontend (2) y Snake (10; tras `npx prisma generate`).
- TaskFlow: el conjunto completo de API no se ejecutó por ausencia de `TEST_DATABASE_URL` para PostgreSQL aislado. TiendaNova: 7 pruebas pasaron y 2 se omitieron; el comando falló por no alcanzar el umbral de cobertura sin las pruebas de base de datos. ReservaYa backend también requiere PostgreSQL aislado (`RESERVAYA_TEST_DATABASE_URL`).
- La portada publicada indicada en el README respondió HTTP 200; las cuatro URLs Azure de aplicaciones agotaron el tiempo de espera desde este entorno. Esto no identifica la causa ni acredita una caída general. No se desplegaron cambios.
- Bloqueos y riesgos: Docker no está disponible en PATH. Interrogatorio sigue siendo un prototipo no apto para exposición pública; faltan controles de acceso y concurrencia descritos en su README. Falta ejecutar pruebas y compilaciones del resto de aplicaciones y verificar los servicios y bases de datos reales.
- Próximo paso: completar lint y pruebas pendientes; ejecutar pruebas con PostgreSQL y revisar arranque y despliegues cuando exista acceso al entorno correspondiente. ReservaYa backend: dependencias instaladas en `.venv`, una prueba pasó y ocho requieren la base aislada.


## Entregables de la continuación

- Catálogo: `79f18aa`, ocho proyectos con búsqueda, filtros de tipo/tecnología, arquitectura, aprendizajes y accesos. Las nuevas apps se identifican como locales. Verificado en Chromium a 390 px sin desborde horizontal, filtros y estado vacío. Rediseño integral y auditoría completa de accesibilidad pendientes.
- Laboratorios: `adc7127`, DataLab CSV/XLSX con limpieza, perfil, distribuciones y exportación segura; DocFlow de facturas de texto con validaciones, revisión y auditoría; CloudOps con comprobaciones manuales limitadas e historial real de cinco servicios. Ocho pruebas aprobadas. Flujos de DataLab y revisión de DocFlow aprobados en Chromium. CI agregada, aún sin ejecución remota. Son apps locales sin autenticación, no desplegadas ni listas para usuarios públicos.
- TaskFlow: `6165044`, responsables y límites WIP con validación de pertenencia, permisos y capacidad bajo el bloqueo transaccional existente; UI para ambos. Migración aditiva pendiente de aplicar en base de pruebas. Cinco pruebas de políticas con repositorio simulado y cinco de frontend aprobadas; lint y compilación aprobados. Prisma valida. Esto no verifica concurrencia real ni reemplaza las pruebas PostgreSQL.
- Las fases 2, 3, 4, 8, 9 y 10 tienen avances parciales, no se consideran completas. Las fases 5–7 y 11 conservan pendientes. Faltan, entre otras funciones: auditoría/comentarios/SLA/calendario de TaskFlow, tarifas y comprobantes de ReservaYa, variantes/cupones/devoluciones de TiendaNova, progreso de los juegos, incidentes/alertas de CloudOps, consolidación E2E y publicación.
- Siguiente tarea: preparar PostgreSQL aislado, aplicar/verificar la migración TaskFlow y completar sus flujos restantes antes de seguir la secuencia funcional. No hay Docker ni PostgreSQL local detectados. No se modificó infraestructura productiva.

## Continuación: comentarios y actividad de TaskFlow

- Commit `e8a5b45`: comentarios persistentes de tarjetas, consulta de los 100 eventos más recientes y eventos de edición/movimiento en la misma transacción que el cambio. No constituye todavía un historial de diferencias de todos los campos ni una auditoría global de todas las acciones del tablero.
- Permisos: lectura por miembros; escritura por dueños y editores; comprobación de que la tarjeta pertenece al tablero. Texto limitado a 2.000 caracteres y renderizado como texto. La interfaz consulta cada 15 segundos y cancela solicitudes al cerrar.
- Verificado: ocho pruebas de políticas con repositorio simulado, siete pruebas de interfaz, lint, compilación y validación Prisma aprobados. Prueba PostgreSQL añadida para publicación/lectura y actividad de cambios: **no ejecutada** por falta de base aislada. Se volvió a comprobar que `docker`, `pg_ctl` y `psql` no están disponibles en PATH.
- Migración aditiva `202611230002_activity` creada, **sin aplicar**. Requiere verificación junto con la migración WIP en PostgreSQL de pruebas antes de publicar.
- Siguiente pendiente: preparar la base de pruebas y verificar ambas migraciones; luego completar calendario, SLA y notificaciones. Fase 4 sigue en curso. No se desplegó ni se modificaron datos productivos.

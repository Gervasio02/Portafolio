# Seguimiento de evolución del portafolio

Actualizado: 2026-11-23. Ninguna fase se considera terminada sin implementar y verificar todos sus criterios.

| Fase | Estado | Siguiente tarea |
| --- | --- | --- |
| 1. Estabilidad, seguridad e infraestructura | En curso | Completar la línea base de compilaciones, pruebas, arranque y revisión de seguridad de todas las aplicaciones; investigar las URLs Azure. |
| 2. Rediseño visual | Pendiente | Evaluar la portada y su accesibilidad. |
| 3. Explorador de proyectos | Pendiente | Diseñar el catálogo a partir de una fuente común. |
| 4. TaskFlow 2.0 | En curso | Ampliar historial detallado/global y completar revisión E2E y responsive. |
| 5. ReservaYa 2.0 | En curso | Revisar E2E de nuevas tarifas y descarga; consolidar estadísticas de ocupación y navegación visual. |
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

## Verificación PostgreSQL local y calendario

El bloqueo de PostgreSQL local indicado en los apartados anteriores quedó resuelto en esta continuación. Los resultados anteriores se conservan como historial; estos son los resultados vigentes:

- `8398256`: PostgreSQL 16.15 oficial extraído fuera del repositorio. Clúster aislado en `%LOCALAPPDATA%/CodexTools/postgresql-test/server`, TCP solo en 127.0.0.1:55432, autenticación SCRAM y contraseña aleatoria cifrada para la cuenta Windows. Script repetible `scripts/Test-LocalDatabases.ps1`; requisitos e instrucciones en README.
- TaskFlow: cuatro migraciones aplicadas desde cero y segunda ejecución sin migraciones pendientes. Ocho pruebas de políticas, once de API/integración y siete de interfaz pasaron antes del calendario. Cobertura de líneas API 99,06 %. La nueva prueba PostgreSQL confirma que tres altas simultáneas con WIP=1 producen una tarjeta y dos rechazos 409. Comentarios, historial y permisos se verificaron con la base real.
- ReservaYa: nueve pruebas PostgreSQL aprobadas; cobertura 95,55 %. Se verifican migraciones de ida/vuelta, reservas simultáneas, conflicto mantenimiento/reserva, cancelaciones y horarios semanales.
- TiendaNova: migración inicial aplicada; nueve pruebas aprobadas, sin omisiones. Cobertura de líneas 96,42 %, ramas 84,21 %. Compra concurrente de última unidad, idempotencia, dirección ajena, rechazo simulado y carrito vacío verificados.
- Calendario TaskFlow: vista mensual, selección de mes, fechas y tareas sin programar; respeta búsqueda/prioridad y abre edición existente. Ocho pruebas de interfaz, lint y compilación aprobados tras añadirlo. No crea nuevas reglas de vencimiento o SLA.
- El script detuvo PostgreSQL al finalizar ambas ejecuciones. No se tocaron datos productivos, DNS ni infraestructura cloud. Binarios, credenciales, bases y logs permanecen fuera de Git.
- Siguiente pendiente funcional: SLA, notificaciones y estadísticas por responsable en TaskFlow. Persisten los pendientes funcionales de las fases 2–11, la seguridad multiusuario de los laboratorios y la verificación/publicación de producción. Ninguna fase se declara completa por estos resultados parciales.

## SLA de TaskFlow y tarifas de ReservaYa

- `442d14c`: SLA opcional en horas corridas desde creación, fechas de cierre registradas al completar/reabrir, estado de cumplimiento y estadísticas por responsable. Panel de alertas internas con lectura persistente privada por usuario/vencimiento. Solo considera tableros accesibles y no inventa fechas para cierres históricos. Migración `202611230003_sla_notifications` aplicada en PostgreSQL aislado.
- Verificación TaskFlow: nueve pruebas de políticas/SLA, doce de API con PostgreSQL y diez de interfaz aprobadas. Cobertura de líneas API 99,15 %. Lint y compilación aprobados. Se probó persistencia de lectura, privacidad frente a otro usuario y transición cerrar/reabrir. Los tests de dashboard se aislaron del panel nuevo y este tiene sus propias pruebas.
- `24976bc`: ReservaYa añade recargo del 20 % a turnos 18–21 h, tarifas por hora en disponibilidad, precio calculado en la transacción y conservado en la reserva. Comprobantes JSON privados para titular/administración, con estado actual y carácter simulado explícito; descarga desde Mis reservas.
- Verificación ReservaYa: once pruebas con PostgreSQL aprobadas, cobertura 95,69 %. Incluyen límites de horario punta, precio conservado tras cambios administrativos y comprobante privado/cancelado. Dos pruebas frontend, lint de ambos stacks y compilación aprobados. Falta E2E de descarga y tarifas en navegador con datos reales.
- PostgreSQL se detuvo al terminar; no hubo despliegues ni cambios de infraestructura. Quedan pendientes funcionalidades de TiendaNova, mejoras de juegos, incidentes/alertas de CloudOps, seguridad multiusuario de laboratorios y consolidación visual/E2E. Los pendientes no son bloqueos de PostgreSQL: requieren desarrollo adicional. Las fases siguen abiertas hasta cubrir sus criterios completos.
- Próxima tarea: historial detallado/global y E2E de TaskFlow/ReservaYa; después continuar TiendaNova (variantes, cupones, cancelaciones y devoluciones transaccionales).

## Continuación: comercio, observabilidad y experiencias

- `b73feb8`: cancelación de pedidos simulados pagados antes del despacho y restitución transaccional de inventario; reintentos concurrentes no duplican stock. Ventas excluyen pedidos cancelados. Diez pruebas PostgreSQL aprobadas; lint y compilación correctos.
- `52275e0`: cupón simulado DEMO10 de 10 %, validación y persistencia en checkout idempotente. Migración aplicada en base aislada; once pruebas con PostgreSQL aprobadas y compilación correcta. Pendientes: variantes y devoluciones.
- `69cf1a3`: registro de creación de tarjetas y corrección de contador WIP con filtros; TaskFlow verificado con nueve pruebas de políticas, doce de API PostgreSQL y diez de interfaz. ReservaYa incorpora ocupación de turnos configurados, excluye bloqueos y cancelaciones y aclara que no es un registro histórico inmutable: doce pruebas backend PostgreSQL, dos frontend, lint y compilación aprobados.
- `5799e59`: navegación y detalles del catálogo, control de teclado y disposición móvil de Snake, guardado de notas y limpieza de sesión de Interrogatorio. Diez pruebas de Snake, compilaciones de ambas interfaces y comprobaciones Chromium aprobadas. Aún faltan casos, contradicciones, línea temporal y progreso/logros adicionales.
- `019fb54`: acceso con clave compartida para API de laboratorios (obligatoria en producción), incidentes y alertas internas por fallos consecutivos, retención y consultas de red fuera de la transacción SQLite. Doce pruebas aprobadas. Esta clave no implementa identidad ni aislamiento por usuario; no se ha desplegado y no es suficiente para un servicio multiusuario. OCR/PDF y Azure Monitor siguen pendientes.
- No hay fases completas aún. Pendientes prioritarios: variantes y devoluciones transaccionales de TiendaNova; progreso y casos de juegos; aislamiento multiusuario de laboratorios y OCR; mejoras de accesibilidad, pruebas E2E integrales y validación de publicación. Continuar desde esos pendientes; no repetir pruebas ya aprobadas salvo cambios afectados. No se desplegó producción.

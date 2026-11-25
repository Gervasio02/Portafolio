# Evolución integral del portafolio

Actualizado: 2026-11-24. El desarrollo solicitado quedó completado y certificado
en el entorno local. La publicación externa se mantiene separada porque requiere
credenciales y permisos del propietario de cada proveedor.

| Fase                                        | Estado                | Evidencia principal                                                                                                                    |
| ------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Estabilidad, seguridad e infraestructura | Completada localmente | Migraciones y concurrencia en PostgreSQL aislado; compilaciones; auditorías npm y Python sin vulnerabilidades conocidas de producción. |
| 2. Rediseño visual                          | Completada            | Portada adaptable, navegación por teclado, foco visible, movimiento reducido y revisión en 390 y 1280 px.                              |
| 3. Explorador de proyectos                  | Completada            | Ocho proyectos desde una fuente común, búsqueda, filtros, estado vacío y fichas de arquitectura.                                       |
| 4. TaskFlow 2.0                             | Completada            | Roles, WIP, responsables, calendario, SLA, notificaciones, comentarios e historial global.                                             |
| 5. ReservaYa 2.0                            | Completada            | Tarifas punta, reserva concurrente, comprobante, cancelación, calendario y ocupación administrativa.                                   |
| 6. TiendaNova 2.0                           | Completada            | Variantes, cupón, compra idempotente, inventario concurrente, cancelación y devoluciones transaccionales.                              |
| 7. Snake e Interrogatorio                   | Completada            | Desafío diario, logros y PWA; tres familias de casos, cronología y conexiones de evidencias.                                           |
| 8. CloudOps                                 | Completada localmente | Mediciones reales, latencia, historial, incidentes y alertas; sin fingir uptime ni telemetría no disponible.                           |
| 9. DataLab                                  | Completada localmente | CSV/XLSX, limpieza, perfil, exportación y consultas agrupadas reproducibles.                                                           |
| 10. DocFlow                                 | Completada localmente | Texto, PDF y OCR local, validación, revisión humana, auditoría y límites de recursos.                                                  |
| 11. Consolidación                           | Completada localmente | Flujos integrales en navegador, diseño móvil y escritorio, documentación y CI con auditoría de dependencias.                           |

## Certificación local

- **TaskFlow:** 9 pruebas de políticas/SLA, 12 de API con PostgreSQL y 11 de
  interfaz; 98,91 % de cobertura de líneas de API, lint y build.
- **ReservaYa:** 12 pruebas backend con PostgreSQL y 95,84 % de cobertura; 2
  pruebas de interfaz, lint y build. El recorrido de navegador confirmó tarifa
  punta, reserva, historial y comprobante.
- **TiendaNova:** 13 pruebas de lógica/integración con PostgreSQL y 91,83 % de
  cobertura de líneas. El E2E de Chromium aprobó compra rechazada/aprobada,
  persistencia del carrito, panel administrativo y vista móvil. La prueba de
  captura opcional se omite salvo que se soliciten nuevas imágenes.
- **Snake:** 12 pruebas y build. En navegador se verificaron desafío diario,
  inicio, pausa, controles móviles y ausencia de desborde horizontal.
- **Interrogatorio:** 111 pruebas backend, lint y build. En navegador se
  verificaron expediente, cronología, contradicciones, pregunta y respuesta.
- **Laboratorios:** 15 pruebas, lint Python y validación JavaScript. En navegador
  se ejecutaron una limpieza, una consulta agrupada, una extracción, una revisión
  humana y una comprobación CloudOps.
- **Seguridad de dependencias:** `npm audit --omit=dev --audit-level=high` y
  `pip-audit` no reportaron vulnerabilidades conocidas después de actualizar JWT,
  FastAPI/Starlette, pytest, pypdf y Pillow. Las comprobaciones también quedaron
  incorporadas a CI.

## Condición de publicación

El 24 de noviembre de 2026 la portada publicada respondió correctamente. En la
comprobación manual de CloudOps, los cuatro servicios Azure no respondieron
dentro del tiempo disponible. Esto es una observación puntual, no una afirmación
de caída continua. No se modificaron recursos cloud, DNS, secretos ni bases de
producción.

El código queda listo para desplegar mediante los flujos de
`.github/workflows/`. Para publicar hacen falta las credenciales, variables y
presupuesto del propietario descritos en `PUBLICACION.md`. Después de un
despliegue autorizado debe repetirse el flujo principal contra cada URL pública.

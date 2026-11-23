# Estado y trabajo pendiente

Esta es una base funcional, no la finalización de las 13 fases solicitadas.

## Implementado en esta primera versión

- Caso determinista con semillas, tres dificultades, comprobaciones básicas, pruebas, sospechosos y pistas.
- Respuestas predefinidas, presión por pruebas, límite de 25 preguntas, notas, acusación, puntuación y ranking básico.
- Registro e inicio de sesión, modo invitado, persistencia mediante SQLAlchemy, API y primera interfaz responsive.
- Configuración Docker Compose para PostgreSQL, API y web; aún requiere comprobación en un equipo con Docker.

## Pendiente para cumplir el encargo

1. Planificación completa: historias, modelo de datos, secuencia, esquema JSON y diseño de endpoints.
2. Generador con variedad real, regeneración, coartadas y pistas equilibradas, descubrimiento progresivo, contradicciones y validación exhaustiva.
3. Abstracción LLM con Anthropic, Ollama y Mock, memoria, mínimo conocimiento, reintentos y flujo real.
4. Validación robusta de salida, moderación, amenazas y evaluación de 15 ataques frente a proveedores reales y simulados. Una lista de palabras no es una defensa general contra inyección.
5. Migraciones Alembic, rate limiting, límites diarios, logging estructurado, aislamiento transaccional, revocación de sesión y protección de secretos.
6. Cobertura completa de integración y umbrales solicitados, frontend con pruebas de componentes y E2E, evaluación reproducible con métricas y resultados.
7. Completar tecnologías solicitadas (Tailwind, TanStack Query, React Router, lint, tipos, formato y CI) y verificar accesibilidad y responsive en navegador.
8. Voz, enlaces compartibles, métricas de coste y latencia y caso diario.
9. Documentación final, capturas, guía de despliegue comprobada y despliegue real.

No se han probado Anthropic ni Ollama y no existe proveedor de IA conectado. No se ha medido el tiempo de juego ni se garantiza la seguridad ante jugadores maliciosos. No se debe publicar el prototipo en Internet.

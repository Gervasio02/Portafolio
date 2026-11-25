# Estado de Interrogatorio

La experiencia de portafolio está completa para ejecución y demostración local.
No se presenta como un servicio de IA ni como una aplicación lista para Internet.

## Alcance implementado

- Tres familias narrativas reproducibles por semilla, con tres dificultades,
  sospechosos, coartadas, culpable, cronología y evidencias conectadas.
- Preguntas con o sin presentación de prueba, límite de 25 turnos, notas,
  acusación, puntuación, historial y ranking.
- Registro, inicio de sesión y modo invitado; cada partida pertenece a su
  identidad y se persiste mediante SQLAlchemy.
- API FastAPI, interfaz React adaptable, PostgreSQL por Compose y SQLite para
  desarrollo directo.
- 111 pruebas del motor y API, lint Python, compilación frontend y CI.
- Flujo verificado en navegador a 390 px: sesión invitada, expediente,
  cronología, contradicciones, pregunta y respuesta.

## Decisiones explícitas

Las respuestas se generan mediante reglas deterministas. No hay Anthropic,
Ollama ni otro proveedor externo, por lo que no se atribuyen capacidades de un
LLM ni se incurre en costes de tokens. Las pistas ausentes no se inventan y la
solución puede reconstruirse desde el código; esta es una demo de lógica, no un
sistema antifraude.

## Condiciones antes de publicar

La publicación pública requeriría rate limiting, bloqueo de intentos de acceso,
revocación y rotación de sesiones, registro estructurado, supervisión, respaldo,
PostgreSQL dedicado, secretos y orígenes seguros, además de pruebas E2E
automatizadas contra la URL resultante. La ausencia de estos controles no afecta
la certificación local, pero impide declarar el prototipo apto para producción.

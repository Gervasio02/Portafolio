# Asistente «Pregúntale a mi portafolio»

Chat del portafolio que responde preguntas de reclutadores con una **red
neuronal programada desde cero**: se entrena en Python con NumPy (sin
librerías de machine learning) y se ejecuta en el navegador con JavaScript.
No usa APIs externas: la pregunta se responde en el equipo de quien la hace.

Página pública: https://gervasio.sbs/asistente/ · el chat está en todas las
páginas (botón «Pregúntame»).

## Cómo funciona

```
pregunta ─▶ normalizar ─▶ rasgos (palabras, pares, trigramas)
         ─▶ hashing FNV-1a a 2048 posiciones ─▶ capa oculta (96, ReLU)
         ─▶ softmax sobre las intenciones ─▶ respuesta o «no sé»
```

| Archivo | Qué hace |
| --- | --- |
| `conocimiento.yml` | Intenciones: palabras clave, ejemplos de preguntas y respuesta. **Es lo que se edita para enseñarle.** |
| `caracteristicas.py` | Texto → vector. Tiene un gemelo exacto en `portal/asistente/red.js`. |
| `entrenar.py` | Perceptrón multicapa con retropropagación y Adam escritos a mano. Exporta `portal/asistente/modelo.json` (pesos en int8, ~290 KB). |
| `tests/` | Datos válidos, paridad Python/JavaScript y acierto ≥ 85 % con preguntas que la red nunca vio. |
| `portal/asistente.js` / `.css` | El chat. Carga la red y el modelo solo al abrirse. |
| `portal/asistente/` | Página «Cómo funciono» con métricas y un probador en vivo. |

El entrenamiento separa el 20 % de los ejemplos para medir el acierto con
preguntas nuevas y luego entrena el modelo final con todos. Para generalizar
mejor, cada ejemplo se aumenta con errores de tipeo, palabras de relleno y
palabras omitidas.

## Enseñarle algo nuevo

1. Las preguntas que la red no supo responder, y las que alguien marcó como
   «no me sirvió», llegan de forma anónima al panel privado
   (https://gervasio.sbs/panel/, sección «Asistente»).
2. Edita `conocimiento.yml` (también desde el navegador en GitHub):
   - si la pregunta corresponde a una intención existente, agrégala a sus
     `ejemplos` (o una palabra a sus `claves`);
   - si es un tema nuevo, crea una intención con `id`, `claves`, al menos 6
     `ejemplos` y `respuesta`. Solo información real.
3. Guarda en `main` (o abre un PR). GitHub Actions prueba la red
   (flujo «Asistente») y el flujo «Publicar portada» la vuelve a entrenar y
   publica el modelo nuevo en unos minutos.

## Ejecutar en local

```bash
pip install -r asistente/requirements.txt
python asistente/entrenar.py --informe     # entrena y muestra lo que falla
python -m pytest -q asistente/tests        # requiere Node.js para la paridad
python -m http.server 8080 --directory portal   # y abre http://localhost:8080
```

## Privacidad

Solo se guardan las preguntas sin respuesta o marcadas como «no me sirvió»
(texto, intención estimada, seguridad y página), sin IP ni cookies, y nunca
si el navegador pide «No rastrear». Se borran a los 180 días.

# Interrogatorio

Demo de deducción para el portafolio: dos expedientes ficticios, tres sospechosos por caso, pruebas, testimonios, notas y acusación. Se juega sin servidor, cuenta ni IA; las respuestas y soluciones están escritas a mano y son visibles en el código. Las notas se pierden al reiniciar o recargar la página.

Para probarla desde la raíz del repositorio:

```bash
python -m http.server 8080 --directory portal
```

Abre `http://localhost:8080/interrogatorio/`. Para ejecutar las pruebas automatizadas instala Node.js y Python y ejecuta:

```bash
cd tests/interrogatorio
npm ci
npx playwright install chromium
npm test
```

La carpeta `portal/` se publica mediante el flujo de Azure Static Web Apps existente; no requiere un recurso nuevo ni variables secretas adicionales. El flujo ejecuta las pruebas antes de desplegar. La publicación depende de la configuración ya existente del repositorio y no debe asumirse hasta verificar la ejecución y la URL pública.

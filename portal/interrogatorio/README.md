# Interrogatorio

Demo de deducci�n para el portafolio: dos expedientes ficticios, tres sospechosos por caso, pruebas, testimonios, notas y acusaci�n. Se juega sin servidor, cuenta ni IA; las respuestas y soluciones est�n escritas a mano y son visibles en el c�digo. Las notas se pierden al reiniciar o recargar la p�gina.

Para probarla desde la ra�z del repositorio:

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

La carpeta `portal/` se publica mediante el flujo de Azure Static Web Apps existente; no requiere un recurso nuevo ni variables secretas adicionales. El flujo ejecuta las pruebas antes de desplegar. La publicaci�n depende de la configuraci�n ya existente del repositorio y no debe asumirse hasta verificar la ejecuci�n y la URL p�blica.

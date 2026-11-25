const { test, expect } = require('@playwright/test');

// Páginas del portal que se revisan en cada cambio.
const paginas = [
  '/',
  '/proyectos/',
  '/laboratorio.html',
  '/taskflow/index.html',
  '/reservaya/index.html',
  '/tiendanova/index.html',
  '/interrogatorio/index.html',
];

test('ningún enlace interno ni recurso del portal está roto', async ({ page, request }) => {
  const revisados = new Set();
  for (const ruta of paginas) {
    const fallidos = [];
    page.on('response', (r) => { if (r.status() >= 400) fallidos.push(`${r.status()} ${r.url()}`); });
    await page.goto(ruta);
    expect(fallidos, `recursos con error en ${ruta}`).toEqual([]);
    page.removeAllListeners('response');

    const enlaces = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
    for (const url of enlaces) {
      const destino = new URL(url);
      if (destino.origin !== new URL(page.url()).origin) continue;
      destino.hash = '';
      if (revisados.has(destino.href)) continue;
      revisados.add(destino.href);
      const respuesta = await request.get(destino.href);
      expect(respuesta.status(), `enlace roto en ${ruta}: ${destino.href}`).toBeLessThan(400);
    }
  }
});

test('las anclas de la portada apuntan a secciones existentes', async ({ page }) => {
  await page.goto('/');
  const anclas = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h.length > 1));
  for (const ancla of anclas) await expect(page.locator(ancla)).toHaveCount(1);
});

for (const width of [1440, 390, 320]) {
  test(`la portada no se desborda en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(width);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola, soy Gervasio');
  });
}

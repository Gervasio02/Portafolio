const { test, expect } = require('@playwright/test');

// Páginas públicas que forman una sola experiencia de portafolio.
const paginas = [
  '/',
  '/proyectos/',
  '/laboratorio.html',
  '/taskflow/',
  '/reservaya/',
  '/tiendanova/',
  '/interrogatorio/',
  '/cv.html',
  '/asistente/',
];

const canonicas = new Map([
  ['/', 'https://gervasio.sbs/'],
  ['/proyectos/', 'https://gervasio.sbs/proyectos/'],
  ['/laboratorio.html', 'https://gervasio.sbs/laboratorio.html'],
  ['/taskflow/', 'https://gervasio.sbs/taskflow/'],
  ['/reservaya/', 'https://gervasio.sbs/reservaya/'],
  ['/tiendanova/', 'https://gervasio.sbs/tiendanova/'],
  ['/interrogatorio/', 'https://gervasio.sbs/interrogatorio/'],
  ['/cv.html', 'https://gervasio.sbs/cv.html'],
  ['/asistente/', 'https://gervasio.sbs/asistente/'],
]);

const hashDinamicos = new Set([
  '/laboratorio.html#taskflow',
  '/laboratorio.html#reservaya',
  '/laboratorio.html#tiendanova',
]);

test('ningún enlace interno ni recurso del portal está roto', async ({ page, request }) => {
  const revisados = new Set();
  for (const ruta of paginas) {
    const fallidos = [];
    const registrar = (respuesta) => {
      const url = new URL(respuesta.url());
      if (url.origin === new URL(page.url()).origin && respuesta.status() >= 400) {
        fallidos.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    };
    page.on('response', registrar);
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    expect(fallidos, `recursos con error en ${ruta}`).toEqual([]);
    page.off('response', registrar);

    const enlaces = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
    for (const url of enlaces) {
      const destino = new URL(url);
      if (destino.origin !== new URL(page.url()).origin) continue;
      destino.hash = '';
      if (revisados.has(destino.href)) continue;
      revisados.add(destino.href);
      const respuesta = await request.get(`${destino.pathname}${destino.search}`);
      expect(respuesta.status(), `enlace roto en ${ruta}: ${destino.href}`).toBeLessThan(400);
    }
  }
});

test('todos los enlaces internos con fragmento llegan a una sección válida', async ({ page }) => {
  const enlaces = [];
  for (const ruta of paginas) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    const base = page.url();
    const hrefs = await page.$$eval('a[href*="#"]', (as) => as.map((a) => a.getAttribute('href')));
    for (const href of hrefs) {
      const destino = new URL(href, base);
      if (!destino.hash || destino.origin !== new URL(base).origin) continue;
      enlaces.push({ origen: ruta, destino: `${destino.pathname}${destino.search}${destino.hash}` });
    }
  }

  for (const { origen, destino } of enlaces) {
    if (hashDinamicos.has(destino)) continue; // Estos tres fragmentos seleccionan una demo por JavaScript.
    await page.goto(destino, { waitUntil: 'domcontentloaded' });
    const id = decodeURIComponent(new URL(page.url()).hash.slice(1));
    const cantidad = await page.evaluate((fragmento) => document.querySelectorAll(`[id="${CSS.escape(fragmento)}"]`).length, id);
    expect(cantidad, `fragmento roto desde ${origen}: ${destino}`).toBe(1);
  }
});

for (const [ruta, canonical] of canonicas) {
  test(`metadatos completos en ${ruta}`, async ({ page }) => {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Gervasio|Portafolio|TaskFlow|ReservaYa|TiendaNova|Interrogatorio/);
    const descripcion = await page.locator('meta[name="description"]').getAttribute('content');
    expect(descripcion?.trim().length, `descripción insuficiente en ${ruta}`).toBeGreaterThanOrEqual(20);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S+/);
    const descripcionSocial = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(descripcionSocial?.trim().length, `descripción social insuficiente en ${ruta}`).toBeGreaterThanOrEqual(20);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://gervasio.sbs/capturas/gervasio-social.jpg',
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });
}

test('la portada publica datos estructurados verificables', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const contenido = await page.locator('script[type="application/ld+json"]').textContent();
  const datos = JSON.parse(contenido);
  const tipos = datos['@graph'].map((entrada) => entrada['@type']);
  expect(tipos).toEqual(expect.arrayContaining(['WebSite', 'Person', 'ProfilePage']));
  expect(datos['@graph'].find((entrada) => entrada['@type'] === 'Person').url).toBe('https://gervasio.sbs/');
});

test('404 no se indexa', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});

test('robots, sitemap y dominio personalizado están alineados', async ({ page, request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toMatch(/User-agent:\s*\*/i);
  expect(robotsText).toMatch(/Allow:\s*\//i);
  expect(robotsText).toContain('Sitemap: https://gervasio.sbs/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const errorXml = await page.evaluate((contenido) => {
    const documento = new DOMParser().parseFromString(contenido, 'application/xml');
    return documento.querySelector('parsererror')?.textContent || '';
  }, xml);
  expect(errorXml, 'sitemap.xml debe ser XML válido').toBe('');

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(new Set(urls)).toEqual(new Set(canonicas.values()));
  for (const url of urls) {
    expect(url).toMatch(/^https:\/\/gervasio\.sbs\//);
    const respuesta = await request.get(new URL(url).pathname);
    expect(respuesta.status(), `URL del sitemap no disponible: ${url}`).toBeLessThan(400);
  }

  const cname = await request.get('/CNAME');
  expect(cname.status()).toBe(200);
  expect((await cname.text()).trim()).toBe('gervasio.sbs');
});

for (const width of [320, 390, 768, 1440]) {
  test(`todas las páginas se adaptan sin desborde en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const ruta of paginas) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(ancho, `desborde horizontal en ${ruta}`).toBeLessThanOrEqual(width);
    }
  });
}

for (const width of [320, 390]) {
  test(`navegación y acciones principales son táctiles en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const ruta of paginas) {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      const controles = page.locator(
        'header nav a, .topbar a, a.boton, a.hero-link, .project-links a, .lab-nav a, button',
      );
      for (let index = 0; index < await controles.count(); index += 1) {
        const control = controles.nth(index);
        if (!(await control.isVisible())) continue;
        const caja = await control.boundingBox();
        expect(caja, `control sin caja visible en ${ruta}`).not.toBeNull();
        expect(caja.height, `control demasiado bajo en ${ruta}: ${await control.innerText()}`).toBeGreaterThanOrEqual(43.5);
        expect(caja.width, `control demasiado estrecho en ${ruta}: ${await control.innerText()}`).toBeGreaterThanOrEqual(43.5);
      }
    }
  });
}

test('el modo de movimiento reducido permanece utilizable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola, soy Gervasio');
  await expect(page.locator('#niveles')).toBeVisible();
});

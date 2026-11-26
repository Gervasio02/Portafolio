const { test, expect } = require('@playwright/test');

test('el catálogo filtra y abre el detalle enlazado', async ({ page }) => {
  await page.goto('/proyectos/#reservaya');
  await expect(page.locator('#reservaya details')).toHaveAttribute('open', '');
  await expect(page.locator('#projects article')).toHaveCount(9);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('python');
  await expect(page.locator('#projects article')).toHaveCount(4);
  await page.getByLabel('Tipo').selectOption('Juegos');
  await expect(page.locator('#projects article')).toHaveCount(1);
  await expect(page.locator('#projects article h2')).toHaveText('Interrogatorio');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('no existe');
  await expect(page.getByText('No hay resultados. Prueba otro filtro.')).toBeVisible();
});

test('los nueve proyectos tienen un acceso público directo y seguro', async ({ page }) => {
  await page.goto('/proyectos/');
  const tarjetas = page.locator('#projects article');
  await expect(tarjetas).toHaveCount(9);

  for (let index = 0; index < await tarjetas.count(); index += 1) {
    const tarjeta = tarjetas.nth(index);
    const nombre = await tarjeta.locator('h2').innerText();
    const accesos = tarjeta.locator('.catalog-actions a');
    expect(await accesos.count(), `${nombre} debe tener accesos directos`).toBeGreaterThan(0);
    const hrefs = await accesos.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs.some((href) => !href.includes('github.com')), `${nombre} necesita una demo o aplicación pública`).toBe(true);
    expect(hrefs.some((href) => /localhost|127\.0\.0\.1/i.test(href)), `${nombre} contiene una URL local`).toBe(false);
  }

  const laboratorios = {};
  for (const id of ['cloudops', 'datalab', 'docflow']) {
    laboratorios[id] = await page.locator(`#${id} .catalog-actions a`).first().getAttribute('href');
  }
  expect(new Set(Object.values(laboratorios)).size).toBe(3);
  expect(laboratorios.cloudops).toContain('/cloudops');
  expect(laboratorios.datalab).toContain('/datalab');
  expect(laboratorios.docflow).toContain('/docflow');
});

test('los enlaces externos preservan el portafolio abierto de forma segura', async ({ page }) => {
  const paginas = [
    '/',
    '/proyectos/',
    '/laboratorio.html',
    '/taskflow/',
    '/reservaya/',
    '/tiendanova/',
    '/interrogatorio/',
    '/cv.html',
  ];

  for (const ruta of paginas) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    const externos = page.locator('a[href^="http://"], a[href^="https://"]');
    for (let index = 0; index < await externos.count(); index += 1) {
      const enlace = externos.nth(index);
      const href = await enlace.getAttribute('href');
      const host = new URL(href).hostname;
      if (host === 'gervasio.sbs') continue;
      await expect(enlace, `${ruta}: ${href}`).toHaveAttribute('target', '_blank');
      const rel = (await enlace.getAttribute('rel')) || '';
      expect(rel.split(/\s+/), `${ruta}: ${href}`).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
  }
});

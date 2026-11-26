const { test, expect } = require('@playwright/test');

// El asistente corre completo en el navegador: estas pruebas no dependen de
// ningún servidor externo.

test('el asistente responde una pregunta sobre el stack', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pregúntame' }).click();
  const chat = page.getByRole('dialog', { name: 'Pregúntale a mi portafolio' });
  await expect(chat).toBeVisible();
  await chat.getByLabel('Escribe tu pregunta').fill('¿qué tecnologías usas?');
  await chat.getByRole('button', { name: 'Enviar' }).click();
  await expect(chat.locator('.asis-bot').last()).toContainText('React');
  await expect(chat.locator('.asis-bot').last()).toContainText('seguridad');
});

test('las sugerencias generan respuestas y el chat se cierra con Escape', async ({ page }) => {
  await page.goto('/taskflow/');
  await page.getByRole('button', { name: 'Pregúntame' }).click();
  const chat = page.getByRole('dialog');
  const sugerencia = chat.locator('.asis-sugerencias button').first();
  await expect(sugerencia).toBeVisible();
  await sugerencia.click();
  await expect(chat.locator('.asis-bot')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(chat).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pregúntame' })).toBeFocused();
});

test('admite cuando no sabe y no inventa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pregúntame' }).click();
  const chat = page.getByRole('dialog');
  await chat.getByLabel('Escribe tu pregunta').fill('xqzv wlpt');
  await chat.getByRole('button', { name: 'Enviar' }).click();
  await expect(chat.locator('.asis-bot').last()).toContainText('No estoy seguro');
});

test('los enlaces de las respuestas funcionan desde páginas interiores', async ({ page, request }) => {
  await page.goto('/reservaya/#preguntame');
  const chat = page.getByRole('dialog');
  await expect(chat).toBeVisible();
  await chat.getByLabel('Escribe tu pregunta').fill('¿tienes cv?');
  await chat.getByRole('button', { name: 'Enviar' }).click();
  const enlace = chat.locator('.asis-bot').last().getByRole('link', { name: 'verlo en línea' });
  await expect(enlace).toHaveAttribute('href', /\/cv\.html$/);
  const ruta = new URL(await enlace.getAttribute('href')).pathname;
  expect((await request.get(ruta)).status()).toBe(200);
});

test('la página de cómo funciona muestra métricas y el probador', async ({ page }) => {
  await page.goto('/asistente/');
  await expect(page.locator('[data-metrica="exactitud_validacion"]')).toContainText('%');
  await page.getByLabel('Pregunta de prueba').fill('¿sabes docker?');
  await expect(page.locator('#top li').first()).toContainText('devops');
});

for (const width of [320, 390]) {
  test(`el chat abierto cabe sin desbordes en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Pregúntame' }).click();
    const caja = await page.getByRole('dialog').boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(width);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(width);
  });
}

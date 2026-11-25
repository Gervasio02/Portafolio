const { test, expect } = require('@playwright/test');

test('el catálogo filtra y abre el detalle enlazado', async ({ page }) => {
  await page.goto('/proyectos/#reservaya');
  await expect(page.locator('#reservaya details')).toHaveAttribute('open', '');
  await expect(page.locator('#projects article')).toHaveCount(8);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('python');
  await expect(page.locator('#projects article')).toHaveCount(4);
  await page.getByLabel('Tipo').selectOption('Juegos');
  await expect(page.locator('#projects article')).toHaveCount(1);
  await expect(page.locator('#projects article h2')).toHaveText('Interrogatorio');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('no existe');
  await expect(page.getByText('No hay resultados. Prueba otro filtro.')).toBeVisible();
});

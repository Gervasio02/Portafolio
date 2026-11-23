import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("guest cart survives reload, then a signed-in customer completes a simulated purchase", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const quickFilters = page.getByRole("navigation", {
    name: "Accesos por categoría",
  });
  await quickFilters.getByRole("link", { name: "Iluminación" }).click();
  await expect(
    quickFilters.getByRole("link", { name: "Iluminación" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Teclado mecánico Forma" }),
  ).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Buscar productos" })
    .fill("Lámpara de escritorio Aura");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await page.getByRole("link", { name: /Lámpara de escritorio Aura/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lámpara de escritorio Aura" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver imagen 2" }).click();
  await expect(
    page.getByRole("button", { name: "Ver imagen 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("link", { name: "Ver carrito" }).click();
  await expect(page).toHaveURL(/\/carrito$/);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Lámpara de escritorio Aura" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inicia sesión para comprar" }).click();
  await page.getByRole("link", { name: "Regístrate" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente de prueba");
  await page
    .getByLabel("Correo electrónico")
    .fill(`cliente-${randomUUID()}@example.test`);
  await page.getByLabel("Contraseña").fill("test-password-123!");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/carrito$/);
  await page.getByRole("button", { name: "Importar mi carrito local" }).click();
  await expect(
    page.getByRole("link", { name: "Lámpara de escritorio Aura" }),
  ).toBeVisible();
  await page.getByLabel("Nombre de la dirección").fill("Casa demo");
  await page.getByLabel("Calle y número").fill("Calle de prueba 123");
  await page.getByLabel("Comuna").fill("Rengo");
  await page.getByLabel("Región").fill("O'Higgins");
  await page.getByRole("button", { name: "Guardar dirección" }).click();
  await page.getByLabel("Dirección de entrega").selectOption({ index: 1 });
  await page.getByLabel("Resultado del pago de prueba").selectOption("decline");
  await page.getByRole("button", { name: "Pagar (simulado)" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "El pago simulado fue rechazado" }),
  ).toBeVisible();
  await page.getByLabel("Dirección de entrega").selectOption({ index: 1 });
  await page.getByLabel("Resultado del pago de prueba").selectOption("approve");
  await page.getByRole("button", { name: "Pagar (simulado)" }).click();
  await expect(page.getByText("Compra de prueba confirmada")).toBeVisible();
  await expect(page.getByText("Lámpara de escritorio Aura × 1")).toBeVisible();
  const activeStep = page.locator('[aria-current="step"]');
  await expect(activeStep).toContainText("Pago aprobado");
  const orderId = (await page.locator("h1").innerText()).trim();
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const admin = await browser.newPage();
    try {
      await admin.goto(new URL("/entrar", page.url()).href);
      await admin.getByLabel("Correo electrónico").fill(email);
      await admin.getByLabel("Contraseña").fill(password);
      await admin.getByRole("button", { name: "Entrar", exact: true }).click();
      await admin.getByRole("link", { name: "Administrar" }).click();
      const filter = admin.getByRole("navigation", {
        name: "Filtrar pedidos por estado",
      });
      await filter.getByRole("link", { name: /^Pagado/ }).click();
      const row = admin.getByRole("row").filter({ hasText: orderId });
      await row.getByRole("button", { name: "Marcar como enviado" }).click();
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(activeStep).toContainText("Pedido enviado");
      await filter.getByRole("link", { name: /^Enviado/ }).click();
      await row.getByRole("button", { name: "Marcar como entregado" }).click();
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(activeStep).toContainText("Pedido entregado");
    } finally {
      await admin.close();
    }
  }
  await page.getByRole("link", { name: "Volver a mi cuenta" }).click();
  await expect(page.getByRole("link", { name: /Pedido / })).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Página no disponible" }),
  ).toBeVisible();
});

test("catalog fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("capture a fictional catalog preview", async ({ page }) => {
  test.skip(!process.env.CAPTURE_TN_SCREENSHOTS);
  await page.setViewportSize({ width: 1420, height: 1160 });
  await page.goto("/");
  await page.getByRole("heading", { name: "Catálogo" }).waitFor();
  await page
    .locator(".hero-photo img")
    .evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({
    path: "docs/screenshots/catalogo.jpg",
    type: "jpeg",
    quality: 83,
    animations: "disabled",
  });
  await page.locator("#como-funciona").screenshot({
    path: "docs/screenshots/recorrido.jpg",
    type: "jpeg",
    quality: 83,
    animations: "disabled",
  });
});

test("an administrator manages a product and can read sales", async ({
  page,
}) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  test.skip(!email || !password);
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("link", { name: "Administrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Ventas · últimos 7 días" }),
  ).toBeVisible();
  await page.getByText("Crear producto", { exact: true }).click();
  const newForm = page.locator("details").filter({ hasText: "Crear producto" });
  const suffix = randomUUID().slice(0, 8);
  const title = `Producto de prueba ${suffix}`;
  await newForm.getByLabel("Nombre", { exact: true }).fill(title);
  await newForm.getByLabel("Identificador URL").fill(`producto-${suffix}`);
  await newForm
    .getByLabel("Descripción")
    .fill("Producto ficticio para probar la administración.");
  await newForm.getByLabel("Precio (CLP)").fill("12990");
  await newForm.getByLabel("Stock", { exact: true }).fill("4");
  await newForm.getByRole("button", { name: "Guardar producto" }).click();
  const item = page.locator("details").filter({ hasText: title });
  await item.locator("summary").click();
  await item.getByLabel("Stock", { exact: true }).fill("5");
  await item.getByRole("button", { name: "Guardar producto" }).click();
  await expect(item.locator("summary")).toContainText("5 uds.");
  await item.getByRole("button", { name: "Archivar producto" }).click();
  await expect(item.locator("summary")).toContainText("Archivado");
  await page.goto(`/catalogo/producto-${suffix}`);
  await expect(
    page.getByRole("heading", { name: "Página no disponible" }),
  ).toBeVisible();
});

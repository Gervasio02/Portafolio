const {test, expect} = require("@playwright/test");
for (const viewport of [{width: 1280,height: 900}, {width: 390,height: 844}]) {
 test(`resolver y reiniciar ambos expedientes ${viewport.width}px`, async ({page}) => {
  await page.setViewportSize(viewport); await page.goto("/interrogatorio/");
  await expect(page.getByText("0 de 3 revisadas")).toBeVisible();
  await expect(page.locator("#accusation-form button")).toBeDisabled();
  await page.getByText("Registro de acceso",{exact:true}).first().click();
  await page.getByText("Informe de auditor�a",{exact:true}).first().click();
  await page.locator("#interview-form button").click();
  await page.locator("#interview-evidence").selectOption("access");
  await page.locator("#evidence-form button").click();
  await page.locator("#interview-evidence").selectOption("audit");
  await page.locator("#evidence-form button").click();
  await expect(page.locator("#interview-log").getByText(/Entr� a la biblioteca/)).toBeVisible();
  await page.locator("#accusation-suspect").selectOption("elena");
  await page.locator("#accusation-form button").click();
  await expect(page.getByRole("heading", {name:"Caso resuelto"})).toBeVisible();
  await page.locator("#case-choice").selectOption("galeria");
  await expect(page.getByText("0 de 3 revisadas")).toBeVisible();
  await expect(page.locator("#case-verdict")).toBeHidden();
  await page.getByText("Registro de la puerta",{exact:true}).first().click();
  await page.getByText("Factura de transporte",{exact:true}).first().click();
  await page.locator("#interview-suspect").selectOption("mateo");
  await page.locator("#interview-form button").click();
  await page.locator("#interview-evidence").selectOption("door");
  await page.locator("#evidence-form button").click();
  await page.locator("#interview-evidence").selectOption("invoice");
  await page.locator("#evidence-form button").click();
  await expect(page.locator("#interview-log").getByText(/Abr� la puerta de carga/)).toBeVisible();
  await page.locator("#accusation-suspect").selectOption("lucia");
  await page.locator("#accusation-form button").click();
  await expect(page.getByRole("heading",{name:"La acusaci�n no coincide"})).toBeVisible();
  await expect(page.locator("#case-verdict-notice")).toContainText("Mateo Cruz");
  await page.getByRole("button",{name:"Jugar de nuevo"}).click();
  await expect(page.getByText("0 de 3 revisadas")).toBeVisible();
  await expect(page.locator("#accusation-form button")).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 });
}

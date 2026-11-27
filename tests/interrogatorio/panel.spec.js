const { test, expect } = require('@playwright/test');

// El panel privado se prueba con datos simulados: no necesita la clave real.
const datos = {
  generado: new Date().toISOString(),
  dias: 30,
  totales: { vistas_hoy: 2, sesiones_hoy: 1, vistas_7d: 2, sesiones_7d: 1, vistas_periodo: 2, sesiones_periodo: 1, clics_periodo: 1, activos_5min: 1 },
  por_dia: [{ dia: new Date().toISOString().slice(0, 10), vistas: 2, sesiones: 1 }],
  paginas: [['/', 1], ['/taskflow/', 1]],
  acciones: [['navegacion', 1]],
  proyectos: [],
  enlaces: [['Ver ficha', 1]],
  referentes: [['www.linkedin.com', 1]],
  dispositivos: [['escritorio', 1]],
  idiomas: [['es-CL', 1]],
  recientes: [{ hora: '27-11 10:00', tipo: 'salida', ruta: '/', detalle: '', dispositivo: 'escritorio' }],
  comportamiento: {
    sesiones: 1, rebote: 0, duracion_media: 95, paginas_por_sesion: 2,
    entradas: [['/', 1]], salidas: [['/taskflow/', 1]],
    paginas: [{ ruta: '/', vistas: 1, segundos: 42, scroll: 80 }],
  },
  ubicacion: { paises: [['Chile', 1]], lugares: [['Rancagua, O\'Higgins, Chile', 1]], redes: [['Universidad Ejemplo', 1]] },
  sesiones: [{
    inicio: '27-11 10:00', duracion: 95, paginas: 2, clics: 1, preguntas: 1,
    lugar: 'Rancagua, O\'Higgins, Chile', red: 'Universidad Ejemplo', referente: 'www.linkedin.com',
    dispositivo: 'escritorio', idioma: 'es-CL',
    pasos: [
      { hora: '10:00:00', tipo: 'vista', ruta: '/' },
      { hora: '10:00:40', tipo: 'clic', ruta: '/', detalle: 'Ver ficha' },
      { hora: '10:00:42', tipo: 'salida', ruta: '/', segundos: 42, scroll: 80 },
      { hora: '10:00:43', tipo: 'vista', ruta: '/taskflow/' },
    ],
  }],
  asistente: {
    total: 2, sin_respuesta: 2, no_sirvio: 0,
    frecuentes: [['cm tay', 1], ['¿sabes cobol?', 1]],
    recientes: [
      { hora: '27-11 10:01', pregunta: '¿Sabes COBOL?', intencion: 'otros_lenguajes', confianza: 0.2, motivo: 'sin_respuesta' },
      { hora: '27-11 10:02', pregunta: 'cm tay', intencion: 'como_estas', confianza: 0.3, motivo: 'sin_respuesta' },
    ],
  },
};

test('el panel muestra recorridos, ubicación y separa preguntas aprendidas', async ({ page }) => {
  await page.route('**/api/panel/resumen**', (ruta) => ruta.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(datos),
  }));
  await page.goto('/panel/');
  await page.getByLabel('Clave').fill('clave-de-prueba');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#t-duracion')).toHaveText('1 min 35 s');
  await expect(page.locator('#redes')).toContainText('Universidad Ejemplo');
  await expect(page.locator('#atencion')).toContainText('42 s');
  await page.locator('.recorrido summary').first().click();
  await expect(page.locator('.recorrido').first()).toContainText('Clic en «Ver ficha»');
  await expect(page.locator('.recorrido').first()).toContainText('tras 42 s, bajó 80 %');
  // «cm tay» ya está en el entrenamiento; «¿Sabes COBOL?» no.
  await expect(page.locator('#asistente-recientes')).toContainText('COBOL');
  await expect(page.locator('#asistente-recientes')).not.toContainText('cm tay');
  await expect(page.locator('#aprendidas-total')).toHaveText('(1)');
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});

/**
 * E2E móvil (modo local: Firebase bloqueado).
 * Ejecutar: node test/e2e-mobile.mjs
 */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ARTIFACTS = '/opt/cursor/artifacts';
const PORT = 8765;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = req.url.split('?')[0];
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function run() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const server = await startServer();
  const iPhone = devices['iPhone 13'];

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...iPhone,
    serviceWorkers: 'block'
  });

  await context.route('**/*firebase*', (route) => route.abort());
  await context.route('**/gstatic.com/**', (route) => route.abort());

  const page = await context.newPage();
  const base = `http://127.0.0.1:${PORT}`;

  await page.goto(base);
  await page.evaluate(() => {
    localStorage.setItem('lista-compra-key-v1', 'test-e2e-local');
    localStorage.removeItem('lista-cache-test-e2e-local');
  });
  await page.reload();
  await page.waitForSelector('#app-shell:not([hidden])', { timeout: 10000 });

  // Catálogo: producto nuevo
  await page.click('[data-view="master"]');
  const search = page.locator('#add-search');
  await search.fill('Zanahoria Nueva');
  await page.waitForSelector('.create-row');
  await page.screenshot({ path: path.join(ARTIFACTS, 'catalog-create-row.png'), fullPage: true });
  await page.click('.create-row');
  await page.waitForTimeout(400);

  // Lista debe tener zanahoria
  await page.click('[data-view="shop"]');
  await page.waitForSelector('#lista-edit li');
  const listaText = await page.locator('#lista-edit').innerText();
  if (!listaText.toLowerCase().includes('zanahoria')) throw new Error('Nuevo producto no en lista');

  // Añadir existente (leche en catálogo primero)
  await page.click('[data-view="master"]');
  await search.fill('');
  await search.fill('Leche Entera');
  await page.click('.create-row');
  await page.waitForTimeout(300);
  await search.fill('Leche Entera');
  await search.press('Enter');
  await page.waitForTimeout(300);
  const toast = await page.locator('#toast-msg').innerText();
  if (!toast.includes('ya está')) throw new Error('Duplicado no avisado: ' + toast);

  // Más productos para compra
  for (const name of ['Pan', 'Huevos']) {
    await search.fill(name);
    await page.click('.create-row');
    await page.waitForTimeout(250);
  }

  await page.click('[data-view="shop"]');
  await page.screenshot({ path: path.join(ARTIFACTS, 'lista-con-productos.png'), fullPage: true });

  await page.click('#btn-start-shop');
  await page.waitForSelector('#shop-active:not([hidden])');
  const items = page.locator('#shop-list li');
  const count = await items.count();
  if (count < 4) throw new Error('Menos de 4 items en compra');

  await items.nth(0).click();
  await items.nth(1).click();

  // Finalizar con pendientes (confirmación en <dialog> nativo)
  await page.click('#btn-finish-shop');
  await page.waitForSelector('#confirm-dialog[open]');
  await page.click('#confirm-ok');
  await page.waitForTimeout(500);
  await page.waitForSelector('#shop-edit:not([hidden])', { timeout: 10000 });
  const remaining = await page.locator('#lista-edit li').count();
  if (remaining !== 2) throw new Error(`Esperados 2 pendientes, hay ${remaining}`);
  await page.screenshot({ path: path.join(ARTIFACTS, 'compra-finalizada-pendientes.png'), fullPage: true });

  // Otra compra
  await page.click('#btn-start-shop');
  await page.waitForSelector('#shop-active:not([hidden])');
  const unchecked = await page.locator('#shop-list li:not(.done)').count();
  if (unchecked !== 2) throw new Error('Pendientes sin marcar al reiniciar compra');

  // Añadir durante compra
  await page.click('[data-view="master"]');
  await search.fill('Mantequilla');
  await page.click('.create-row');
  await page.waitForTimeout(400);
  await page.click('[data-view="shop"]');
  await page.waitForSelector('#shop-list li >> text=Mantequilla');
  const totalActive = await page.locator('#shop-list li').count();
  if (totalActive !== 3) throw new Error(`Esperados 3 en compra activa, hay ${totalActive}`);

  await page.screenshot({ path: path.join(ARTIFACTS, 'compra-activa-anadido.png'), fullPage: true });

  await browser.close();
  server.close();
  console.log('e2e-mobile.mjs: OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

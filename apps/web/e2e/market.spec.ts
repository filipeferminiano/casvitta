import { expect, test } from '@playwright/test';

/**
 * SEO-1 price pages against the real API (fabricated demo seed in casvitta_e2e):
 * neighborhood → street → building → "avise-me" stored with consent.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 8100);
const site = (path: string) => `http://localhost:${port}${path}`;
const ADMIN = { 'X-Admin-Token': 'e2e-admin-token' };

test.skip(({ isMobile }) => isMobile, 'desktop flow');

test('price pages → building → alert stored with consent', async ({ page, request }) => {
  await page.goto(site('/preco-m2/sao-paulo/vila-mariana'));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vila Mariana: quanto se pagou por imóveis' }),
  ).toBeVisible();
  await expect(page.getByText('Demonstrativo').first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');

  await page.getByRole('link', { name: 'Avenida dos Ipes Ficticios' }).first().click();
  await expect(page).toHaveURL(/\/preco-m2\/sao-paulo\/vila-mariana\/avenida-dos-ipes-ficticios$/);

  await page.getByRole('link', { name: 'Condomínio Jardim Exemplo' }).first().click();
  await expect(page).toHaveURL(/\/condominio\/sao-paulo\/vila-mariana\/condominio-jardim-exemplo$/);
  await page.waitForLoadState('networkidle'); // controlled inputs: fill after hydration

  const form = page.getByRole('region', { name: 'Avise-me quando houver unidade à venda' });
  await form.getByLabel('Nome').fill('Pessoa Fictícia E2E');
  await form.getByRole('textbox', { name: 'WhatsApp' }).fill('(11) 90000-0001');
  await form.getByRole('button', { name: 'Quero ser avisado' }).click();
  await expect(form.getByText('Para continuar, marque que aceita ser contatado.')).toBeVisible();
  await form.getByLabel(/Aceito que a Casvitta e corretores parceiros/).check();
  await form.getByRole('button', { name: 'Quero ser avisado' }).click();
  await expect(form.getByText('Pedido registrado')).toBeVisible();

  const response = await request.get(`http://127.0.0.1:${apiPort}/v1/admin/property-alerts`, {
    headers: ADMIN,
  });
  expect(response.ok()).toBeTruthy();
  const alerts = (await response.json()) as {
    name: string;
    intent: string;
    scope_path: string;
    phone_e164: string;
    contact_consent: boolean;
    marketing_consent: boolean;
  }[];
  const mine = alerts.find((a) => a.name === 'Pessoa Fictícia E2E');
  expect(mine).toMatchObject({
    intent: 'buy',
    scope_path: '/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo',
    phone_e164: '+5511900000001',
    contact_consent: true,
    marketing_consent: false,
  });
});

test('below the gate: no numbers, noindex, follow', async ({ page }) => {
  await page.goto(site('/preco-m2/sao-paulo/aclimacao'));
  await expect(page.getByText('Poucos dados para mostrar preços aqui')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
});

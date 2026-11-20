import { expect, test } from '@playwright/test';

/** Public site (Milestone 0.6): search, capture pages and broker signup, against mocks. */
const port = Number(process.env.E2E_PORT ?? 3100);
const market = (path: string) => `http://localhost:${port}${path}`;

test.skip(
  ({ isMobile }) => isMobile,
  'desktop flows; phone layouts are covered by screens:capture',
);

test('home search → results → property detail', async ({ page }) => {
  await page.goto(market('/'));
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Onde').fill('Vila Mariana');
  await page.getByRole('button', { name: 'Buscar imóveis' }).click();
  await expect(page).toHaveURL(/\/comprar\?onde=Vila\+Mariana/);
  await page.getByRole('link', { name: 'Rua Domingos de Morais · Vila Mariana' }).first().click();
  await expect(page).toHaveURL(/\/imovel\/apto-vila-mariana/);
  await expect(
    page.getByText('CRECI-SP 000.000-F').filter({ visible: true }).first(),
  ).toBeVisible();
});

test('auction interest is stored and the confirmation shows the criteria', async ({ page }) => {
  await page.goto(market('/leilao'));
  await page.waitForLoadState('networkidle'); // controlled inputs: fill after hydration
  await expect(page.getByText('A Casvitta não é leiloeira.', { exact: false })).toBeVisible();
  await page.getByLabel('Seu nome').fill('Júlia Prado');
  await page.getByRole('textbox', { name: 'WhatsApp' }).fill('(11) 92740-8912');
  await page.getByLabel('Cidades ou bairros').fill('São Paulo · Zona Sul');
  await page
    .locator('label')
    .filter({ hasText: /^Apartamento$/ })
    .click();
  await page.getByRole('radio', { name: 'Investir' }).click();
  await expect(page.getByRole('checkbox', { name: 'Apartamento' })).toBeChecked();
  await page.getByRole('button', { name: 'Quero receber oportunidades' }).click();
  // Contact consent is required and separate from marketing.
  await expect(page.getByText('Marque a autorização para podermos falar com você.')).toBeVisible();
  await page.getByRole('checkbox', { name: /Aceito receber oportunidades de leilão/ }).click();
  await page.getByRole('button', { name: 'Quero receber oportunidades' }).click();

  await expect(page).toHaveURL(market('/leilao/confirmado'));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pronto, você está na lista.' }),
  ).toBeVisible();
  const criteria = page.getByRole('region', { name: 'Seus critérios' });
  await expect(criteria.getByText('São Paulo · Zona Sul')).toBeVisible();
  await expect(criteria.getByText('Investir')).toBeVisible();
  await expect(page.getByText('Demonstrativo')).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.parse(window.sessionStorage.getItem('casvitta.mockdb.v4') ?? '{}'),
  );
  expect(stored.interestSignups).toHaveLength(1);
  expect(stored.interestSignups[0]).toMatchObject({ kind: 'auction', status: 'pending_opt_in' });
});

test('broker signup → Anúncios, publishing blocked until the CRECI is verified', async ({
  page,
}) => {
  await page.goto(market('/para-corretores'));
  await page.getByRole('link', { name: 'Escolher Essencial' }).click();
  await expect(page).toHaveURL(/\/cadastro\/conta\?plano=essencial/);

  await page.getByLabel('Seu nome completo').fill('Bruno Lima');
  await page.getByLabel('E-mail').fill('bruno@exemplo.com.br');
  await page.getByRole('button', { name: 'Enviar link de confirmação' }).click();
  await expect(page.getByText('Confira seu e-mail')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir o link (demonstração)' }).click();

  await expect(page).toHaveURL(/\/cadastro\/creci/);
  await page.getByLabel('Número').fill('111111');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/cadastro\/whatsapp/);
  await page.getByRole('textbox', { name: 'WhatsApp' }).fill('(11) 92740-8912');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/cadastro\/plano/);
  await expect(page.getByRole('radio', { name: /^Essencial/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/cadastro\/primeiro-imovel/);
  await expect(page.getByText('CRECI-SP 111.111-F: em verificação')).toBeVisible();
  await page.getByRole('button', { name: 'Montar meu primeiro anúncio' }).click();

  await expect(page).toHaveURL(new RegExp(`app\\.localhost:${port}/anuncios/novo`));
  await expect(page.getByText('Seu CRECI está em verificação')).toBeVisible();
  // The opaque handoff id is consumed and removed from the URL; no PII in it.
  await expect(page).not.toHaveURL(/92740|bruno|Bruno/);
});

test('buyer journey pushes analytics events without personal data', async ({ page }) => {
  await page.goto(market('/'));
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Onde').fill('Vila Mariana');
  await page.getByRole('button', { name: 'Buscar imóveis' }).click();
  await expect(page).toHaveURL(/\/comprar/);
  await page.getByRole('link', { name: 'Rua Domingos de Morais · Vila Mariana' }).first().click();
  await expect(page).toHaveURL(/\/imovel\/apto-vila-mariana/);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Prazo').filter({ visible: true }).fill('300');

  const layer = await page.evaluate(
    () => (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer,
  );
  const events = layer.map((e) => e.event);
  expect(events).toEqual(
    expect.arrayContaining(['page_view', 'search', 'view_search_results', 'view_item']),
  );
  expect(events).toContain('simulate_financing');
  expect(layer.find((e) => e.event === 'view_item')).toMatchObject({
    item_id: 'apto-vila-mariana',
    value: 690_000,
    currency: 'BRL',
  });
  expect(JSON.stringify(layer)).not.toMatch(/92740|@/);
});

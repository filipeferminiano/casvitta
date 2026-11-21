import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * SEO-3 flows at 390 and 1440 px against the real API with the fabricated demo seed
 * (casvitta_e2e). Screenshots go to e2e/__screenshots__/seo/ for the visual comparison with
 * docs/mockups/seo/.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 8100);
const site = (path: string) => `http://localhost:${port}${path}`;
const ADMIN = { 'X-Admin-Token': 'e2e-admin-token' };
const WIDTHS = [390, 1440] as const;

// The viewport is set per test; run once (desktop project).
test.skip(({ isMobile }) => isMobile, 'viewports are set inside each test');

async function shot(page: Page, name: string, width: number) {
  await page.screenshot({ path: `e2e/__screenshots__/seo/${name}-${width}.png`, fullPage: true });
}

async function alerts(request: APIRequestContext) {
  const response = await request.get(`http://127.0.0.1:${apiPort}/v1/admin/property-alerts`, {
    headers: ADMIN,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    name: string;
    intent: string;
    scope: string;
    has_valuation: boolean;
    contact_consent: boolean;
  }[];
}

async function fillLead(form: ReturnType<Page['locator']>, name: string, phone: string) {
  await form.getByLabel('Nome').fill(name);
  await form.getByRole('textbox', { name: 'WhatsApp' }).fill(phone);
  await form.getByLabel('Aceito ser contatado sobre imóveis').check();
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    });

    test('valuation: submit → result → owner lead with consent', async ({ page, request }) => {
      await page.goto(site('/quanto-vale-meu-imovel/sao-paulo/vila-mariana'));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Quanto vale seu apartamento na Vila Mariana?',
        }),
      ).toBeVisible();
      await page.waitForLoadState('networkidle');
      await shot(page, 'valuation-empty', width);

      // Validation: both errors, summary focused.
      await page.getByRole('button', { name: 'Ver estimativa' }).click();
      await expect(page.getByText('Faltam 2 informações para calcular.')).toBeFocused();

      await page.getByRole('combobox', { name: 'Endereço (rua e número)' }).fill('ipes, 45');
      await page.getByRole('option', { name: /Avenida dos Ipes Ficticios, 45/ }).click();
      await page.getByLabel('Área construída (m²)').fill('68');
      await page.getByRole('button', { name: 'Ver estimativa' }).click();
      await expect(page.getByText('Estimativa de valor')).toBeVisible();
      await expect(
        page
          .getByText('Estimativa estatística a partir de preços pagos. Não é laudo de avaliação.')
          .first(),
      ).toBeVisible();
      await shot(page, 'valuation-result', width);

      const lead = page.getByRole('region', { name: 'Quer um valor exato?' });
      await fillLead(lead, `Proprietário ${width}`, '(11) 90000-0002');
      await lead.getByRole('button', { name: 'Pedir avaliação' }).click();
      await expect(page.getByText('Pronto. Seu pedido foi registrado.').first()).toBeVisible();
      const mine = (await alerts(request)).find((a) => a.name === `Proprietário ${width}`);
      expect(mine).toMatchObject({
        intent: 'own_sell',
        has_valuation: true,
        contact_consent: true,
      });
      // The address never goes into the URL.
      expect(page.url()).not.toContain('ipes');
    });

    test('ITBI: cash and SFH-financed cases', async ({ page }) => {
      await page.goto(site('/itbi/sao-paulo'));
      await expect(
        page.getByRole('heading', { level: 1, name: 'Calcule o ITBI do seu imóvel em São Paulo' }),
      ).toBeVisible();
      // Rules not reviewed yet: noindex and the review marker.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.getByText(/Texto a revisar/).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Preço de compra').fill('75000000');
      await expect(page.locator('#itbi-total')).toContainText('R$ 22.500');
      await page.getByRole('radio', { name: 'Sim' }).click();
      await page.getByLabel('Valor financiado').fill('60000000');
      await expect(page.locator('#itbi-total')).toContainText('R$ 7.500');
      await shot(page, 'itbi-financed', width);
    });

    test('neighborhood → street (/rua) → building → alert', async ({ page, request }) => {
      await page.goto(site('/preco-m2/sao-paulo/vila-mariana'));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /^Preço do m² na Vila Mariana: R\$ [\d.]+\/m² \(vendas reais de 2026\)$/,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'O que é R$/m² de área construída (IPTU)?' }).first(),
      ).toBeVisible();
      await shot(page, 'neighborhood', width);
      await page.getByRole('link', { name: 'Avenida dos Ipes Ficticios' }).first().click();
      await expect(page).toHaveURL(/\/rua\/sao-paulo\/vila-mariana\/avenida-dos-ipes-ficticios$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Avenida dos Ipes Ficticios, Vila Mariana' }),
      ).toBeVisible();
      await shot(page, 'street', width);
      await page.getByRole('link', { name: 'Condomínio Jardim Exemplo' }).first().click();
      await expect(page).toHaveURL(
        /\/condominio\/sao-paulo\/vila-mariana\/condominio-jardim-exemplo$/,
      );
      await page.waitForLoadState('networkidle');
      await shot(page, 'building', width);
      const form = page
        .locator('section')
        .filter({ hasText: 'Avise-me quando houver apartamento neste prédio' });
      await fillLead(form, `Comprador ${width}`, '(11) 90000-0003');
      await form.getByRole('button', { name: 'Criar alerta' }).click();
      await expect(page.getByText('Pronto. Seu pedido foi registrado.').first()).toBeVisible();
      const mine = (await alerts(request)).find((a) => a.name === `Comprador ${width}`);
      expect(mine).toMatchObject({ intent: 'buy', scope: 'building', contact_consent: true });
    });

    test('rental page zero state → rent alert', async ({ page, request }) => {
      await page.goto(site('/imoveis/aluguel/sao-paulo/vila-mariana'));
      await expect(
        page.getByRole('heading', { level: 1, name: /Apartamentos para alugar na Vila Mariana/ }),
      ).toBeVisible();
      await expect(
        page.getByText('Ainda não há apartamentos para alugar na Vila Mariana.'),
      ).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.getByText('CRECI-SP')).toHaveCount(0); // no cards at all
      await page.waitForLoadState('networkidle');
      await shot(page, 'rental-zero', width);
      const form = page.locator('form').filter({ hasText: 'Criar alerta' }).first();
      await fillLead(form, `Inquilino ${width}`, '(11) 90000-0004');
      await form.getByRole('button', { name: 'Criar alerta' }).click();
      await expect(page.getByText('Pronto. Seu pedido foi registrado.')).toBeVisible();
      const mine = (await alerts(request)).find((a) => a.name === `Inquilino ${width}`);
      expect(mine).toMatchObject({ intent: 'rent', contact_consent: true });
    });

    test('financing: simulation badge next to every income figure', async ({ page }) => {
      await page.goto(site('/financiamento/sao-paulo/vila-mariana'));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Quanto você precisa ganhar para comprar na Vila Mariana',
        }),
      ).toBeVisible();
      expect(await page.getByText('Simulação · não é aprovação').count()).toBeGreaterThanOrEqual(3);
      await expect(page.getByText(/aprovado/i)).toHaveCount(0);
      await shot(page, 'financing', width);
    });
  });
}

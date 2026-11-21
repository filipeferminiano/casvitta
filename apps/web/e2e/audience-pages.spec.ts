import { expect, test, type Page } from '@playwright/test';

/**
 * Audience landing pages (docs/mockups/landing-pages/): reach owners, brokers and agencies from
 * the site menus with the same header as every other page, and submit the owner start form and
 * the agency demo form, at 390 and 1440 px.
 * Screenshots for the side-by-side comparison come from `pnpm screens:capture landing-pages`.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const market = (path: string) => `http://localhost:${port}${path}`;

// Both widths are set below; run once (desktop project) instead of once per device project.
test.skip(({ isMobile }) => isMobile, 'viewports are set per describe block');

const signups = (page: Page) =>
  page.evaluate(
    () =>
      (JSON.parse(window.sessionStorage.getItem('casvitta.mockdb.v5') ?? '{}').interestSignups ??
        []) as { kind: string; criteria: Record<string, unknown>; email?: string }[],
  );

const VIEWPORTS = [
  { name: 'phone 390', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'desktop 1440', viewport: { width: 1440, height: 900 }, mobile: false },
] as const;

for (const { name, viewport, mobile } of VIEWPORTS) {
  test.describe(name, () => {
    test.use({ viewport, hasTouch: mobile });

    test('the three pages keep the site header and are reached from its menus', async ({
      page,
    }) => {
      const nav = page.getByRole('navigation', { name: 'Navegação do site' });
      /** Open a header menu (accordion on phones) and follow one of its links. */
      const follow = async (menu: string, link: string) => {
        if (mobile) await page.getByRole('button', { name: 'Abrir menu' }).click();
        await nav.getByRole('button', { name: menu }).click();
        await nav.getByRole('link', { name: link, exact: true }).click();
      };
      /** Same header as every other public page: the five menus and the broker CTA. */
      const siteHeader = async () => {
        if (mobile) {
          await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
          return;
        }
        for (const menu of ['Comprar', 'Alugar', 'Vender', 'Ferramentas', 'Para profissionais'])
          await expect(nav.getByRole('button', { name: menu })).toBeVisible();
        await expect(
          page.getByRole('banner').getByRole('link', { name: 'Começar como corretor' }),
        ).toBeVisible();
      };

      await page.goto(market('/'));
      await follow('Vender', 'Anunciar meu imóvel');
      await expect(page).toHaveURL(/\/anunciar-imovel$/);
      await expect(page).toHaveTitle('Anunciar imóvel sem mensalidade: 30 ou 90 dias | Casvitta');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Seu imóvel anunciado, sem contratar um software.',
      );
      await siteHeader();

      await follow('Para profissionais', 'Planos para corretores');
      await expect(page).toHaveURL(/\/para-corretores$/);
      await expect(page).toHaveTitle(
        'Software para corretor de imóveis com portal incluído | Casvitta',
      );
      await siteHeader();
      await expect(
        page.getByText('R$ 99', { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();

      await follow('Para profissionais', 'Imobiliárias');
      await expect(page).toHaveURL(/\/para-imobiliarias$/);
      await expect(page).toHaveTitle('Sistema para imobiliárias com portal incluído | Casvitta');
      await siteHeader();
      await expect(page.getByText('Sob consulta').filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Páginas por público' })).toHaveCount(0);
    });

    test('owner start form stores owner_listing_start and charges nothing', async ({ page }) => {
      await page.goto(market('/anunciar-imovel'));
      await page.getByRole('link', { name: 'Anunciar por 90 dias' }).click();
      await expect(page.getByText(/Período escolhido: 90 dias/)).toBeVisible();
      await page.getByRole('radio', { name: 'Alugar' }).click();
      await page.getByLabel('Cidade').fill('Campinas, SP');
      await page.getByRole('button', { name: 'Anunciar meu imóvel' }).click();
      await page.getByLabel('Seu nome').fill('Paulo Mendes');
      await page.getByLabel('Seu WhatsApp').fill('(11) 92740-8912');
      await page.getByRole('button', { name: 'Continuar no WhatsApp' }).click();
      await expect(
        page.getByText('Marque a autorização para podermos falar com você.'),
      ).toBeVisible();
      await page.getByRole('checkbox').first().check();
      await page.getByRole('button', { name: 'Continuar no WhatsApp' }).click();

      await expect(page.getByRole('status')).toContainText(
        'Vamos te chamar no WhatsApp para concluir o anúncio.',
      );
      const stored = await signups(page);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        kind: 'owner_listing_start',
        criteria: { transaction: 'rent', city: 'Campinas, SP', period_days: 90 },
      });
    });

    test('agency demo form stores agency_demo', async ({ page }) => {
      await page.goto(market('/para-imobiliarias'));
      const form = page.locator('#demonstracao');
      await form.getByLabel('Seu nome').fill('Carla Rocha');
      await form.getByLabel('Imobiliária').fill('Imobiliária Sul');
      await form.getByLabel('WhatsApp').fill('(11) 92740-8912');
      await form.getByLabel('E-mail').fill('carla@imobiliariasul.com.br');
      await form.getByText('16+', { exact: true }).click();
      await form.getByRole('checkbox').check();
      await form.getByRole('button', { name: 'Agendar demonstração' }).click();

      await expect(page.getByText('Pedido de demonstração recebido')).toBeVisible();
      const stored = await signups(page);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        kind: 'agency_demo',
        email: 'carla@imobiliariasul.com.br',
        criteria: { company: 'Imobiliária Sul', team_size: '16_plus' },
      });
    });
  });
}

import { expect, test } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);
const appUrl = (path: string) => `http://app.localhost:${port}${path}`;

test.describe('Broker OS shell (app host)', () => {
  test('opens Início from the root and navigates between sections', async ({ page, isMobile }) => {
    await page.goto(appUrl('/'));
    await expect(page).toHaveURL(appUrl('/inicio'));
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

    const nav = page.getByRole('navigation', {
      name: isMobile ? 'Navegação' : 'Navegação principal',
    });
    await nav.getByRole('link', { name: 'Leads' }).click();
    await expect(page).toHaveURL(appUrl('/leads'));
    await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByText('Leads aparecem aqui quando alguém responde a um anúncio seu.'),
    ).toBeVisible();
  });

  test('says Anúncios, never Ads Studio', async ({ page }) => {
    await page.goto(appUrl('/anuncios'));
    await expect(page.getByRole('heading', { level: 1, name: 'Anúncios' })).toBeVisible();
    await expect(page.getByText('Ads Studio')).toHaveCount(0);
  });

  test('skip link moves focus to the content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow is checked on desktop');
    await page.goto(appUrl('/agenda'));
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#content$/);
  });
});

test.describe('Public hosts', () => {
  test('marketplace home', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Imóveis à venda e para alugar' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });

  test('internal app paths on the marketplace host go to the app host', async ({ page }) => {
    await page.goto('/app/leads');
    await expect(page).toHaveURL(appUrl('/leads'));
  });

  test('broker subdomain serves the landing group', async ({ page }) => {
    await page.goto(`http://anaribeiro.localhost:${port}/apto-vila-mariana`);
    await expect(page.getByRole('heading', { name: 'Imóvel em preparação' })).toBeVisible();
  });
});

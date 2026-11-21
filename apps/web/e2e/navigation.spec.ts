import { expect, test } from '@playwright/test';

/** Header menus, mobile menu and site map (docs/mockups/navigation). */
test('desktop: Ferramentas menu leads to the ITBI calculator, Esc closes', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop header');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação do site' });
  const tools = nav.getByRole('button', { name: 'Ferramentas' });
  // Pointer moves from one open menu to another and clicks: the second one must stay open.
  await nav.getByRole('button', { name: 'Comprar' }).click();
  await tools.hover();
  await tools.click();
  await expect(tools).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(tools).toHaveAttribute('aria-expanded', 'false');
  await tools.click();
  await nav.getByRole('link', { name: 'Calcular ITBI', exact: true }).click();
  await expect(page).toHaveURL(/\/itbi\/sao-paulo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ITBI');
});

test('desktop: Comprar menu lists neighborhoods from the data', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop header');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação do site' });
  await nav.getByRole('button', { name: 'Comprar' }).click();
  await nav.getByRole('link', { name: 'Vila Mariana', exact: true }).click();
  await expect(page).toHaveURL(/\/comprar\?onde=Vila\+Mariana$/);
});

test('mobile: menu is an accordion with 44 px targets', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile drawer');
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const sell = page.getByRole('button', { name: 'Vender' });
  await sell.click();
  await expect(sell).toHaveAttribute('aria-expanded', 'true');
  const valuation = page
    .getByRole('navigation', { name: 'Navegação do site' })
    .getByRole('link', { name: 'Quanto vale meu imóvel' });
  expect((await valuation.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await valuation.click();
  await expect(page).toHaveURL(/\/quanto-vale-meu-imovel$/);
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
});

test('site map lists every section and the neighborhoods with data', async ({ page }) => {
  await page.goto('/mapa-do-site');
  await expect(page.getByRole('heading', { level: 1, name: 'Mapa do site' })).toBeVisible();
  for (const name of ['Comprar', 'Alugar', 'Vender', 'Ferramentas e preços']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  const tools = page.locator('#ferramentas');
  await expect(tools.getByRole('link', { name: 'Moema' }).first()).toHaveAttribute(
    'href',
    '/preco-m2/sao-paulo/moema',
  );
  await expect(page.locator('#quanto-preciso-ganhar')).toBeVisible();
});

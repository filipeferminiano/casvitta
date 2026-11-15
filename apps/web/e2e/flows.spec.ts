import { expect, test } from '@playwright/test';

/**
 * Behaviour wired through the mock data layer (Milestone 0.5). Each test starts with a fresh
 * browser context, so the in-memory store starts from the fixtures.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const app = (path: string) => `http://app.localhost:${port}${path}`;
const market = (path: string) => `http://localhost:${port}${path}`;

test.skip(
  ({ isMobile }) => isMobile,
  'desktop flows; phone layouts are covered by screens:capture',
);

test('Kanban "Mover para…" by keyboard updates the dashboard funnel', async ({ page }) => {
  await page.goto(app('/leads'));
  await page.getByRole('button', { name: 'Mover Lucas F. para outra etapa' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Em qualificação' }).click();
  await expect(page.getByText('Lucas F. movido para Em qualificação.')).toBeAttached();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: /^Início/ })
    .click();
  const row = page
    .locator('dl[aria-label="Funil agora"] > div')
    .filter({ hasText: 'Em qualificação' });
  await expect(row).toContainText('6');
});

test('AI draft: send it, then hand the conversation back to the AI', async ({ page }) => {
  await page.goto(app('/conversas'));
  await expect(page.getByText('Rascunho da IA · revise antes de enviar')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  const log = page.getByRole('log', { name: 'Conversa com Júlia P.' });
  await expect(log.getByText(/Oi, Júlia! Aqui é a Ana/)).toBeVisible();
  await page.getByRole('button', { name: 'Devolver para a IA' }).click();
  await expect(log.getByText('Conversa devolvida para a IA.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Assumir/ })).toBeVisible();
});

test('take over a conversation the AI is answering', async ({ page }) => {
  await page.goto(app('/conversas/conv-lucas'));
  await page.getByRole('button', { name: /Assumir/ }).click();
  await expect(page.getByText('Você assumiu a conversa. A IA parou de responder.')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Você está atendendo Lucas' }),
  ).toBeVisible();
});

test('Anúncios: blocked property, AI ad, budget, publish, live panel', async ({ page }) => {
  await page.goto(app('/anuncios/novo'));
  await expect(page.getByRole('radio', { name: /Rua Cardoso de Almeida/ })).toBeDisabled();
  await page.getByRole('radio', { name: /Rua Domingos de Morais/ }).check();
  await page.getByRole('button', { name: 'Gerar anúncio com IA' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Seu anúncio está pronto para revisar' }),
  ).toBeVisible();
  const title = page.getByLabel('Título');
  const first = await title.inputValue();
  await page.getByRole('button', { name: 'Gerar outra versão' }).click();
  await expect(title).not.toHaveValue(first);
  await page.getByRole('button', { name: 'Continuar para publicar' }).click();
  await page.getByText('R$ 50').click();
  await expect(page.getByText('R$ 700').first()).toBeVisible(); // 50 × 14 days
  await page.getByLabel('Outro valor por dia').fill('1500');
  await expect(
    page.getByText('O mínimo é R$ 20 por dia. Aumente o valor para publicar.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar agora' })).toBeDisabled();
  await page.getByText('R$ 30').first().click();
  await page.getByRole('button', { name: 'Publicar agora' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Apto Vila Mariana · 1 dia no ar/ }),
  ).toBeVisible();
});

test('"Quero ser avisado" only records interest', async ({ page }) => {
  await page.goto(app('/modulos'));
  const card = page.getByRole('article').filter({ hasText: 'Contratos' });
  await card.getByRole('button', { name: 'Quero ser avisado' }).click();
  await expect(page.getByText('Pronto, vamos te avisar.').first()).toBeVisible();
  await expect(card.getByRole('button', { name: 'Vamos te avisar' })).toBeDisabled();
});

test('buyer picks a free slot and gets the confirmation', async ({ page }) => {
  await page.goto(market('/imovel/apto-vila-mariana'));
  await expect(
    page.getByRole('heading', { name: 'Simule o financiamento' }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Agendar visita' }).filter({ visible: true }).click();
  await expect(page.getByText('Você está falando com um assistente virtual')).toBeVisible();
  await page.getByRole('group', { name: 'Horários livres' }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Visita confirmada' })).toBeVisible();
  await expect(page.getByText('Ana Ribeiro vai te receber')).toBeVisible();
});

test('every Broker OS screen supports ?state=error', async ({ page }) => {
  for (const path of [
    '/inicio',
    '/leads',
    '/conversas',
    '/agenda',
    '/propostas',
    '/modulos',
    '/anuncios',
  ]) {
    await page.goto(app(`${path}?state=error`));
    await expect(
      page.getByRole('alert').filter({ hasText: 'Não conseguimos carregar' }),
    ).toBeVisible();
  }
});

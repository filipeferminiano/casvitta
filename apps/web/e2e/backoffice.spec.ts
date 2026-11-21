import { expect, test, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test';

/**
 * Backoffice anchor flow (admin.localhost): staff signs in by email link → verifies a CRECI →
 * refers an owner request to a verified broker → reveals the owner's phone with a reason →
 * sees all three actions in the audit log. Runs against the e2e API with fake adapters.
 */

const ADMIN_TOKEN = 'e2e-admin-token';
const STAFF = 'equipe.e2e@casvitta.test';
const run = Date.now();

test.skip(({ isMobile }) => isMobile, 'The backoffice is a desktop tool (1440 px mockups).');

async function lastLink(request: APIRequestContext, to: string, pattern: RegExp): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const mails = (await (
      await request.get(`/api/v1/dev/outbox?to=${encodeURIComponent(to)}`)
    ).json()) as {
      text: string;
    }[];
    const match = mails.at(-1)?.text.match(pattern);
    if (match) return match[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

/** A broker who signed up and sent a CRECI (API only, through the web host so cookies apply). */
async function brokerWithCreci(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  name: string,
  creci: string,
): Promise<string> {
  const ctx = await playwright.request.newContext({ baseURL });
  const email = `${name.split(' ')[0]!.toLowerCase()}.${run}@exemplo.com.br`;
  await ctx.post('/api/v1/auth/email-link', { data: { intent: 'sign_up', email, name } });
  const link = await lastLink(ctx, email, /#t=[\w-]+/);
  await ctx.post('/api/v1/auth/confirm', { data: { token: link.slice(3) } });
  const r = await ctx.patch('/api/v1/me/broker-profile', {
    data: { creci_name: name, creci_number: creci, creci_state: 'SP', creci_kind: 'F' },
  });
  expect(r.ok()).toBeTruthy();
  const id = ((await r.json()) as { id: string }).id;
  await ctx.dispose();
  return id;
}

test('staff verifies a CRECI, refers an owner request and reveals a phone, all audited', async ({
  page,
  request,
  playwright,
  baseURL,
}) => {
  // Setup through the API: first Admin (script token), two brokers, one owner request.
  const boot = await request.post('/api/v1/staff/bootstrap', {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
    data: { email: STAFF, name: 'Equipe E2E' },
  });
  expect([201, 409]).toContain(boot.status());
  const pending = `Ana E2E ${run}`;
  await brokerWithCreci(playwright, baseURL!, pending, '123456');
  const verifiedName = `Bruno E2E ${run}`;
  const verifiedId = await brokerWithCreci(playwright, baseURL!, verifiedName, '654321');
  const verify = await request.post(`/api/v1/admin/brokers/${verifiedId}/creci/verify`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
  });
  expect(verify.ok()).toBeTruthy();
  const owner = `Paulo E2E ${run}`;
  const capture = await request.post('/api/v1/public/interest', {
    data: {
      kind: 'owner_listing',
      name: owner,
      phone: '(11) 91234-5678',
      email: `paulo.${run}@exemplo.com.br`,
      consents: { contact_about_properties: true, marketing: false },
      source_page: '/anunciar-imovel',
      criteria: { transaction: 'sale', cep: '04010-100', property_kind: 'apartment', bedrooms: 2 },
    },
  });
  expect(capture.status()).toBe(202);

  const admin = `http://admin.${new URL(baseURL!).host}`;

  // Sign in: signed-out visitors land on the staff sign-in page.
  await page.goto(`${admin}/equipe`);
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel('E-mail da equipe').fill(STAFF);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Confira seu e-mail')).toBeVisible();
  const signIn = await lastLink(
    request,
    STAFF,
    /http:\/\/admin\.[^\s]+\/entrar\/confirmar#t=[\w-]+/,
  );
  await page.goto(signIn);
  await expect(
    page.getByRole('heading', { level: 1, name: /(Bom dia|Boa tarde|Boa noite)/ }),
  ).toBeVisible();

  // Verify Ana's CRECI.
  await page.goto(`${admin}/creci`);
  await page.getByRole('button', { name: `Ver ${pending}` }).click();
  for (const check of [/Número existe/, /Nome no registro/, /Inscrição ativa/, /Tipo confere/]) {
    await page.getByRole('checkbox', { name: check }).click();
  }
  await page.getByRole('button', { name: 'Aprovar CRECI' }).click();
  await expect(page.getByText(`CRECI de ${pending} aprovado.`).first()).toBeVisible();

  // Refer Paulo's request to Bruno (verified) and reveal Paulo's phone.
  await page.goto(`${admin}/captacoes?tipo=owner_listing`);
  await page
    .getByRole('button', { name: /Ver pedido de Paulo/ })
    .first()
    .click();
  await page.getByRole('radio', { name: new RegExp(verifiedName) }).check();
  await page.getByRole('button', { name: `Indicar ${verifiedName}` }).click();
  await expect(page.getByText(`Pedido indicado a ${verifiedName}.`).first()).toBeVisible();
  await page.getByRole('button', { name: /Ver telefone completo de Paulo/ }).click();
  await page.getByLabel('Motivo').fill('retorno comercial');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByText('+5511912345678')).toBeVisible();

  // Everything is in the audit log, with the staff member as the actor.
  await page.goto(`${admin}/equipe`);
  const audit = page.getByRole('region', { name: 'Auditoria' });
  for (const action of ['creci.verified', 'interest.assigned', 'contact.revealed']) {
    await expect(audit.getByText(action, { exact: true }).first()).toBeVisible();
  }
  await expect(audit.getByText(/motivo: retorno comercial/).first()).toBeVisible();
});

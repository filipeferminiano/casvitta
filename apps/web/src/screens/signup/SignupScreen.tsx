'use client';

import { Button, Callout, Input, Panel, PlanCard, Select, Stepper } from '@casvitta/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { PLANS, isPlanKey, type CatalogPlan, type PlanKey } from '@/config/catalog';
import type { SignupDraft, SignupStep } from '@/domain/types';
import { isLive } from '@/lib/live';
import { track, trackBeforeNavigation } from '@/lib/analytics';
import {
  CRECI_NUMBER,
  SIGNUP_STEPS,
  currentSignup,
  openAppWithSession,
  saveCreci,
  savePlan,
  saveWhatsApp,
  startDemoSignup,
} from '@/lib/data/signup';
import { useSignupDraft } from '@/lib/data/use-signup-draft';
import { formatBRL, formatPhoneBR } from '@/lib/format';
import { USE_MOCKS } from '@/mocks/clock';

import { AccountStep, toE164 } from './AccountStep';

const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

/** App host for the handoff: app.<root> (localhost in dev). */
function appOrigin(): string {
  const { protocol, host } = window.location;
  return `${protocol}//app.${host.replace(/^www\./, '')}`;
}

/** Mockup 55: broker signup in five steps; the last one opens Anúncios on the app host. */
export function SignupScreen({ step }: { step: SignupStep }) {
  const t = useTranslations('signup');
  const tPlans = useTranslations('plans');
  const router = useRouter();
  const params = useSearchParams();
  const { ready, draft } = useSignupDraft();

  useEffect(() => {
    // ?demo=1 (mock mode) fills the account step so later steps can be reviewed directly.
    if (!isLive('accounts') && !currentSignup() && USE_MOCKS && params.get('demo') === '1') {
      startDemoSignup('Ana Paula Ribeiro', 'ana@exemplo.com.br');
    }
    // ?plano=essential from a landing or prices page; old links (?plano=corretor) mean Essencial.
    const raw = params.get('plano');
    const plan = raw === 'corretor' ? 'essential' : raw;
    if (isPlanKey(plan)) void savePlan(plan);
    track({ name: 'signup_step', step });
  }, [params, step]);

  const index = SIGNUP_STEPS.indexOf(step);
  const go = (next: SignupStep) => router.push(`/cadastro/${next}`);
  const firstName = draft?.name.split(' ')[0];

  if (ready && !draft && step !== 'conta') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Panel title={t('startFirstTitle')}>
          <p className="type-body text-fg-strong">{t('startFirstDescription')}</p>
          <Button asChild className="mt-4">
            <Link href="/cadastro/conta">{t('startFirstAction')}</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-2">
        <p className="type-body-s text-fg-muted">
          {t('progress', { n: index + 1, total: SIGNUP_STEPS.length })}
        </p>
        <h1 className="type-display-l">
          {firstName ? t('titleNamed', { name: firstName }) : t('title')}
        </h1>
      </div>
      <Stepper
        label={t('stepsLabel')}
        doneLabel={t('stepDone')}
        current={step}
        steps={SIGNUP_STEPS.map((key) => ({ key, label: t(`steps.${key}`) }))}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={t(`${stepKey(step)}.title`)} className="self-start">
          <p className="mb-5 -mt-1 type-body text-fg-strong">{t(`${stepKey(step)}.description`)}</p>
          {step === 'conta' ? (
            <AccountStep
              intent="sign_up"
              submitLabel={t('account.sendLink')}
              onDemoConfirmed={({ name, email }) => {
                startDemoSignup(name, email);
                go('creci');
              }}
            />
          ) : null}
          {step === 'creci' && draft ? (
            <CreciStep draft={draft} onDone={() => go('whatsapp')} onBack={() => go('conta')} />
          ) : null}
          {step === 'whatsapp' && draft ? (
            <WhatsAppStep draft={draft} onDone={() => go('plano')} onBack={() => go('creci')} />
          ) : null}
          {step === 'plano' && draft ? (
            <PlanStep
              initial={draft?.requestedPlan ?? 'free'}
              onDone={() => go('primeiro-imovel')}
              onBack={() => go('whatsapp')}
            />
          ) : null}
          {step === 'primeiro-imovel' && draft ? (
            <FirstPropertyStep draft={draft} onBack={() => go('plano')} />
          ) : null}
        </Panel>
        <aside className="flex flex-col gap-4">
          <Panel>
            <p className="type-caption">{t('aside.plan')}</p>
            <p className="mt-1 type-title">{tPlans(`names.${draft?.plan ?? 'free'}`)}</p>
            {draft?.requestedPlan ? (
              <p className="type-body-s text-fg-strong">
                {t('aside.requested', { plan: tPlans(`names.${draft.requestedPlan}`) })}
              </p>
            ) : null}
            <p className="mt-1 type-body-s text-fg-muted">{t('aside.change')}</p>
          </Panel>
          <Panel title={t('aside.afterTitle')}>
            <ul className="flex list-disc flex-col gap-1 pl-5 type-body-s text-fg-strong">
              <li>{t('aside.landing', { slug: slugify(draft?.name ?? 'seunome') })}</li>
              <li>{t('aside.whatsapp')}</li>
              <li>{t('aside.firstAd')}</li>
            </ul>
          </Panel>
          <p className="type-caption">{t('aside.lgpd')}</p>
        </aside>
      </div>
    </div>
  );
}

const stepKey = (step: SignupStep) =>
  step === 'primeiro-imovel' ? 'firstProperty' : step === 'conta' ? 'account' : step;

function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(' ')
    .filter((part, i, all) => i === 0 || i === all.length - 1)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

function StepActions({
  onBack,
  submitLabel,
  busy,
}: {
  onBack: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const t = useTranslations('signup');
  return (
    <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
      <Button type="button" variant="ghost" className="text-action" onClick={onBack}>
        {t('back')}
      </Button>
      <Button type="submit" loading={busy} loadingLabel={t('saving')}>
        {submitLabel}
      </Button>
    </div>
  );
}

function CreciStep({
  draft,
  onDone,
  onBack,
}: {
  draft: SignupDraft;
  onDone: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('signup.creci');
  const tSignup = useTranslations('signup');
  const [name, setName] = useState(draft.creciName ?? draft.name);
  const [number, setNumber] = useState(draft.creciNumber?.slice(0, 7) ?? '');
  const [state, setState] = useState(draft.creciState ?? 'SP');
  const [kind, setKind] = useState<'F' | 'J'>(draft.creciKind ?? 'F');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!CRECI_NUMBER.test(number.trim())) {
          setError(t('numberError'));
          return;
        }
        setBusy(true);
        const result = await saveCreci({ name, number, state, kind });
        setBusy(false);
        if (!result.ok) {
          setError(result.fields.creci_number ?? (result.message || tSignup('saveError')));
          return;
        }
        onDone();
      }}
    >
      <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Input
          label={t('number')}
          inputMode="numeric"
          placeholder="000.000"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          error={error}
        />
        <Select
          label={t('state')}
          value={state}
          onValueChange={setState}
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
        />
        <Select
          label={t('kind')}
          value={kind}
          onValueChange={(v) => setKind(v as 'F' | 'J')}
          options={[
            { value: 'F', label: t('kindF') },
            { value: 'J', label: t('kindJ') },
          ]}
        />
      </div>
      <Callout>{t('verification')}</Callout>
      <StepActions onBack={onBack} submitLabel={tSignup('continue')} busy={busy} />
    </form>
  );
}

function WhatsAppStep({
  draft,
  onDone,
  onBack,
}: {
  draft: SignupDraft;
  onDone: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('signup.whatsapp');
  const tSignup = useTranslations('signup');
  const [phone, setPhone] = useState(draft.whatsappE164 ? formatPhoneBR(draft.whatsappE164) : '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const e164 = toE164(phone);
        if (!e164) {
          setError(t('error'));
          return;
        }
        setBusy(true);
        const result = await saveWhatsApp(e164);
        setBusy(false);
        if (!result.ok) {
          setError(result.fields.whatsapp ?? (result.message || tSignup('saveError')));
          return;
        }
        onDone();
      }}
    >
      <Input
        label={t('label')}
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        help={t('help')}
        error={error}
      />
      <Callout>{t('note')}</Callout>
      <StepActions onBack={onBack} submitLabel={tSignup('continue')} busy={busy} />
    </form>
  );
}

/** Key limits shown on a plan card: only what the catalog says, nothing invented. */
function usePlanLines() {
  const tPlans = useTranslations('plans');
  return (plan: CatalogPlan): string[] => {
    const { users, active_properties, crm_contacts, ai_conversations_month } = plan.limits;
    return [
      tPlans('users', { count: users ?? 0 }),
      tPlans('properties', { count: active_properties ?? 0 }),
      crm_contacts == null
        ? tPlans('contactsUnlimited')
        : tPlans('contacts', { count: crm_contacts.toLocaleString('pt-BR') }),
      ai_conversations_month
        ? tPlans('aiConversations', { count: ai_conversations_month.toLocaleString('pt-BR') })
        : tPlans('noAutomation'),
    ];
  };
}

function PlanStep({
  initial,
  onDone,
  onBack,
}: {
  initial: PlanKey;
  onDone: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('signup.plano');
  const tSignup = useTranslations('signup');
  const tPlans = useTranslations('plans');
  const lines = usePlanLines();
  const [plan, setPlan] = useState<PlanKey>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await savePlan(plan);
        setBusy(false);
        if (!result.ok) {
          setError(result.message || tSignup('saveError'));
          return;
        }
        track({ name: 'select_plan', plan, location: 'signup' });
        onDone();
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="sr-only">{t('legend')}</legend>
        {PLANS.map((p) => {
          const key = p.key as PlanKey;
          return (
            <label
              key={key}
              className="block cursor-pointer rounded-card has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="plan"
                value={key}
                checked={plan === key}
                onChange={() => setPlan(key)}
                className="sr-only"
              />
              <PlanCard
                highlighted={plan === key}
                name={tPlans(`names.${key}`)}
                price={p.monthly_cents === 0 ? tPlans('free') : formatBRL(p.monthly_cents)}
                period={p.monthly_cents === 0 ? undefined : tPlans('perMonth')}
                pricePrefix={p.price_from ? tPlans('from') : undefined}
                features={lines(p)}
                action={
                  <span className="block text-center type-body-s font-semibold text-action">
                    {plan === key ? t('chosen') : t('choose')}
                  </span>
                }
              />
            </label>
          );
        })}
      </fieldset>
      {plan !== 'free' ? (
        <p className="type-body-s text-fg-muted">
          {tPlans('requestSent', { plan: tPlans(`names.${plan}`) })}
        </p>
      ) : null}
      {error ? <p className="type-body-s text-danger">{error}</p> : null}
      <StepActions onBack={onBack} submitLabel={tSignup('continue')} busy={busy} />
    </form>
  );
}

function FirstPropertyStep({ draft, onBack }: { draft: SignupDraft; onBack: () => void }) {
  const t = useTranslations('signup.firstProperty');
  const tPlans = useTranslations('plans');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFailed(false);
        try {
          const url = await openAppWithSession(appOrigin(), '/anuncios/novo');
          await trackBeforeNavigation({ name: 'sign_up', method: 'email', plan: draft.plan });
          window.location.assign(url);
        } catch {
          setFailed(true);
          setBusy(false);
        }
      }}
    >
      <ul className="flex flex-col gap-2 type-body-s text-fg-strong">
        <li>{t('account', { email: draft.email })}</li>
        <li>
          {draft.creciNumber
            ? t('creciPending', { state: draft.creciState ?? '', number: draft.creciNumber })
            : t('creciMissing')}
        </li>
        <li>{t('plan', { plan: tPlans(`names.${draft.requestedPlan ?? draft.plan}`) })}</li>
      </ul>
      <Callout tone="attention">{t('blocked')}</Callout>
      {failed ? <p className="type-body-s text-danger">{t('error')}</p> : null}
      <StepActions onBack={onBack} submitLabel={t('open')} busy={busy} />
    </form>
  );
}

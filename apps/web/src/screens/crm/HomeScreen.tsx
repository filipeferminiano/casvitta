'use client';

import { Button, Panel, StatTile } from '@casvitta/ui';
import { CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { useHome, type HomeData } from '@/lib/data/crm';
import { usePage } from '@/lib/data/page';
import { isLive } from '@/lib/live';

import { CrmStates } from './shared';

type StepKey = HomeData['steps'][number]['key'];

const STEP_HREF: Record<StepKey, string> = {
  creci: '/configuracoes',
  first_property: '/imoveis',
  first_publication: '/imoveis',
  profile: '/configuracoes',
  first_contact: '/contatos',
  first_reply: '/conversas',
};

/** BM6 · Início with "Primeiros passos" and the suggested next step (docs/mockups/crm/40). */
export function CrmHomeScreen() {
  const t = useTranslations('crm.home');
  const home = useHome();
  useOnboardingRedirect();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CrmStates query={home} subject={t('title')}>
        {(data) => <HomeView data={data} />}
      </CrmStates>
    </div>
  );
}

/**
 * A new broker lands on the page onboarding (docs/mockups/social/10) until the page is published,
 * the onboarding is finished or they chose "Fazer depois".
 */
function useOnboardingRedirect() {
  const social = isLive('social');
  const page = usePage(social);
  const router = useRouter();
  const p = page.data;
  const pending =
    social &&
    p !== undefined &&
    p.status === 'draft' &&
    !p.onboarding_done &&
    !p.onboarding_dismissed;
  useEffect(() => {
    if (pending) router.replace('/minha-pagina/comecar');
  }, [pending, router]);
}

function HomeView({ data }: { data: HomeData }) {
  const t = useTranslations('crm.home');
  const done = data.steps.filter((s) => s.done).length;
  const allDone = done === data.steps.length;
  return (
    <>
      <section aria-label={t('today.title')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/conversas"
          className="rounded-card focus-visible:outline-2 focus-visible:outline-focus"
        >
          <StatTile
            label={t('today.title')}
            value={t('today.handedOff', { count: data.today.handed_off })}
            attention={data.today.handed_off > 0}
          />
        </Link>
        <Link
          href="/conversas"
          className="rounded-card focus-visible:outline-2 focus-visible:outline-focus"
        >
          <StatTile
            label={t('today.title')}
            value={t('today.unread', { count: data.today.unread })}
          />
        </Link>
        <Link
          href="/agenda"
          className="rounded-card focus-visible:outline-2 focus-visible:outline-focus"
        >
          <StatTile
            label={t('today.title')}
            value={t('today.visits', { count: data.today.visits_today })}
          />
        </Link>
        <Link
          href="/contatos"
          className="rounded-card focus-visible:outline-2 focus-visible:outline-focus"
        >
          <StatTile
            label={t('today.title')}
            value={t('today.tasks', { count: data.today.tasks_due })}
          />
        </Link>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={t('steps.title')}>
          <p className="mb-3 type-body-s text-fg-muted">
            {t('steps.progress', { done, total: data.steps.length })}
          </p>
          <ol className="flex flex-col gap-3">
            {data.steps.map((s) => (
              <li key={s.key} className="flex gap-3">
                {s.done ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success"
                  />
                ) : (
                  <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                )}
                <div>
                  <p className="type-body-s font-semibold">
                    {t(`steps.${s.key}`)}
                    {s.done ? <span className="sr-only"> · {t('steps.done')}</span> : null}
                  </p>
                  {!s.done ? <p className="type-caption">{t(`steps.${s.key}Hint`)}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={t('next.title')}>
          {allDone || !data.next_step ? (
            <p className="type-body text-fg-strong">{t('next.allDone')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="type-title">{t(`steps.${data.next_step}`)}</p>
              <p className="type-body-s text-fg-muted">{t(`steps.${data.next_step}Hint`)}</p>
              <Button asChild className="self-start">
                <Link href={STEP_HREF[data.next_step]}>{t('next.open')}</Link>
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

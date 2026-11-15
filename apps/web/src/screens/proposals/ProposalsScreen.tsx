'use client';

import { Button, cn, CurrencyInput, KeyValueList, Panel, StatusPill, useToast } from '@casvitta/ui';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AiBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import { actions, useAction, useProposals } from '@/lib/data/hooks';
import { commissionPct, type PropertyProposals, type ProposalView } from '@/lib/data/proposals';
import { formatBRL, formatBRLShort, formatDayMonth } from '@/lib/format';

export function ProposalsScreen() {
  const t = useTranslations('proposals');
  const query = useProposals();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <ScreenStates
      query={query}
      subject={t('subject')}
      isEmpty={(list) => list.every((p) => p.proposals.length === 0)}
      empty={{
        icon: <FileText strokeWidth={1.6} />,
        title: t('emptyTitle'),
        description: t('emptyDescription'),
      }}
    >
      {(list) => {
        const selected =
          list.find((p) => p.property.id === selectedId) ??
          list.find((p) => p.proposals.length > 0) ??
          list[0]!;
        return (
          <div className="flex flex-col gap-6">
            <PageHeader
              breadcrumb={[t('title'), selected.property.shortName]}
              title={t('heading', { count: selected.proposals.length })}
              mobileTitle={t('title')}
              subtitle={t('subtitle')}
              demo
            />
            <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <Panel title={t('byProperty')} flush className="self-start">
                <ul className="border-t border-line">
                  {list.map((item) => {
                    const rental = item.property.transaction === 'rent';
                    const current = item.property.id === selected.property.id;
                    return (
                      <li key={item.property.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          disabled={rental}
                          aria-current={current ? 'true' : undefined}
                          onClick={() => setSelectedId(item.property.id)}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 px-4 py-3 text-left',
                            current ? 'bg-action-subtle' : 'hover:bg-canvas',
                            'disabled:cursor-default disabled:hover:bg-transparent',
                          )}
                        >
                          <span className="flex flex-col">
                            <span className="type-body-s font-semibold">
                              {item.property.shortName}
                            </span>
                            <span className="type-caption">
                              {rental
                                ? t('rentalOutside')
                                : t('openCount', { count: item.proposals.length })}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono type-body-s tabular">
                            {rental
                              ? t('perMonth', { amount: formatBRL(item.property.priceCents) })
                              : formatBRL(item.property.priceCents)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              <PropertyComparison item={selected} />
            </div>
          </div>
        );
      }}
    </ScreenStates>
  );
}

function PropertyComparison({ item }: { item: PropertyProposals }) {
  const t = useTranslations('proposals');
  const toast = useToast();
  const send = useAction(actions.sendComparison);
  const { property, proposals } = item;
  const auth = property.authorization;
  if (proposals.length === 0) {
    return (
      <Panel>
        <p className="type-body text-fg-strong">
          {t('noneForProperty', { property: property.shortName })}
        </p>
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="type-title">
          {t('propertyHeading', {
            property: property.shortName,
            price: formatBRL(property.priceCents),
          })}
        </h2>
        {auth ? (
          <p className="type-body-s text-fg-muted">
            {t('ownerLine', {
              owner: auth.ownerName,
              exclusive: String(auth.exclusive),
              until: formatDayMonth(auth.expiresAt),
            })}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {proposals.map((p, index) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            highlighted={index === 0}
            askingCents={property.priceCents}
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        {item.ownerSummary ? (
          <Panel title={t('ownerReading')} aside={<AiBadge />}>
            <p className="type-body text-fg-strong">{item.ownerSummary}</p>
            <div className="mt-4 flex flex-col items-start gap-3">
              <Button
                disabled={Boolean(item.comparisonSentAt) || send.isPending}
                onClick={() =>
                  send.mutate([property.id], {
                    onSuccess: () =>
                      toast({ title: t('sentToast', { owner: auth?.ownerName ?? '' }) }),
                  })
                }
              >
                {item.comparisonSentAt ? t('sent') : t('sendComparison')}
              </Button>
              <CounterForm proposal={proposals[0]!} />
            </div>
          </Panel>
        ) : null}
        <Panel title={t('commission.title')}>
          <KeyValueList
            className="border-t border-line"
            rows={[
              ...proposals.map((p) => ({
                key: p.id,
                label: t('commission.ifCloses', {
                  name: p.lead.person.name.split(' ')[0] ?? '',
                  pct: commissionPct,
                }),
                value: <span className="font-mono">{formatBRL(p.commissionCents)}</span>,
              })),
              {
                key: 'split',
                label: t('commission.split'),
                value: <span className="font-mono">{t('commission.none')}</span>,
              },
            ]}
          />
          <p className="mt-3 type-caption">{t('commission.note')}</p>
        </Panel>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-line-dashed p-4">
        <p className="max-w-[60ch] type-body-s text-fg-strong">
          {t.rich('contracts', { strong: (c) => <strong className="text-fg">{c}</strong> })}
        </p>
        <Button disabled>{t('generateContract')}</Button>
      </section>
    </div>
  );
}

function ProposalCard({
  proposal: p,
  highlighted,
  askingCents,
}: {
  proposal: ProposalView;
  highlighted: boolean;
  askingCents: number;
}) {
  const t = useTranslations('proposals');
  const diffPct = (p.differenceCents / askingCents) * 100;
  const sign = p.differenceCents < 0 ? '−' : '+';
  return (
    <section
      className={cn(
        'rounded-card bg-panel p-5',
        highlighted ? 'border-2 border-action' : 'border border-line',
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="type-body font-semibold">{p.lead.person.name}</h3>
        <StatusPill tone={p.status === 'countered' ? 'attention' : 'info'}>
          {t(`status.${p.status}`)}
        </StatusPill>
      </header>
      <p className="mt-3 font-mono text-[30px] leading-9 font-semibold tabular">
        {formatBRL(p.amountCents)}
      </p>
      {p.counterAmountCents ? (
        <p className="type-body-s text-attention-fg">
          {t('counterLine', { amount: formatBRL(p.counterAmountCents) })}
        </p>
      ) : null}
      <KeyValueList
        className="mt-3 border-t border-line"
        rows={[
          {
            key: 'payment',
            label: t('payment'),
            value:
              p.payment === 'cash'
                ? t('paymentCash')
                : t('paymentFinanced', {
                    down: formatBRLShort(p.downPaymentCents ?? 0),
                    fgts: String(Boolean(p.lead.qualification.usesFgts)),
                  }),
          },
          { key: 'condition', label: t('condition'), value: p.condition },
          { key: 'deadline', label: t('deadline'), value: t('days', { days: p.deadlineDays }) },
          {
            key: 'diff',
            label: t('difference'),
            value: `${sign}${formatBRL(Math.abs(p.differenceCents))} (${sign}${Math.abs(diffPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`,
          },
        ]}
      />
    </section>
  );
}

function CounterForm({ proposal }: { proposal: ProposalView }) {
  const t = useTranslations('proposals.counter');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  const register = useAction(actions.registerCounter);
  const toast = useToast();
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-3 rounded-control border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        register.mutate([proposal.id, value], {
          onSuccess: () => {
            toast({ title: t('saved', { name: proposal.lead.person.name }) });
            setOpen(false);
          },
        });
      }}
    >
      <CurrencyInput
        label={t('label', { name: proposal.lead.person.name })}
        value={value}
        onValueChange={setValue}
        help={t('help')}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={!value}>
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

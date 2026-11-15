'use client';

import {
  Badge,
  BudgetPicker,
  Callout,
  Button,
  ChannelToggle,
  Checkbox,
  Chip,
  cn,
  FinancingSimulation,
  KeyValueList,
  Panel,
  PhotoPlaceholder,
  PropertyCard,
  PropertyRow,
  SegmentedControl,
  Stepper,
  useToast,
} from '@casvitta/ui';
import { Check, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AiBadge, CreciBadge, SimulationBadge, SponsoredBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { ScreenStates } from '@/components/ScreenStates';
import type { AdChannel, ClaimSource, Property } from '@/domain/types';
import {
  BUDGET_SUGGESTIONS_CENTS,
  maxSpendCents,
  MIN_DAILY_BUDGET_CENTS,
  RECOMMENDED_BUDGET_CENTS,
  RECOMMENDED_RANGE,
  type PickerProperty,
} from '@/lib/data/ads';
import {
  actions,
  useAction,
  useAdDraft,
  useBroker,
  useDraftCreative,
  usePickerProperties,
} from '@/lib/data/hooks';
import { claimHandoff } from '@/lib/data/signup';
import { simulateSac } from '@/lib/finance';
import { formatBRL, formatBRLShort, formatDayMonth } from '@/lib/format';

export const TITLE_MAX = 40;
export const BODY_MAX = 125;
const CHANNELS: AdChannel[] = ['landing', 'marketplace', 'meta', 'google'];

/** Deep links (?imovel=) pick the property, so every step can be opened directly. */
function useDraftFromQuery() {
  const params = useSearchParams();
  const wanted = params.get('imovel');
  const draft = useAdDraft();
  const select = useAction(actions.selectProperty);
  useEffect(() => {
    if (wanted && draft.data && draft.data.propertyId !== wanted && !select.isPending)
      select.mutate([wanted]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, draft.data?.propertyId]);
  return draft;
}

type Step = 'property' | 'ad' | 'publish';

function FlowHeader({
  step,
  mobileStep,
  title,
  subtitle,
  property,
}: {
  step: Step;
  /** Phones condense the three steps into one scroll (mockup 20). */
  mobileStep?: Step;
  title: string;
  subtitle: string;
  property?: Property | null;
}) {
  const t = useTranslations('ads');
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[t('title'), t('newAd'), ...(property ? [property.shortName] : [])]}
        title={title}
        mobileTitle={t('mobileTitle')}
        mobileBack="/anuncios"
        subtitle={subtitle}
        demo
      />
      {(mobileStep && mobileStep !== step ? [step, mobileStep] : [step]).map((current, i) => (
        <Stepper
          key={current}
          className={
            mobileStep && mobileStep !== step
              ? i === 0
                ? 'max-md:hidden'
                : 'md:hidden'
              : undefined
          }
          label={t('stepsLabel')}
          doneLabel={t('stepDone')}
          current={current}
          steps={[
            { key: 'property', label: t('steps.property') },
            { key: 'ad', label: t('steps.ad') },
            { key: 'publish', label: t('steps.publish') },
          ]}
        />
      ))}
    </div>
  );
}

function propertyTitle(p: Property, t: ReturnType<typeof useTranslations<'ads'>>) {
  return `${t(`kinds.${p.kind}`)} · ${p.street}`;
}

function priceLabel(p: Property, t: ReturnType<typeof useTranslations<'ads'>>) {
  return p.transaction === 'rent'
    ? t('perMonth', { amount: formatBRL(p.priceCents) })
    : formatBRL(p.priceCents);
}

/** CLAUDE.md rule 1: publishing waits for CRECI verification. */
function CreciPendingNotice() {
  const t = useTranslations('ads.creciPending');
  const broker = useBroker().data;
  if (!broker || broker.creciVerifiedAt) return null;
  return (
    <Callout tone="attention" title={t('title')}>
      {t('body', { state: broker.creciState, number: broker.creciNumber })}
    </Callout>
  );
}

/** /cadastro hands off here with ?cadastro=<id> (mock mode, see app/api/dev/signup-handoff). */
function useSignupHandoff() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const id = params.get('cadastro');
  useEffect(() => {
    if (!id) return;
    void claimHandoff(id).then(async () => {
      await client.invalidateQueries();
      router.replace('/anuncios/novo');
    });
  }, [id, client, router]);
}

// ---------------------------------------------------------------- step 1

export function AdsStepProperty() {
  const t = useTranslations('ads');
  const router = useRouter();
  useSignupHandoff();
  const draft = useDraftFromQuery();
  const query = usePickerProperties();
  const select = useAction(actions.selectProperty);
  const [selected, setSelected] = useState<string | null>(null);
  const current = selected ?? draft.data?.propertyId ?? null;

  return (
    <div className="flex flex-col gap-6">
      <FlowHeader
        step="property"
        mobileStep={draft.data?.propertyId ? 'publish' : undefined}
        title={t('step1.title')}
        subtitle={t('step1.subtitle')}
      />
      <CreciPendingNotice />
      <ScreenStates
        query={query}
        subject={t('step1.subject')}
        isEmpty={(list) => list.length === 0}
        empty={{
          icon: <Megaphone strokeWidth={1.6} />,
          title: t('step1.emptyTitle'),
          description: t('step1.emptyDescription'),
        }}
      >
        {(list) => (
          <>
            {draft.data?.propertyId ? <MobilePublish /> : null}
            <div
              className={cn(
                'grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]',
                draft.data?.propertyId && 'max-md:hidden',
              )}
            >
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 flex w-full flex-wrap justify-between gap-2">
                  <span className="type-body font-semibold">
                    {t('step1.yourProperties', { count: list.length })}
                  </span>
                  <span className="type-body-s text-fg-muted">{t('step1.onlyAuthorized')}</span>
                </legend>
                {list.map((p) => (
                  <PickerRow
                    key={p.id}
                    property={p}
                    checked={current === p.id}
                    onSelect={() => setSelected(p.id)}
                  />
                ))}
              </fieldset>
              <Panel title={t('step1.aiUses')} className="self-start">
                <AiUsesList propertyId={current} list={list} />
                <p className="mt-4 border-t border-line pt-4 type-body-s text-fg-strong">
                  {t('step1.noInvention')}
                </p>
                <Button
                  className="mt-4 w-full"
                  disabled={!current || !list.find((p) => p.id === current)?.publishable}
                  loading={select.isPending}
                  loadingLabel={t('step1.generating')}
                  onClick={() =>
                    current &&
                    select.mutate([current], {
                      onSuccess: () => router.push('/anuncios/novo/anuncio'),
                    })
                  }
                >
                  {t('step1.generate')}
                </Button>
                <p className="mt-3 type-caption">{t('step1.nothingPublished')}</p>
              </Panel>
            </div>
          </>
        )}
      </ScreenStates>
    </div>
  );
}

function PickerRow({
  property: p,
  checked,
  onSelect,
}: {
  property: PickerProperty;
  checked: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('ads');
  const id = `pick-${p.id}`;
  return (
    <label
      htmlFor={id}
      className={cn('block', p.publishable ? 'cursor-pointer' : 'cursor-not-allowed')}
    >
      <PropertyRow
        selected={checked}
        photoCaption={t('photo')}
        control={
          <input
            id={id}
            type="radio"
            name="property"
            checked={checked}
            disabled={!p.publishable}
            onChange={onSelect}
            className="size-5 shrink-0 accent-[var(--color-action)]"
          />
        }
        title={propertyTitle(p, t)}
        details={[
          p.neighborhood,
          p.transaction === 'rent' ? t('rental') : t('bedrooms', { count: p.bedrooms }),
          `${p.areaM2} m²`,
          p.parking ? t('parking', { count: p.parking }) : null,
          t('photos', { count: p.photoCount }),
        ]
          .filter(Boolean)
          .join(' · ')}
        price={priceLabel(p, t)}
        status={
          p.authorization ? (
            <Chip tone="success">
              {t('authSigned', {
                kind: p.authorization.kind,
                date: formatDayMonth(p.authorization.signedAt),
              })}
            </Chip>
          ) : (
            <Chip tone="danger">{t('noAuth')}</Chip>
          )
        }
        footer={
          !p.publishable ? (
            <Link
              href="/imoveis"
              className="relative z-10 w-fit type-body-s font-semibold text-action underline underline-offset-2"
            >
              {t('attachAuth')}
            </Link>
          ) : null
        }
      />
    </label>
  );
}

function AiUsesList({ propertyId, list }: { propertyId: string | null; list: PickerProperty[] }) {
  const t = useTranslations('ads.step1');
  const broker = useBroker().data;
  const p = list.find((x) => x.id === propertyId);
  if (!p) return <p className="type-body-s text-fg-muted">{t('pickFirst')}</p>;
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 type-body-s text-fg-strong">
      <li>{t('usesPhotos', { count: p.photoCount, floorplan: String(p.hasFloorplan) })}</li>
      <li>{t('usesSpecs')}</li>
      <li>
        {p.nearby
          ? t('usesNearby', { place: p.nearby.label, distance: p.nearby.distanceM })
          : t('usesNeighborhood')}
      </li>
      <li>{t('usesCreci', { name: broker?.firstName ?? '' })}</li>
    </ul>
  );
}

// ---------------------------------------------------------------- step 2

const SOURCE_KEYS: Record<ClaimSource, 'record' | 'map' | 'broker'> = {
  record: 'record',
  map: 'map',
  broker: 'broker',
};

export function AdsStepAd() {
  const t = useTranslations('ads');
  const router = useRouter();
  useDraftFromQuery();
  const draft = useAdDraft().data;
  const query = useDraftCreative();
  const broker = useBroker().data;
  const update = useAction(actions.updateDraft);
  const regenerate = useAction(actions.regenerateCreative);
  const [channel, setChannel] = useState<'marketplace' | 'meta' | 'google'>('meta');

  return (
    <ScreenStates
      query={query}
      subject={t('step2.subject')}
      empty={{
        title: t('step2.noPropertyTitle'),
        description: t('step2.noPropertyDescription'),
        actions: (
          <Button asChild>
            <Link href="/anuncios/novo">{t('step2.pickProperty')}</Link>
          </Button>
        ),
      }}
    >
      {({ creative, property }) => {
        const title = draft?.editedTitle ?? creative.title;
        const body = draft?.editedBody ?? creative.body;
        const cover = t('cover', { n: draft?.coverPhoto ?? 1 });
        return (
          <div className="flex flex-col gap-6">
            <FlowHeader
              step="ad"
              title={t('step2.title')}
              subtitle={t('step2.subtitle')}
              property={property}
            />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex flex-col gap-3">
                <SegmentedControl
                  label={t('step2.previewChannel')}
                  className="self-start"
                  value={channel}
                  onValueChange={(v) => setChannel(v as typeof channel)}
                  options={[
                    { value: 'marketplace', label: t('channels.marketplace.name') },
                    { value: 'meta', label: t('channels.meta.name') },
                    { value: 'google', label: t('channels.google.name') },
                  ]}
                />
                <div className="flex justify-center rounded-card bg-subtle px-4 py-7">
                  {broker ? (
                    <AdPreview
                      channel={channel}
                      property={property}
                      title={title}
                      body={body}
                      cover={cover}
                      brokerName={broker.displayName}
                      broker={broker}
                    />
                  ) : null}
                </div>
                <p className="type-body-s text-fg-muted">{t('step2.previewNote')}</p>
              </div>
              <Panel title={t('step2.texts')} aside={<AiBadge />} className="self-start">
                <TextField
                  label={t('step2.titleLabel')}
                  value={title}
                  max={TITLE_MAX}
                  onChange={(v) => update.mutate([{ editedTitle: v }])}
                  overLabel={t('step2.tooLong', { max: TITLE_MAX })}
                />
                <TextField
                  label={t('step2.bodyLabel')}
                  value={body}
                  max={BODY_MAX}
                  multiline
                  onChange={(v) => update.mutate([{ editedBody: v }])}
                  overLabel={t('step2.tooLong', { max: BODY_MAX })}
                />
                <h3 className="mt-4 type-body-s font-semibold">{t('step2.sources')}</h3>
                <KeyValueList
                  className="border-t border-line"
                  rows={creative.sources.map((s) => ({
                    key: s.claim,
                    label: <span className="font-normal">{s.claim}</span>,
                    value: (
                      <span className="inline-flex items-center gap-1 font-normal text-success">
                        <Check aria-hidden="true" strokeWidth={2} className="size-3.5" />
                        {t(`step2.source.${SOURCE_KEYS[s.source]}`)}
                      </span>
                    ),
                  }))}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    loading={regenerate.isPending}
                    loadingLabel={t('step2.regenerating')}
                    onClick={() => regenerate.mutate([])}
                  >
                    {t('step2.regenerate')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      update.mutate([
                        { coverPhoto: ((draft?.coverPhoto ?? 1) % property.photoCount) + 1 },
                      ])
                    }
                  >
                    {t('step2.changeCover')}
                  </Button>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <Button asChild variant="ghost" className="text-action">
                    <Link href="/anuncios/novo">{t('back')}</Link>
                  </Button>
                  <Button
                    disabled={title.length > TITLE_MAX || body.length > BODY_MAX || !title.trim()}
                    onClick={() => router.push('/anuncios/novo/publicar')}
                  >
                    {t('step2.continue')}
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        );
      }}
    </ScreenStates>
  );
}

function TextField({
  label,
  value,
  max,
  multiline,
  onChange,
  overLabel,
}: {
  label: string;
  value: string;
  max: number;
  multiline?: boolean;
  onChange: (v: string) => void;
  overLabel: string;
}) {
  const id = `field-${label}`;
  const over = value.length > max;
  const classes = cn(
    'w-full rounded-control border bg-panel px-3 py-2.5 type-body text-fg focus-visible:outline-2 focus-visible:outline-focus',
    over ? 'border-danger' : 'border-line',
  );
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex justify-between">
        <label htmlFor={id} className="type-body-s font-semibold">
          {label}
        </label>
        <span
          className={cn('font-mono type-caption', over && 'text-danger')}
        >{`${value.length}/${max}`}</span>
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={over || undefined}
          className={classes}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={over || undefined}
          className={cn(classes, 'h-11')}
        />
      )}
      {over ? <p className="type-body-s text-danger">{overLabel}</p> : null}
    </div>
  );
}

/** Approximate preview per channel. The CRECI appears on the image and in the text in every format. */
export function AdPreview({
  channel,
  property,
  title,
  body,
  cover,
  brokerName,
  broker,
}: {
  channel: 'marketplace' | 'meta' | 'google';
  property: Property;
  title: string;
  body: string;
  cover: string;
  brokerName: string;
  broker: { creciState: string; creciNumber: string; displayName: string };
}) {
  const t = useTranslations('ads.preview');
  if (channel === 'marketplace') {
    return (
      <PropertyCard
        className="w-[340px]"
        photoCaption={cover}
        badges={<SponsoredBadge />}
        title={`${title}`}
        price={formatBRL(property.priceCents)}
        specs={body}
        broker={
          <>
            <span>{broker.displayName}</span>
            <CreciBadge broker={broker} />
          </>
        }
      />
    );
  }
  if (channel === 'google') {
    return (
      <div className="w-[420px] rounded-card border border-line bg-panel p-4">
        <p className="type-caption">{t('sponsored')}</p>
        <p className="font-mono text-[12px] text-fg-strong">{`anaribeiro.casvitta.com.br/${property.slug}`}</p>
        <p className="mt-1 type-title text-[19px] text-action-hover">{title}</p>
        <p className="mt-1 type-body-s text-fg-strong">{`${body} ${brokerName} · CRECI-${broker.creciState} ${broker.creciNumber}`}</p>
      </div>
    );
  }
  return (
    <article className="w-[360px] overflow-hidden rounded-card border border-line bg-panel">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span aria-hidden="true" className="size-8 rounded-pill bg-fg" />
        <div>
          <p className="type-body-s font-semibold">{t('pageName', { name: brokerName })}</p>
          <p className="type-caption">{t('sponsored')}</p>
        </div>
      </header>
      <PhotoPlaceholder caption={cover} className="aspect-square w-full">
        <span className="absolute bottom-3 left-3 rounded-chip bg-fg px-2 py-1 font-mono text-[15px] font-semibold text-white">
          {formatBRLShort(property.priceCents)}
        </span>
        <span className="absolute right-3 bottom-3">
          <CreciBadge broker={broker} className="bg-panel" />
        </span>
      </PhotoPlaceholder>
      <div className="px-3 py-3">
        <p className="type-body-s">
          <strong>{title}.</strong> {body}
        </p>
        <p className="mt-1 type-caption">{`${brokerName} · CRECI-${broker.creciState} ${broker.creciNumber}`}</p>
      </div>
      <footer className="flex items-center justify-between border-t border-line px-3 py-2.5 type-body-s">
        <span className="text-fg-muted">{t('opensWhatsapp')}</span>
        <span className="font-semibold text-action">{t('chat')}</span>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------- step 3

export function AdsStepPublish() {
  const t = useTranslations('ads');
  useDraftFromQuery();
  const draftQuery = useAdDraft();
  const query = useDraftCreative();
  return (
    <ScreenStates
      query={query}
      subject={t('step3.subject')}
      empty={{
        title: t('step2.noPropertyTitle'),
        description: t('step2.noPropertyDescription'),
        actions: (
          <Button asChild>
            <Link href="/anuncios/novo">{t('step2.pickProperty')}</Link>
          </Button>
        ),
      }}
    >
      {({ property }) =>
        draftQuery.data ? (
          <div className="flex flex-col gap-6">
            <FlowHeader
              step="publish"
              title={t('step3.title')}
              subtitle={t('step3.subtitle')}
              property={property}
            />
            <CreciPendingNotice />
            <PublishForm property={property} />
          </div>
        ) : null
      }
    </ScreenStates>
  );
}

function usePublish() {
  const t = useTranslations('ads');
  const router = useRouter();
  const toast = useToast();
  const publish = useAction(actions.publishDraft);
  return {
    publish,
    run: () =>
      publish.mutate([], {
        onSuccess: (campaignId) => {
          toast({ title: t('step3.publishedToast') });
          router.push(`/anuncios/${campaignId}`);
        },
      }),
  };
}

function BudgetExplanation({ property }: { property: Property }) {
  const t = useTranslations('ads.step3');
  return (
    <p>
      {t.rich('why', {
        amount: formatBRL(RECOMMENDED_BUDGET_CENTS),
        neighborhood: property.neighborhood,
        min: RECOMMENDED_RANGE.min,
        max: RECOMMENDED_RANGE.max,
        days: RECOMMENDED_RANGE.days,
        strong: (c) => <strong className="text-fg">{c}</strong>,
      })}
    </p>
  );
}

function PublishForm({ property }: { property: Property }) {
  const t = useTranslations('ads');
  const draft = useAdDraft().data!;
  const broker = useBroker().data;
  const update = useAction(actions.updateDraft);
  const { publish, run } = usePublish();
  const max = maxSpendCents(draft);
  const auth = property.authorization;
  const [confirmed, setConfirmed] = useState(true);
  const creciOk = Boolean(broker?.creciVerifiedAt);
  const valid =
    creciOk &&
    draft.dailyBudgetCents >= MIN_DAILY_BUDGET_CENTS &&
    draft.channels.length > 0 &&
    confirmed;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Panel title={t('step3.where')}>
          <div className="flex flex-col gap-3">
            {CHANNELS.map((c) => (
              <ChannelToggle
                key={c}
                name={t(`channels.${c}.name`)}
                description={
                  c === 'landing'
                    ? t('channels.landing.description', {
                        url: `${broker?.slug ?? ''}.casvitta.com.br/${property.slug}`,
                      })
                    : t(`channels.${c}.description`, { neighborhood: property.neighborhood })
                }
                costNote={c === 'landing' || c === 'marketplace' ? t('included') : t('fromBudget')}
                checked={draft.channels.includes(c)}
                onCheckedChange={(on) =>
                  update.mutate([
                    {
                      channels: on ? [...draft.channels, c] : draft.channels.filter((x) => x !== c),
                    },
                  ])
                }
              />
            ))}
          </div>
        </Panel>
        <Panel title={t('step3.howMuch')}>
          <BudgetPicker
            label={t('step3.howMuch')}
            value={draft.dailyBudgetCents}
            onChange={(cents) => update.mutate([{ dailyBudgetCents: cents }])}
            suggestions={[...BUDGET_SUGGESTIONS_CENTS]}
            recommended={RECOMMENDED_BUDGET_CENTS}
            minimum={MIN_DAILY_BUDGET_CENTS}
            format={(c) => formatBRL(c)}
            copy={{
              perDay: t('step3.perDay'),
              recommended: t('step3.recommended'),
              other: t('step3.other'),
              otherHelp: t('step3.otherHelp', { min: formatBRL(MIN_DAILY_BUDGET_CENTS) }),
              belowMinimum: t('step3.belowMinimum', { min: formatBRL(MIN_DAILY_BUDGET_CENTS) }),
            }}
            explanation={<BudgetExplanation property={property} />}
            footer={
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="type-caption">{t('step3.duration')}</dt>
                  <dd className="type-body-s font-semibold">
                    {t('step3.days', { days: draft.durationDays })}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption">{t('step3.region')}</dt>
                  <dd className="type-body-s font-semibold">
                    {t('step3.regionValue', { neighborhood: property.neighborhood })}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption">{t('step3.maxSpend')}</dt>
                  <dd className="font-mono type-body-s font-semibold">{formatBRL(max)}</dd>
                </div>
              </dl>
            }
          />
        </Panel>
      </div>
      <Panel title={t('step3.summary')} className="self-start">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <PhotoPlaceholder
            caption={t('photo')}
            className="h-14 w-18 shrink-0 rounded-chip text-[11px]"
          />
          <div>
            <p className="type-body-s font-semibold">{property.shortName}</p>
            <p className="font-mono type-body-s">{formatBRL(property.priceCents)}</p>
          </div>
        </div>
        <KeyValueList
          rows={[
            {
              key: 'channels',
              label: t('step3.channelsCount'),
              value: <span className="font-mono">{draft.channels.length}</span>,
            },
            {
              key: 'perDay',
              label: t('step3.perDayLabel'),
              value: <span className="font-mono">{formatBRL(draft.dailyBudgetCents)}</span>,
            },
            {
              key: 'duration',
              label: t('step3.duration'),
              value: (
                <span className="font-mono">{t('step3.days', { days: draft.durationDays })}</span>
              ),
            },
            {
              key: 'max',
              label: t('step3.maxSpend'),
              value: <span className="font-mono">{formatBRL(max)}</span>,
            },
            {
              key: 'pause',
              label: t('step3.canPause'),
              value: <span className="font-mono">{t('step3.anytime')}</span>,
            },
          ]}
        />
        {auth ? (
          <Checkbox
            className="mt-2"
            label={t('step3.authConfirm', { kind: auth.kind, date: formatDayMonth(auth.signedAt) })}
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
          />
        ) : null}
        {broker ? (
          <Checkbox
            label={t('step3.creciShown', { state: broker.creciState, number: broker.creciNumber })}
            checked
            disabled
          />
        ) : null}
        <Button
          className="mt-3 w-full"
          disabled={!valid}
          loading={publish.isPending}
          loadingLabel={t('step3.publishing')}
          onClick={run}
        >
          {t('step3.publish')}
        </Button>
        {!creciOk ? (
          <p className="mt-2 type-body-s text-attention-fg">{t('creciPending.publishBlocked')}</p>
        ) : null}
        {publish.isError ? (
          <p className="mt-2 type-body-s text-danger">{t('step3.publishError')}</p>
        ) : null}
        <p className="mt-3 type-caption">{t('step3.billing', { max: formatBRL(max) })}</p>
      </Panel>
    </div>
  );
}

/** Phone (mockup 20): the three steps condensed in one scroll once a property is picked. */
function MobilePublish() {
  const t = useTranslations('ads');
  const draft = useAdDraft().data;
  const creative = useDraftCreative().data;
  const broker = useBroker().data;
  const update = useAction(actions.updateDraft);
  const { publish, run } = usePublish();
  if (!draft || !creative || !broker) return null;
  const { property } = creative;
  const max = maxSpendCents(draft);
  const title = draft.editedTitle ?? creative.creative.title;
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <section className="overflow-hidden rounded-card border border-line bg-panel">
        <PhotoPlaceholder caption={t('cover', { n: draft.coverPhoto })} className="h-44 w-full">
          <span className="absolute right-2 bottom-2">
            <CreciBadge broker={broker} className="bg-panel" />
          </span>
        </PhotoPlaceholder>
        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="type-body font-semibold">{title}</p>
            <Badge variant="ai">{t('aiShort')}</Badge>
          </div>
          <p className="type-body-s text-fg-muted">
            {`${property.neighborhood} · ${property.areaM2} m² · `}
            <span className="font-mono">{formatBRL(property.priceCents)}</span>
          </p>
          <Link
            href="/anuncios/novo/anuncio"
            className="w-fit type-body-s font-semibold text-action underline underline-offset-2"
          >
            {t('editText')}
          </Link>
        </div>
      </section>
      <Panel title={t('step3.howMuchShort')}>
        <BudgetPicker
          label={t('step3.howMuchShort')}
          value={draft.dailyBudgetCents}
          onChange={(cents) => update.mutate([{ dailyBudgetCents: cents }])}
          suggestions={[...BUDGET_SUGGESTIONS_CENTS]}
          recommended={RECOMMENDED_BUDGET_CENTS}
          minimum={MIN_DAILY_BUDGET_CENTS}
          format={(c) => formatBRL(c)}
          copy={{
            perDay: t('step3.perDay'),
            recommended: t('step3.recommended'),
            other: t('step3.other'),
            otherHelp: t('step3.otherHelp', { min: formatBRL(MIN_DAILY_BUDGET_CENTS) }),
            belowMinimum: t('step3.belowMinimum', { min: formatBRL(MIN_DAILY_BUDGET_CENTS) }),
          }}
          explanation={t('step3.whyShort', {
            amount: formatBRL(RECOMMENDED_BUDGET_CENTS),
            min: RECOMMENDED_RANGE.min,
            max: RECOMMENDED_RANGE.max,
            days: RECOMMENDED_RANGE.days,
          })}
        />
      </Panel>
      <Panel>
        <KeyValueList
          rows={[
            { key: 'channels', label: t('step3.channelsLabel'), value: t('step3.channelsList') },
            {
              key: 'duration',
              label: t('step3.durationMax'),
              value: (
                <span className="font-mono">{`${t('step3.days', { days: draft.durationDays })} · ${formatBRL(max)}`}</span>
              ),
            },
            {
              key: 'auth',
              label: t('step3.authLabel'),
              value: (
                <span className="inline-flex items-center gap-1 text-success">
                  <Check aria-hidden="true" strokeWidth={2} className="size-4" />
                  {t('step3.signed')}
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <Button
        className="w-full"
        disabled={draft.dailyBudgetCents < MIN_DAILY_BUDGET_CENTS || !broker.creciVerifiedAt}
        loading={publish.isPending}
        loadingLabel={t('step3.publishing')}
        onClick={run}
      >
        {t('step3.publish')}
      </Button>
    </div>
  );
}

/** Small simulation box reused by marketplace and landing pages. */
export function SimulationBox({
  priceCents,
  compact = false,
}: {
  priceCents: number;
  compact?: boolean;
}) {
  const t = useTranslations('listing.simulation');
  const sim = simulateSac({ priceCents, downPaymentCents: Math.round(priceCents * 0.2) });
  return (
    <FinancingSimulation
      title={t('title')}
      badge={<SimulationBadge />}
      result={t('perMonth', {
        amount: formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100),
      })}
      details={t('details', { term: sim.termMonths })}
      className={compact ? 'p-4' : undefined}
    />
  );
}

'use client';

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  formatBRL,
  formatDate,
  formatTime,
  useToast,
  type DataTableColumn,
} from '@casvitta/ui';
import { BackofficePageHeader, Dialog, QueueTable, Textarea } from '@casvitta/ui/backoffice';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  can,
  revealContact,
  useAlertGroups,
  useAssignCapture,
  useCandidates,
  useCapture,
  useCaptures,
  useExportCaptures,
  useMarkHandled,
  useStaffMe,
  type AlertGroup,
  type CaptureFilters,
  type CaptureItem,
  type CaptureState,
  type InterestKind,
} from '@/lib/data/staff';
import { StaffApiError } from '@/lib/staff-api';

import { formatToday } from './format';
import { isReauthCancelled, useSensitive } from './ReauthProvider';

/** Tab order follows the mockup (auctions first). */
export const KINDS: InterestKind[] = [
  'auction',
  'owner_listing',
  'owner_listing_start',
  'investor_institutional',
  'agency',
  'agency_demo',
  'developer',
  'rental_admin',
];
const ALERTS = 'alerts';
const OWNER_KINDS: InterestKind[] = ['owner_listing'];
const STATE_PARAM: Record<string, CaptureState> = {
  'sem-corretor': 'no_broker',
  indicado: 'referred',
  aceito: 'accepted',
  aberto: 'open',
  tratado: 'handled',
};

function isKind(value: string | null): value is InterestKind {
  return value !== null && (KINDS as string[]).includes(value);
}

/** BO3 · Captações (docs/mockups/backoffice/03-leads-intake). */
export function CapturesScreen() {
  const t = useTranslations('backoffice.captures');
  const tKinds = useTranslations('backoffice.kinds');
  const router = useRouter();
  const params = useSearchParams();
  const tipo = params.get('tipo');
  const tab = tipo === ALERTS ? ALERTS : isKind(tipo) ? tipo : 'auction';
  const kind: InterestKind = tab === ALERTS ? 'auction' : tab;
  const stateParam = params.get('status');
  const [filters, setFilters] = useState<Omit<CaptureFilters, 'kind'>>({
    state: stateParam ? STATE_PARAM[stateParam] : undefined,
  });
  const full: CaptureFilters = { kind, ...filters };
  const captures = useCaptures(full);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('pedido'));

  const setTab = (next: string) => {
    setSelectedId(null);
    setFilters({});
    router.replace(`/captacoes?tipo=${next}`);
  };

  return (
    <>
      <BackofficePageHeader
        date={formatToday()}
        title={t('title')}
        description={t('description')}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('title')} className="mb-4">
          {KINDS.map((k) => (
            <TabsTrigger key={k} value={k} count={captures.data?.counts[k]}>
              {tKinds(k)}
            </TabsTrigger>
          ))}
          <TabsTrigger value={ALERTS}>{t('alertsTab')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === ALERTS ? (
        <AlertsPanel />
      ) : (
        <KindView
          kind={kind}
          filters={full}
          onFilters={setFilters}
          query={captures}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </>
  );
}

function KindView({
  kind,
  filters,
  onFilters,
  query,
  selectedId,
  onSelect,
}: {
  kind: InterestKind;
  filters: CaptureFilters;
  onFilters: (f: Omit<CaptureFilters, 'kind'>) => void;
  query: ReturnType<typeof useCaptures>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('backoffice.captures');
  const tStates = useTranslations('backoffice.states');
  const me = useStaffMe().data;
  const sensitive = useSensitive();
  const exporter = useExportCaptures();
  const toast = useToast();
  const owner = OWNER_KINDS.includes(kind);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const [region, setRegion] = useState(filters.region ?? '');
  const origins = useMemo(
    () => [...new Set(items.map((i) => i.utm_source).filter((s): s is string => !!s))],
    [items],
  );

  // Region filter applies after a pause in typing.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((filters.region ?? '') !== region) onFilters({ ...filters, region: region || undefined });
    }, 400);
    return () => clearTimeout(id);
  }, [region, filters, onFilters]);

  const stateOptions: CaptureState[] = owner
    ? ['no_broker', 'referred', 'accepted']
    : ['open', 'handled'];

  const runExport = async () => {
    try {
      await sensitive(() => exporter.mutateAsync(filters));
      toast({ title: t('exported'), tone: 'success' });
    } catch (e) {
      if (!isReauthCancelled(e)) toast({ title: t('errors.generic') });
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label={t('filters.state')}
          className="w-44"
          options={[
            { value: 'all', label: t('filters.all') },
            ...stateOptions.map((s) => ({ value: s, label: t(`filters.states.${s}`) })),
          ]}
          value={filters.state ?? 'all'}
          onValueChange={(v) =>
            onFilters({ ...filters, state: v === 'all' ? undefined : (v as CaptureState) })
          }
        />
        <Input
          label={t('filters.region')}
          className="w-56"
          placeholder={t('filters.regionPlaceholder')}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
        <Select
          label={t('filters.origin')}
          className="w-44"
          options={[
            { value: 'all', label: t('filters.all') },
            { value: 'direct', label: t('filters.direct') },
            ...origins.map((o) => ({ value: o, label: o })),
          ]}
          value={filters.origin ?? 'all'}
          onValueChange={(v) => onFilters({ ...filters, origin: v === 'all' ? undefined : v })}
        />
        <Select
          label={t('filters.optIn')}
          className="w-44"
          options={[
            { value: 'all', label: t('filters.all') },
            { value: 'confirmed', label: t('filters.optIns.confirmed') },
            { value: 'pending', label: t('filters.optIns.pending') },
          ]}
          value={filters.optIn ?? 'all'}
          onValueChange={(v) =>
            onFilters({
              ...filters,
              optIn: v === 'all' ? undefined : (v as 'confirmed' | 'pending'),
            })
          }
        />
        {can(me, 'contacts.export') ? (
          <Button
            variant="secondary"
            className="ml-auto"
            loading={exporter.isPending}
            loadingLabel={t('exporting')}
            onClick={runExport}
          >
            {t('export')}
          </Button>
        ) : null}
      </div>
      {query.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('subject') })} />
      ) : query.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('subject') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => query.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <CaptureTable
              items={items}
              selectedId={selected?.id ?? null}
              onSelect={(i) => onSelect(i.id)}
            />
            {items.length ? <p className="mt-3 type-caption">{t('footnote')}</p> : null}
          </div>
          {selected ? <CaptureDetail key={selected.id} id={selected.id} /> : null}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ formatting

export function useWants() {
  const t = useTranslations('backoffice.captures');
  return (item: Pick<CaptureItem, 'kind' | 'criteria' | 'region'>): string => {
    const c = item.criteria as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof c.transaction === 'string') parts.push(t(`transaction.${c.transaction}`));
    if (typeof c.property_kind === 'string') {
      const kind = t(`propertyKind.${c.property_kind}`);
      parts.push(
        typeof c.bedrooms === 'number' ? `${kind} ${t('bedrooms', { count: c.bedrooms })}` : kind,
      );
    }
    if (typeof c.area_m2 === 'number') parts.push(t('area', { area: c.area_m2 }));
    if (typeof c.company === 'string') parts.push(c.company);
    if (typeof c.period_days === 'number') parts.push(t('days', { days: c.period_days }));
    if (item.region && item.kind !== 'owner_listing') parts.push(item.region);
    return parts.join(' · ');
  };
}

function useOrigin() {
  const t = useTranslations('backoffice.captures');
  return (item: CaptureItem): string =>
    item.utm_source
      ? item.utm_medium
        ? t('originOf', { source: item.utm_source, medium: item.utm_medium })
        : item.utm_source
      : t('originDirect');
}

function StatePill({ item }: { item: CaptureItem }) {
  const t = useTranslations('backoffice.captures.state');
  const broker = item.broker_name ?? '';
  switch (item.state) {
    case 'no_broker':
      return <StatusPill tone="attention">{t('no_broker')}</StatusPill>;
    case 'referred':
      return <StatusPill tone="info">{t('referred', { broker })}</StatusPill>;
    case 'accepted':
      return <StatusPill tone="success">{t('accepted', { broker })}</StatusPill>;
    case 'open':
      return <StatusPill tone="attention">{t('open')}</StatusPill>;
    case 'handled':
      return <StatusPill tone="neutral">{t('handled')}</StatusPill>;
  }
}

function OptInPill({ item }: { item: CaptureItem }) {
  const t = useTranslations('backoffice.captures.optIn');
  const tone =
    item.opt_in === 'confirmed' ? 'success' : item.opt_in === 'unsubscribed' ? 'danger' : 'neutral';
  return <StatusPill tone={tone}>{t(item.opt_in)}</StatusPill>;
}

function shortName(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : name;
}

function CaptureTable({
  items,
  selectedId,
  onSelect,
}: {
  items: CaptureItem[];
  selectedId: string | null;
  onSelect: (item: CaptureItem) => void;
}) {
  const t = useTranslations('backoffice.captures');
  const tShell = useTranslations('backoffice.shell');
  const wants = useWants();
  const origin = useOrigin();
  return (
    <QueueTable
      caption={t('title')}
      rows={items}
      rowKey={(i) => i.id}
      selectedKey={selectedId}
      onSelect={onSelect}
      selectLabel={(i) => t('select', { name: shortName(i.name) })}
      primary={{
        key: 'person',
        header: t('columns.person'),
        cell: (i) => (
          <>
            <span className="font-semibold text-fg">{shortName(i.name)}</span>
            <span className="font-mono type-caption">{i.phone}</span>
            {i.is_demo ? (
              <Badge variant="demo" className="mt-0.5">
                {tShell('demo')}
              </Badge>
            ) : null}
          </>
        ),
      }}
      columns={[
        { key: 'wants', header: t('columns.wants'), cell: (i) => wants(i) },
        { key: 'origin', header: t('columns.origin'), cell: (i) => origin(i) },
        { key: 'whatsapp', header: t('columns.whatsapp'), cell: (i) => <OptInPill item={i} /> },
        { key: 'status', header: t('columns.status'), cell: (i) => <StatePill item={i} /> },
      ]}
      empty={<EmptyState title={t('empty')} />}
    />
  );
}

// ------------------------------------------------------------------ detail

function CaptureDetail({ id }: { id: string }) {
  const t = useTranslations('backoffice.captures.detail');
  const tStates = useTranslations('backoffice.states');
  const tCaptures = useTranslations('backoffice.captures');
  const me = useStaffMe().data;
  const capture = useCapture(id);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (capture.data && !document.activeElement?.closest('table')) heading.current?.focus();
  }, [capture.data]);

  if (capture.isPending) {
    return <LoadingState title={tStates('loading', { subject: tCaptures('subject') })} />;
  }
  if (capture.isError) {
    return (
      <ErrorState
        title={tStates('errorTitle', { subject: tCaptures('subject') })}
        stillWorks={tStates('errorStillWorks')}
        howToFix={tStates('errorHowToFix')}
        primaryAction={<Button onClick={() => capture.refetch()}>{tStates('retry')}</Button>}
      />
    );
  }
  const item = capture.data;
  const c = item.criteria as Record<string, unknown>;
  const owner = OWNER_KINDS.includes(item.kind);
  const created = new Date(item.created_at);
  const title =
    owner && typeof c.transaction === 'string'
      ? t('titleOwner', { name: shortName(item.name), verb: t(`verb.${c.transaction}`) })
      : item.name;

  return (
    <Panel aria-labelledby={headingId}>
      <h2
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="type-title text-[22px] focus:outline-none"
      >
        {title}
      </h2>
      <p className="type-body-s text-fg-muted">
        {t('requested', { date: formatDate(created).slice(0, 5), time: formatTime(created) })}
        {item.source_page ? ` · ${item.source_page}` : ''}
      </p>
      <CriteriaList item={item} />
      <ContactRow item={item} field="phone" />
      <ContactRow item={item} field="email" />
      {owner ? (
        <ReferSection item={item} allowed={can(me, 'captures.handle')} />
      ) : (
        <HandleSection item={item} allowed={can(me, 'captures.handle')} />
      )}
    </Panel>
  );
}

function CriteriaList({ item }: { item: CaptureItem }) {
  const t = useTranslations('backoffice.captures');
  const wants = useWants();
  const origin = useOrigin();
  const c = item.criteria as Record<string, unknown>;
  const rows: [string, string][] = [];
  if (item.kind === 'owner_listing') {
    rows.push([t('detail.property'), wants({ ...item, region: null })]);
    if (typeof c.cep === 'string')
      rows.push([t('detail.cep'), `${c.cep.slice(0, 5)}-${c.cep.slice(5)}`]);
    if (typeof c.expected_price_cents === 'number') {
      rows.push([t('detail.price'), formatBRL(c.expected_price_cents)]);
    }
  } else {
    rows.push([t('detail.criteria'), wants(item) || '—']);
    if (item.region) rows.push([t('detail.region'), item.region]);
  }
  rows.push([
    t('detail.consent'),
    item.contact_consent ? t('detail.consentYes') : t('detail.consentNo'),
  ]);
  rows.push([t('detail.origin'), origin(item)]);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="type-caption">{label}</dt>
          <dd className="type-body-s font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ContactRow({ item, field }: { item: CaptureItem; field: 'phone' | 'email' }) {
  const t = useTranslations('backoffice.captures');
  const me = useStaffMe().data;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null | undefined>(undefined);
  const masked = field === 'phone' ? item.phone : item.email;
  if (!masked) return null;
  const label = t(`reveal.fields.${field}`);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
      <div>
        <p className="type-caption">{t(`detail.${field}`)}</p>
        <p className="font-mono type-body-s font-semibold">
          {value === undefined ? masked : (value ?? t('reveal.none'))}
        </p>
      </div>
      {value === undefined && can(me, 'contacts.reveal') ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-action"
          aria-label={t('detail.revealLabel', { field: label, name: item.name })}
          onClick={() => setOpen(true)}
        >
          {t('detail.reveal')}
        </Button>
      ) : null}
      {open ? (
        <RevealDialog
          id={item.id}
          field={field}
          onClose={() => setOpen(false)}
          onShown={(v) => {
            setValue(v);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function RevealDialog({
  id,
  field,
  onClose,
  onShown,
}: {
  id: string;
  field: 'phone' | 'email';
  onClose: () => void;
  onShown: (value: string | null) => void;
}) {
  const t = useTranslations('backoffice.captures.reveal');
  const sensitive = useSensitive();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const out = await sensitive(() => revealContact(id, field, reason.trim()));
      onShown(out.value ?? null);
    } catch (e) {
      if (isReauthCancelled(e)) onClose();
      else setError(e instanceof StaffApiError ? e.message : '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('title', { field: t(`fields.${field}`) })}
      description={t('description')}
      closeLabel={t('close')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Textarea
          label={t('reason')}
          help={t('reasonHelp')}
          required
          minLength={5}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={reason.trim().length < 5}
            loading={busy}
            loadingLabel={t('showing')}
          >
            {t('show')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReferSection({ item, allowed }: { item: CaptureItem; allowed: boolean }) {
  const t = useTranslations('backoffice.captures');
  const toast = useToast();
  const assign = useAssignCapture();
  const blocked = !item.contact_consent || item.opt_in === 'unsubscribed';
  const candidates = useCandidates(item.id, allowed && !blocked && item.state !== 'accepted');
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const radioName = useId();
  const list = candidates.data ?? [];
  const picked = list.find((c) => c.id === choice) ?? list[0] ?? null;
  const expires = item.assignment_expires_at ? new Date(item.assignment_expires_at) : null;

  const refer = async () => {
    if (!picked) return;
    setError(null);
    try {
      await assign.mutateAsync({ id: item.id, brokerId: picked.id });
      toast({ title: t('done.referred', { name: picked.name }), tone: 'success' });
    } catch (e) {
      const code = e instanceof StaffApiError ? e.code : '';
      setError(
        ['broker_not_verified', 'no_contact_consent', 'already_accepted'].includes(code)
          ? t(`errors.${code}`)
          : t('errors.generic'),
      );
    }
  };

  return (
    <section className="mt-4 border-t border-line pt-4">
      <h3 className="type-body font-semibold">{t('detail.referTitle')}</h3>
      {item.state === 'accepted' ? (
        <p className="mt-2 type-body-s">
          {t('detail.accepted', { broker: item.broker_name ?? '' })}
        </p>
      ) : blocked ? (
        <p className="mt-2 type-body-s text-danger">{t('detail.noConsent')}</p>
      ) : !allowed ? (
        <p className="mt-2 type-body-s text-fg-muted">{t('detail.noPermission')}</p>
      ) : (
        <>
          {item.state === 'referred' && expires ? (
            <p className="mt-2 rounded-control bg-action-subtle p-2 type-body-s">
              {t('detail.referredUntil', {
                broker: item.broker_name ?? '',
                date: formatDate(expires).slice(0, 5),
                time: formatTime(expires),
              })}
            </p>
          ) : null}
          <p className="mt-1 type-caption">{t('detail.referHelp')}</p>
          {candidates.isPending ? (
            <LoadingState title={t('detail.referring')} rows={2} />
          ) : list.length === 0 ? (
            <p className="mt-3 type-body-s text-fg-muted">{t('detail.noCandidates')}</p>
          ) : (
            <fieldset className="mt-2">
              <legend className="sr-only">{t('detail.candidatesLabel')}</legend>
              {list.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-line py-3 last:border-b-0"
                >
                  <input
                    type="radio"
                    name={radioName}
                    value={c.id}
                    checked={picked?.id === c.id}
                    onChange={() => setChoice(c.id)}
                    className="mt-1 size-5 accent-action"
                  />
                  <span className="flex flex-col">
                    <span className="type-body-s font-semibold">{c.name}</span>
                    <span className="type-caption">
                      {[
                        c.creci,
                        c.regions.join(', '),
                        t('detail.openRequests', { count: c.open_requests }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {c.region_match ? (
                      <span className="mt-1">
                        <StatusPill tone="success">{t('detail.regionMatch')}</StatusPill>
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {picked ? (
            <Button
              className="mt-3 w-full"
              loading={assign.isPending}
              loadingLabel={t('detail.referring')}
              onClick={refer}
            >
              {t('detail.refer', { name: picked.name })}
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 type-body-s text-danger">
              {error}
            </p>
          ) : null}
          <p className="mt-3 type-caption">{t('detail.referNote')}</p>
        </>
      )}
    </section>
  );
}

function HandleSection({ item, allowed }: { item: CaptureItem; allowed: boolean }) {
  const t = useTranslations('backoffice.captures');
  const toast = useToast();
  const mark = useMarkHandled();
  if (!allowed) {
    return (
      <p className="mt-4 border-t border-line pt-4 type-body-s text-fg-muted">
        {t('detail.noPermission')}
      </p>
    );
  }
  const handled = item.state === 'handled';
  return (
    <div className="mt-4 border-t border-line pt-4">
      <Button
        variant={handled ? 'secondary' : 'primary'}
        className="w-full"
        loading={mark.isPending}
        onClick={async () => {
          await mark.mutateAsync({ id: item.id, handled: !handled });
          toast({ title: t(handled ? 'done.reopened' : 'done.handled'), tone: 'success' });
        }}
      >
        {handled ? t('detail.reopen') : t('detail.markHandled')}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ alerts from SEO pages

function AlertsPanel() {
  const t = useTranslations('backoffice.captures.alerts');
  const tStates = useTranslations('backoffice.states');
  const groups = useAlertGroups(true);
  const columns: DataTableColumn<AlertGroup>[] = [
    {
      key: 'place',
      header: t('columns.place'),
      cell: (g) => (
        <a
          href={g.scope_path}
          target="_blank"
          rel="noopener noreferrer"
          className="text-action underline"
        >
          {g.scope_name}
        </a>
      ),
    },
    { key: 'scope', header: t('columns.scope'), cell: (g) => t(`scope.${g.scope}`) },
    { key: 'intent', header: t('columns.intent'), cell: (g) => t(`intent.${g.intent}`) },
    { key: 'active', header: t('columns.active'), numeric: true, cell: (g) => g.active },
    {
      key: 'last',
      header: t('columns.last'),
      cell: (g) => formatDate(new Date(g.last_at)),
    },
  ];
  return (
    <Panel title={t('title')}>
      <p className="mb-4 type-body-s text-fg-muted">{t('description')}</p>
      {groups.isPending ? (
        <LoadingState title={tStates('loading', { subject: t('title') })} />
      ) : groups.isError ? (
        <ErrorState
          title={tStates('errorTitle', { subject: t('title') })}
          stillWorks={tStates('errorStillWorks')}
          howToFix={tStates('errorHowToFix')}
          primaryAction={<Button onClick={() => groups.refetch()}>{tStates('retry')}</Button>}
        />
      ) : (
        <DataTable
          caption={t('title')}
          columns={columns}
          rows={groups.data}
          rowKey={(g) => `${g.scope}-${g.scope_path}-${g.intent}`}
          empty={<EmptyState title={t('empty')} />}
        />
      )}
    </Panel>
  );
}

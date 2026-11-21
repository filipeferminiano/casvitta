'use client';

import {
  AddressAutocomplete,
  Button,
  ComparableGroupList,
  Input,
  SegmentedControl,
  ValueRangeResult,
  type AddressSuggestion,
} from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { AddressSuggestionOut, ValuationOut } from '@/lib/data/market';
import { api } from '@/lib/api';
import { formatBRL, formatBRLShort } from '@/lib/format';
import { formatPriceM2 } from '@/lib/market-format';

import { FinancingSimulator } from '@/screens/marketplace/ListingIslands';

import { AlertForm } from './AlertForm';

type Selected = { neighborhood: string; street: string; number: number | null; label: string };
type Status = 'idle' | 'loading' | 'suggestions' | 'not_found' | 'outside_coverage';

/**
 * 01 · the estimate runs in the browser after submit: the address is never in the URL and a
 * result is never indexed. Bedrooms and parking go to the lead only (ITBI has no such data).
 */
export function ValuationTool({ city, initial }: { city: string; initial?: Selected | null }) {
  const t = useTranslations('market.valuation.tool');
  const tSim = useTranslations('market.simulator');
  const [query, setQuery] = useState(initial?.label ?? '');
  const [suggestions, setSuggestions] = useState<AddressSuggestionOut[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [selected, setSelected] = useState<Selected | null>(initial ?? null);
  const [kind, setKind] = useState<'apartment' | 'house'>('apartment');
  const [area, setArea] = useState('');
  const [year, setYear] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [parking, setParking] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ValuationOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [focusSummary, setFocusSummary] = useState(0);
  useEffect(() => {
    if (focusSummary) summaryRef.current?.focus(); // after the summary has rendered
  }, [focusSummary]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only the debounced fetch lives here; status changes happen in the input handler.
    if ((selected && query === selected.label) || query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const { data } = await api.GET('/v1/public/market/{city}/addresses', {
        params: { path: { city }, query: { q: query } },
      });
      const found = data?.suggestions ?? [];
      setSuggestions(found);
      setStatus(found.length ? 'suggestions' : 'not_found');
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected, city]);

  function changeQuery(q: string) {
    setQuery(q);
    if (selected && q !== selected.label) setSelected(null);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setStatus('idle');
    } else {
      setStatus('loading');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!selected) next.address = t('errors.address');
    const areaNumber = Number(area.replace(',', '.'));
    if (!area || !(areaNumber > 10)) next.area = t('errors.area');
    setErrors(next);
    if (Object.keys(next).length) {
      setFocusSummary((n) => n + 1);
      return;
    }
    setLoading(true);
    setFailed(false);
    const { data } = await api.POST('/v1/public/market/{city}/valuation', {
      params: { path: { city } },
      body: {
        neighborhood: selected!.neighborhood,
        street: selected!.street,
        number: selected!.number,
        kind,
        area_m2: String(areaNumber),
        year: year ? Number(year) : null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        parking: parking ? Number(parking) : null,
      },
    });
    setLoading(false);
    if (!data) {
      setFailed(true);
      return;
    }
    setResult(data);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'start' }));
  }

  const groupLabel = (level: string, label: string) =>
    t(`groups.${level}`, {
      band: t(`bands.${label}`),
      year: t(`years.${label}`),
      street: result?.street_name ?? '',
    });

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-card border border-line bg-panel p-5"
      >
        {Object.keys(errors).length ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-control border border-danger/30 bg-danger-subtle p-3 type-body-s focus-visible:outline-2 focus-visible:outline-focus"
          >
            {t('errors.summary', { count: Object.keys(errors).length })}
          </div>
        ) : null}
        <AddressAutocomplete
          value={query}
          suggestions={suggestions.map<AddressSuggestion>((s) => ({
            id: s.id,
            label: s.label,
            detail: s.detail,
          }))}
          status={status}
          onQueryChange={changeQuery}
          onSelect={(s) => {
            const full = suggestions.find((x) => x.id === s.id);
            if (!full) return;
            setSelected({
              neighborhood: full.neighborhood,
              street: full.street,
              number: full.number ?? null,
              label: full.label,
            });
            setQuery(full.label);
            setStatus('idle');
          }}
          error={errors.address}
          labels={{
            label: t('address'),
            placeholder: t('addressPlaceholder'),
            help: t('addressHelp'),
            coverage: t('coverage'),
            loading: t('searching'),
            notFound: t('notFound'),
            outsideCoverage: t('outsideCoverage'),
          }}
        />
        <SegmentedControl
          label={t('kind')}
          value={kind}
          onValueChange={(v) => setKind(v as 'apartment' | 'house')}
          options={[
            { value: 'apartment', label: t('apartment') },
            { value: 'house', label: t('house') },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('area')}
            help={t('areaHelp')}
            error={errors.area}
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder={t('areaPlaceholder')}
          />
          <Input
            label={t('year')}
            hint={t('optional')}
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <Input
            label={t('bedrooms')}
            hint={t('optional')}
            inputMode="numeric"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
          />
          <Input
            label={t('parking')}
            hint={t('optional')}
            inputMode="numeric"
            value={parking}
            onChange={(e) => setParking(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading}>
          {loading ? t('calculating') : t('submit')}
        </Button>
        <p className="type-caption">{t('noName')}</p>
      </form>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-20">
        {loading ? (
          <ValueRangeResult
            title={t('resultTitle')}
            state="loading"
            loadingLabel={t('calculating')}
          />
        ) : null}
        {failed ? (
          <p role="alert" className="type-body-s text-danger">
            {t('failed')}
          </p>
        ) : null}
        {!loading && result?.status === 'ok' && result.confidence ? (
          <div className="flex flex-col gap-6">
            <ValueRangeResult
              title={t('resultTitle')}
              subject={selected?.label}
              state={result.confidence}
              range={t('range', {
                low: formatBRLShort(result.low_cents ?? 0),
                high: formatBRLShort(result.high_cents ?? 0),
              })}
              center={t('center', { value: formatBRLShort(result.center_cents ?? 0) })}
              barLabels={{
                low: formatBRLShort(result.low_cents ?? 0),
                center: formatBRLShort(result.center_cents ?? 0),
                high: formatBRLShort(result.high_cents ?? 0),
              }}
              confidenceLabel={t(`confidence.${result.confidence}`)}
              basis={t(`basis.${result.basis}`, {
                count: result.comparables ?? 0,
                street: result.street_name ?? '',
              })}
              lowConfidenceNote={result.confidence === 'baixa' ? t('lowConfidence') : undefined}
              groups={
                <ComparableGroupList
                  title={t('groupsTitle')}
                  description={t('priceM2', { price: formatPriceM2(result.price_m2_cents ?? 0) })}
                  fewSalesLabel={t('fewSales')}
                  groups={result.groups.map((g) => ({
                    key: `${g.level}-${g.label}`,
                    description: groupLabel(g.level, g.label),
                    sales: g.sales,
                    median:
                      g.median_price_m2_cents != null
                        ? formatPriceM2(g.median_price_m2_cents)
                        : null,
                  }))}
                />
              }
              disclaimer={t('disclaimer')}
            />
            {result.center_cents ? (
              <section className="flex max-w-3xl flex-col gap-2">
                {/* Keyed by the estimate so a new valuation restarts the simulation. */}
                <FinancingSimulator
                  key={result.center_cents}
                  priceCents={result.center_cents}
                  editablePrice
                  itemId="valuation"
                  title={tSim('valuationTitle')}
                />
                <p className="type-caption">
                  {tSim('valuationStartsAt', { value: formatBRL(result.center_cents) })}
                </p>
              </section>
            ) : null}
            <section id="avaliacao-corretor" aria-label={t('leadTitle')} className="max-w-xl">
              <AlertForm
                variant="valuation"
                intents={['own_sell', 'own_rent', 'own_valuation']}
                target={{
                  scope: 'neighborhood',
                  city,
                  neighborhood: result.neighborhood?.slug ?? selected!.neighborhood,
                }}
                valuationSnapshot={{
                  low_cents: result.low_cents,
                  high_cents: result.high_cents,
                  center_cents: result.center_cents,
                  confidence: result.confidence,
                  basis: result.basis,
                  inputs: {
                    street: selected?.street,
                    number: selected?.number,
                    kind,
                    area_m2: area,
                    year,
                    bedrooms,
                    parking,
                  },
                }}
              />
            </section>
          </div>
        ) : null}
        {!loading && result?.status === 'outside_coverage' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-dashed border-line p-5">
              <h2 className="type-title">{t('outsideTitle')}</h2>
              <p className="type-body-s text-fg-muted">{t('outsideDescription')}</p>
            </div>
            <div className="max-w-xl">
              <AlertForm
                variant="outsideCoverage"
                intents={['own_valuation']}
                target={{ scope: 'city', city }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

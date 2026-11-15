'use client';

import { Badge, CurrencyInput, Panel } from '@casvitta/ui';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';

import { SimulationBadge } from '@/components/badges';
import type { Property } from '@/domain/types';
import { track } from '@/lib/analytics';
import { answerFromRecord } from '@/lib/data/marketplace';
import { DEFAULT_TERM_MONTHS, simulateSac } from '@/lib/finance';
import { formatBRL } from '@/lib/format';
import { USE_MOCKS } from '@/mocks/clock';

/**
 * "Simule o financiamento": entrada (includes FGTS), FGTS, prazo -> first SAC installment.
 * `editablePrice` (home teaser, mockup 51) swaps the FGTS field for the property value.
 */
export function FinancingSimulator({
  priceCents: initialPrice,
  editablePrice = false,
  title,
  itemId = 'home',
}: {
  priceCents: number;
  editablePrice?: boolean;
  title?: string;
  /** Listing slug for analytics (`home` for the home teaser). */
  itemId?: string;
}) {
  const t = useTranslations('listing.simulator');
  // Two simulators can share a page (phone + desktop layouts): ids must be unique.
  const termId = useId();
  const [price, setPrice] = useState<number | null>(initialPrice);
  const priceCents = Math.max(price ?? 0, 1);
  const [down, setDown] = useState<number | null>(Math.round(initialPrice * 0.2));
  const [fgts, setFgts] = useState<number | null>(6_000_000);
  const [term, setTerm] = useState(DEFAULT_TERM_MONTHS);
  const downCents = down ?? 0;
  const tooHigh = downCents >= priceCents;
  const sim = simulateSac({
    priceCents,
    downPaymentCents: Math.min(downCents, priceCents),
    termMonths: term,
  });
  const pct = Math.round((downCents / priceCents) * 100);
  // One `simulate_financing` per simulator, on the first change someone makes.
  const tracked = useRef(false);
  const onInteract = () => {
    if (tracked.current) return;
    tracked.current = true;
    track({
      name: 'simulate_financing',
      item_id: itemId,
      term_months: term,
      down_payment_pct: pct,
    });
  };

  return (
    <Panel title={title ?? t('title')} aside={<SimulationBadge />}>
      <div className="grid gap-3 sm:grid-cols-3" onChangeCapture={onInteract}>
        {editablePrice ? (
          <CurrencyInput label={t('price')} value={price} onValueChange={setPrice} />
        ) : null}
        <CurrencyInput
          label={editablePrice ? t('downWithFgts') : t('down')}
          value={down}
          onValueChange={setDown}
          help={t('downHelp', { pct })}
          error={tooHigh ? t('downTooHigh') : undefined}
        />
        {editablePrice ? null : (
          <CurrencyInput
            label={t('fgts')}
            value={fgts}
            onValueChange={setFgts}
            help={t('fgtsHelp')}
            error={(fgts ?? 0) > downCents ? t('fgtsTooHigh') : undefined}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={termId} className="type-body-s font-medium">
            {t('term')}
          </label>
          <input
            id={termId}
            type="number"
            inputMode="numeric"
            min={12}
            max={420}
            step={12}
            value={term}
            onChange={(e) =>
              setTerm(Math.min(420, Math.max(12, Number(e.target.value) || DEFAULT_TERM_MONTHS)))
            }
            aria-describedby={`${termId}-help`}
            className="h-11 rounded-control border border-line bg-panel px-3 font-mono type-body focus-visible:outline-2 focus-visible:outline-focus"
          />
          <p id={`${termId}-help`} className="type-caption">
            {t('months')}
          </p>
        </div>
      </div>
      <div
        className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-control bg-canvas p-4"
        aria-live="polite"
      >
        <div>
          <p className="type-caption">{t('result')}</p>
          <p className="type-value">
            {tooHigh ? '—' : formatBRL(Math.round(sim.firstInstallmentCents / 100) * 100)}
          </p>
        </div>
        <p className="max-w-[44ch] text-right type-caption">{t('disclaimer', { rate: '11,5%' })}</p>
      </div>
    </Panel>
  );
}

type QA = { id: number; question: string; answer: string };

/** "Pergunte sobre este imóvel": answers only from the record; the rest goes to the broker. */
export function AskBox({
  property,
  brokerFirstName,
}: {
  property: Property;
  brokerFirstName: string;
}) {
  const t = useTranslations('listing.ask');
  const [question, setQuestion] = useState('');
  const toText = (q: string) => {
    const answer = answerFromRecord(property, q);
    if (answer.kind === 'handoff') return t('handoff', { name: brokerFirstName });
    switch (answer.source) {
      case 'condo_fee_cents':
        return t('answers.condo', { amount: formatBRL(Number(answer.text)) });
      case 'iptu_cents':
        return t('answers.iptu', { amount: formatBRL(Number(answer.text)) });
      case 'nearby': {
        const [place, distance] = answer.text.split('|');
        return t('answers.nearby', { place: place ?? '', distance: distance ?? '' });
      }
      case 'bedrooms':
        return t('answers.bedrooms', { count: Number(answer.text) });
      case 'area_m2':
        return t('answers.area', { area: answer.text });
      case 'parking':
        return t('answers.parking', { count: Number(answer.text) });
      default:
        return `${answer.text} ${t('confirmOnVisit', { name: brokerFirstName })}`;
    }
  };
  const [items, setItems] = useState<QA[]>(() =>
    USE_MOCKS && property.facts.pets
      ? [{ id: 0, question: t('exampleQuestion'), answer: toText(t('exampleQuestion')) }]
      : [],
  );

  return (
    <Panel title={t('title')} aside={<Badge variant="ai">{t('badge')}</Badge>}>
      <div aria-live="polite" className="flex flex-col gap-3">
        {items.map((qa) => (
          <div key={qa.id} className="flex flex-col gap-2">
            <p className="self-end rounded-[10px_4px_10px_10px] bg-fg px-3 py-2 type-body-s text-white">
              {qa.question}
            </p>
            <p className="self-start rounded-[4px_10px_10px_10px] bg-canvas px-3 py-2 type-body-s text-fg">
              {qa.answer}
            </p>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (!q) return;
          track({
            name: 'ask_question',
            item_id: property.slug,
            answered_from_record: answerFromRecord(property, q).kind !== 'handoff',
          });
          setItems((list) => [...list, { id: list.length + 1, question: q, answer: toText(q) }]);
          setQuestion('');
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          {t('label')}
        </label>
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('placeholder')}
          className="h-11 min-w-0 flex-1 rounded-control border border-line bg-panel px-3 type-body-s focus-visible:outline-2 focus-visible:outline-focus"
        />
        <button
          type="submit"
          className="h-11 rounded-control bg-action px-4 type-body-s font-semibold text-white hover:bg-action-hover"
        >
          {t('send')}
        </button>
      </form>
      <p className="mt-3 type-caption">{t('note', { name: brokerFirstName })}</p>
    </Panel>
  );
}

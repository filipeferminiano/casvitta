'use client';

import { ChoiceChips, Input, SegmentedControl, Select } from '@casvitta/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import {
  AUCTION_KINDS,
  AUCTION_PAYMENTS,
  AUCTION_PRICE_RANGES,
  rememberAuctionCriteria,
  type AuctionCriteria,
} from '@/lib/data/auction';

import { InterestForm } from './InterestForm';

const full = 'flex w-full [&>*]:flex-1';

/** Mockups 59/60: auction interest with two separate consents (contact vs. marketing). */
export function AuctionForm() {
  const t = useTranslations('auction.form');
  const router = useRouter();
  const [regions, setRegions] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [price, setPrice] = useState<AuctionCriteria['price_range']>('up_to_300k');
  const [payment, setPayment] = useState<AuctionCriteria['payment']>('cash');
  const [purpose, setPurpose] = useState<AuctionCriteria['purpose']>('live');
  const [participated, setParticipated] = useState(false);
  const [errors, setErrors] = useState<{ regions?: string; kinds?: string }>({});
  const sent = useRef<AuctionCriteria | null>(null);

  return (
    <InterestForm
      kind="auction"
      title={t('title')}
      contactConsentLabel={t('consent')}
      marketingConsentLabel={t('marketing')}
      submitLabel={t('submit')}
      onSuccess={() => {
        if (sent.current) rememberAuctionCriteria(sent.current);
        router.push('/leilao/confirmado');
      }}
      arrange={({ name, phone }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {name}
            {phone}
          </div>
          <Input
            label={t('regions')}
            placeholder={t('regionsPlaceholder')}
            value={regions}
            onChange={(e) => setRegions(e.target.value)}
            error={errors.regions}
          />
          <ChoiceChips
            label={t('kinds')}
            name="kinds"
            multiple
            value={kinds}
            onChange={setKinds}
            error={errors.kinds}
            options={AUCTION_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('price')}
              value={price}
              onValueChange={(v) => setPrice(v as AuctionCriteria['price_range'])}
              options={AUCTION_PRICE_RANGES.map((v) => ({ value: v, label: t(`prices.${v}`) }))}
            />
            <Select
              label={t('payment')}
              value={payment}
              onValueChange={(v) => setPayment(v as AuctionCriteria['payment'])}
              options={AUCTION_PAYMENTS.map((v) => ({ value: v, label: t(`payments.${v}`) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="type-body-s font-medium">{t('purpose')}</p>
            <SegmentedControl
              label={t('purpose')}
              className={full}
              value={purpose}
              onValueChange={(v) => setPurpose(v as AuctionCriteria['purpose'])}
              options={[
                { value: 'live', label: t('purposes.live') },
                { value: 'invest', label: t('purposes.invest') },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="type-body-s font-medium">{t('participated')}</p>
            <SegmentedControl
              label={t('participated')}
              className={full}
              value={participated ? 'yes' : 'no'}
              onValueChange={(v) => setParticipated(v === 'yes')}
              options={[
                { value: 'no', label: t('participatedNo') },
                { value: 'yes', label: t('participatedYes') },
              ]}
            />
          </div>
        </>
      )}
      buildCriteria={() => {
        const next: typeof errors = {};
        if (regions.trim().length < 2) next.regions = t('regionsError');
        if (!kinds.length) next.kinds = t('kindsError');
        setErrors(next);
        if (Object.keys(next).length) return { ok: false };
        const built: AuctionCriteria = {
          regions: regions.trim(),
          property_kinds: kinds as AuctionCriteria['property_kinds'],
          price_range: price,
          payment,
          purpose,
          has_participated: participated,
        };
        sent.current = built;
        return { ok: true, criteria: built };
      }}
    />
  );
}

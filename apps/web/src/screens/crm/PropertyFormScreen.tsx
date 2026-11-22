'use client';

import { Button, Callout, Checkbox, Input, Panel, SegmentedControl, Select } from '@casvitta/ui';
import { Textarea } from '@casvitta/ui/backoffice';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { CrmError } from '@/lib/data/crm';
import {
  addAuthorization,
  addPhoto,
  createProperty,
  publish,
  updateProperty,
  type PropertyIn,
} from '@/lib/data/properties';

const MIN_PHOTOS = 5;
const KINDS = ['apartment', 'house', 'studio', 'commercial', 'land'] as const;

/** "740.000" or "6.563,40" → cents; blank → null (never 0 for "unknown"). */
export function parseBRL(value: string): number | null {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

const int = (value: string) => (value.trim() === '' ? null : Number.parseInt(value, 10));

/** CR4 · Cadastrar imóvel → página no site Casvitta (docs/mockups/crm/04-property-create). */
export function PropertyFormScreen() {
  const t = useTranslations('crm.properties');
  const tErr = useTranslations('crm.errors');
  const router = useRouter();
  const [f, setF] = useState({
    transaction: 'sale' as 'sale' | 'rent',
    kind: 'apartment' as (typeof KINDS)[number],
    title: '',
    description: '',
    street: '',
    number: '',
    complement: '',
    showStreet: false,
    neighborhood: '',
    city: '',
    state: 'SP',
    price: '',
    condo: '',
    iptu: '',
    area: '',
    bedrooms: '',
    suites: '',
    parking: '',
    floor: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [auth, setAuth] = useState({
    evidence: 'attestation' as 'attestation' | 'document',
    owner: '',
    signedAt: '',
    expiresAt: '',
    exclusive: false,
    attest: false,
  });
  const [document, setDocument] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [key]: e.target.value });

  const hasAuth =
    auth.owner.trim().length > 1 &&
    auth.signedAt &&
    auth.expiresAt &&
    (auth.evidence === 'document' ? document !== null : auth.attest);

  const save = async (andPublish: boolean) => {
    const price = parseBRL(f.price);
    if (!f.neighborhood || !f.city || !f.state || price === null) {
      setError(t('form.required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: PropertyIn = {
        kind: f.kind,
        transaction: f.transaction,
        title: f.title || null,
        description: f.description || null,
        street: f.street || null,
        street_number: f.number || null,
        complement: f.complement || null,
        show_street: f.showStreet,
        neighborhood: f.neighborhood,
        city: f.city,
        state: f.state.toUpperCase(),
        price_cents: price,
        condo_fee_cents: parseBRL(f.condo),
        iptu_monthly_cents: parseBRL(f.iptu),
        area_m2: int(f.area),
        bedrooms: int(f.bedrooms),
        suites: int(f.suites),
        parking: int(f.parking),
        floor: int(f.floor),
        features: [],
        source: 'casvitta',
      };
      const created = await createProperty(body);
      for (const photo of photos) await addPhoto(created.id, photo);
      if (hasAuth) {
        await addAuthorization(
          created.id,
          {
            kind: f.transaction,
            exclusive: auth.exclusive,
            evidence: auth.evidence,
            owner_name: auth.owner,
            signed_at: auth.signedAt,
            expires_at: auth.expiresAt,
            attest: auth.evidence === 'attestation' && auth.attest,
          },
          auth.evidence === 'document' ? document : null,
        );
      }
      if (andPublish) {
        await updateProperty(created.id, { status: 'active' });
        try {
          await publish(created.id, 'marketplace');
        } catch {
          // Blockers are listed on the property page; nothing is lost.
        }
      }
      router.push(`/imoveis/${created.id}`);
    } catch (err) {
      setError(err instanceof CrmError && err.message ? err.message : tErr('generic'));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <PageHeader
        breadcrumb={t('form.breadcrumb').split(' › ')}
        title={t('form.title')}
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {t('form.saveDraft')}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title={t('form.data')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SegmentedControl
                label={t('form.transaction')}
                value={f.transaction}
                onValueChange={(v) => setF({ ...f, transaction: v as 'sale' | 'rent' })}
                options={[
                  { value: 'sale', label: t('transaction.sale') },
                  { value: 'rent', label: t('transaction.rent') },
                ]}
              />
              <Select
                label={t('form.kind')}
                value={f.kind}
                onValueChange={(v) => setF({ ...f, kind: v as (typeof KINDS)[number] })}
                options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
              />
              <Input
                label={t('form.title_')}
                value={f.title}
                onChange={set('title')}
                className="sm:col-span-2"
              />
              <Input label={t('form.street')} value={f.street} onChange={set('street')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('form.number')} value={f.number} onChange={set('number')} />
                <Input
                  label={t('form.complement')}
                  value={f.complement}
                  onChange={set('complement')}
                />
              </div>
              <Checkbox
                className="sm:col-span-2"
                checked={f.showStreet}
                onCheckedChange={(v) => setF({ ...f, showStreet: v === true })}
                label={t('form.showStreet')}
              />
              <Input
                label={t('form.neighborhood')}
                required
                value={f.neighborhood}
                onChange={set('neighborhood')}
              />
              <div className="grid grid-cols-[1fr_5rem] gap-4">
                <Input label={t('form.city')} required value={f.city} onChange={set('city')} />
                <Input
                  label={t('form.state')}
                  required
                  maxLength={2}
                  value={f.state}
                  onChange={set('state')}
                />
              </div>
              <Input
                label={f.transaction === 'sale' ? t('form.price') : t('form.rent')}
                required
                inputMode="decimal"
                value={f.price}
                onChange={set('price')}
              />
              <Input
                label={t('form.condo')}
                inputMode="decimal"
                value={f.condo}
                onChange={set('condo')}
                hint={t('form.costHint')}
              />
              <Input
                label={t('form.iptu')}
                inputMode="decimal"
                value={f.iptu}
                onChange={set('iptu')}
                hint={t('form.costHint')}
              />
              <Input
                label={t('form.area')}
                inputMode="numeric"
                value={f.area}
                onChange={set('area')}
              />
              <div className="grid grid-cols-4 gap-3 sm:col-span-2">
                <Input
                  label={t('form.bedrooms')}
                  inputMode="numeric"
                  value={f.bedrooms}
                  onChange={set('bedrooms')}
                />
                <Input
                  label={t('form.suites')}
                  inputMode="numeric"
                  value={f.suites}
                  onChange={set('suites')}
                />
                <Input
                  label={t('form.parking')}
                  inputMode="numeric"
                  value={f.parking}
                  onChange={set('parking')}
                />
                <Input
                  label={t('form.floor')}
                  inputMode="numeric"
                  value={f.floor}
                  onChange={set('floor')}
                />
              </div>
              <Textarea
                label={t('form.description')}
                className="sm:col-span-2"
                maxLength={5000}
                value={f.description}
                onChange={set('description')}
              />
            </div>
          </Panel>
          <Panel title={t('form.photos')}>
            <Input
              label={t('form.photosCount', { count: photos.length, min: MIN_PHOTOS })}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hint={t('form.photosHint')}
              onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? [])])}
            />
          </Panel>
          <Panel title={t('form.authorization')}>
            <p className="mb-3 type-body-s text-fg-muted">{t('form.authorizationHint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('form.ownerName')}
                className="sm:col-span-2"
                value={auth.owner}
                onChange={(e) => setAuth({ ...auth, owner: e.target.value })}
              />
              <Input
                label={t('form.signedAt')}
                type="date"
                value={auth.signedAt}
                onChange={(e) => setAuth({ ...auth, signedAt: e.target.value })}
              />
              <Input
                label={t('form.expiresAt')}
                type="date"
                value={auth.expiresAt}
                onChange={(e) => setAuth({ ...auth, expiresAt: e.target.value })}
              />
              <Checkbox
                className="sm:col-span-2"
                checked={auth.exclusive}
                onCheckedChange={(v) => setAuth({ ...auth, exclusive: v === true })}
                label={t('form.exclusive')}
              />
              <SegmentedControl
                label={t('form.authorization')}
                className="sm:col-span-2"
                value={auth.evidence}
                onValueChange={(v) =>
                  setAuth({ ...auth, evidence: v as 'attestation' | 'document' })
                }
                options={[
                  { value: 'document', label: t('form.evidenceDocument') },
                  { value: 'attestation', label: t('form.evidenceAttestation') },
                ]}
              />
              {auth.evidence === 'document' ? (
                <Input
                  label={t('form.document')}
                  className="sm:col-span-2"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                />
              ) : (
                <Checkbox
                  className="sm:col-span-2"
                  checked={auth.attest}
                  onCheckedChange={(v) => setAuth({ ...auth, attest: v === true })}
                  label={t('form.attest')}
                />
              )}
            </div>
          </Panel>
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title={t('form.where')}>
            <ul className="flex flex-col gap-2 type-body-s">
              <li>{t('form.whereSite')}</li>
              <li>{t('form.whereSearch')}</li>
            </ul>
          </Panel>
          <Panel title={t('form.before')}>
            <ul className="flex flex-col gap-2 type-body-s">
              <li>
                {hasAuth ? '✓' : '○'} {t('form.check.authorization')}
              </li>
              <li>
                {photos.length >= MIN_PHOTOS ? '✓' : '○'}{' '}
                {t('form.check.photos', { min: MIN_PHOTOS })}
              </li>
              <li>○ {t('form.check.creci')}</li>
              <li>○ {t('form.check.review')}</li>
            </ul>
          </Panel>
          {error ? <Callout tone="risk">{error}</Callout> : null}
          <Button type="submit" loading={busy} loadingLabel={t('form.saving')}>
            {t('form.savePublish')}
          </Button>
          <p className="type-caption">{t('form.publishNote')}</p>
        </aside>
      </div>
    </form>
  );
}

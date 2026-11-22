'use client';

import {
  Button,
  Checkbox,
  DataTable,
  Input,
  Select,
  filterChipClass,
  type DataTableColumn,
} from '@casvitta/ui';
import { Dialog } from '@casvitta/ui/backoffice';
import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import {
  CrmError,
  useContacts,
  useCreateContact,
  type ContactIn,
  type ContactRow,
  type ContactView,
} from '@/lib/data/crm';

import { ConsentMarks, CrmStates, useAgo, useInterestLine, useStageName } from './shared';

const VIEWS: ContactView[] = ['all', 'buyers', 'tenants', 'owners', 'no_reply_14d'];
const isView = (v: string | null): v is ContactView => VIEWS.includes(v as ContactView);

/** CR1 · Contatos (docs/mockups/crm/01-contacts). */
export function ContactsScreen() {
  const t = useTranslations('crm');
  const router = useRouter();
  const params = useSearchParams();
  const view: ContactView = isView(params.get('visao'))
    ? (params.get('visao') as ContactView)
    : 'all';
  const [q, setQ] = useState('');
  const contacts = useContacts(view, q);
  const interestLine = useInterestLine();
  const stageName = useStageName();
  const ago = useAgo();
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<ContactRow>[] = [
    {
      key: 'contact',
      header: t('contacts.columns.contact'),
      cell: (c) => (
        <div className="flex flex-col">
          <Link
            href={`/contatos/${c.id}`}
            aria-label={t('contacts.open', { name: c.name })}
            className="font-semibold text-fg underline-offset-4 hover:underline"
          >
            {c.name}
          </Link>
          <span className="type-caption">{t(`kind.${c.kind}`)}</span>
          {c.is_demo ? <DemoBadge className="mt-0.5 self-start" /> : null}
        </div>
      ),
    },
    {
      key: 'wants',
      header: t('contacts.columns.wants'),
      cell: (c) => <span className="type-body-s">{interestLine(c.interest) || '—'}</span>,
    },
    {
      key: 'source',
      header: t('contacts.columns.source'),
      cell: (c) => (
        <span className="type-body-s">
          {[t(`source.${c.source}`), c.source_detail].filter(Boolean).join(' · ')}
        </span>
      ),
    },
    {
      key: 'stage',
      header: t('contacts.columns.stage'),
      cell: (c) => <span className="type-body-s">{stageName(c.stage) || '—'}</span>,
    },
    {
      key: 'consent',
      header: t('contacts.columns.consent'),
      cell: (c) => <ConsentMarks consent={c.consent} />,
    },
    {
      key: 'last',
      header: t('contacts.columns.last'),
      cell: (c) => (c.last_interaction_at ? ago(c.last_interaction_at) : t('contacts.never')),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download aria-hidden="true" />} asChild>
              <a href="/api/v1/contacts/export">{t('contacts.export')}</a>
            </Button>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>
              {t('contacts.new')}
            </Button>
          </div>
        }
      />
      <nav aria-label={t('contacts.title')} className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === 'all' ? '/contatos' : `/contatos?visao=${v}`}
            aria-current={v === view ? 'page' : undefined}
            className={filterChipClass(v === view)}
            onClick={(e) => {
              e.preventDefault();
              router.replace(v === 'all' ? '/contatos' : `/contatos?visao=${v}`);
            }}
          >
            {t(`contacts.views.${v}`)} · {contacts.data?.counts[v] ?? '…'}
          </Link>
        ))}
      </nav>
      <Input
        label={t('contacts.search')}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <CrmStates
        query={contacts}
        subject={t('contacts.subject')}
        isEmpty={(d) => d.items.length === 0}
        empty={{ title: view === 'all' && !q ? t('contacts.empty') : t('contacts.emptyView') }}
      >
        {(data) => (
          <DataTable
            caption={t('contacts.title')}
            columns={columns}
            rows={data.items}
            rowKey={(c) => c.id}
          />
        )}
      </CrmStates>
      <p className="type-caption">{t('contacts.legend')}</p>
      <p className="type-caption">{t('contacts.mergeNote')}</p>
      {creating ? <NewContactDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function NewContactDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('crm');
  const router = useRouter();
  const create = useCreateContact();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    instagram: '',
    kind: 'unknown' as ContactIn['kind'],
    consentWhatsapp: false,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.phone && !form.email) {
      setError(t('newContact.needReach'));
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        instagram_handle: form.instagram || null,
        kind: form.kind,
        source: 'manual',
        consents:
          form.consentWhatsapp && form.phone
            ? [
                {
                  channel: 'whatsapp',
                  purpose: 'contact_about_properties',
                  granted: true,
                  proof_source: 'broker',
                  proof_text: t('newContact.consentProof'),
                },
              ]
            : [],
      });
      router.push(`/contatos/${created.id}`);
    } catch (err) {
      setError(err instanceof CrmError && err.message ? err.message : t('errors.generic'));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('newContact.title')}
      description={t('newContact.description')}
      closeLabel={t('newContact.cancel')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label={t('newContact.name')}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label={t('newContact.phone')}
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          label={t('newContact.email')}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label={t('newContact.instagram')}
          value={form.instagram}
          onChange={(e) => setForm({ ...form, instagram: e.target.value })}
        />
        <Select
          label={t('newContact.kind')}
          value={form.kind}
          onValueChange={(v) => setForm({ ...form, kind: v as ContactIn['kind'] })}
          options={(['buyer', 'tenant', 'owner', 'unknown'] as const).map((k) => ({
            value: k,
            label: t(`kind.${k}`),
          }))}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="type-body-s font-semibold">{t('newContact.consentTitle')}</legend>
          <Checkbox
            checked={form.consentWhatsapp}
            onCheckedChange={(v) => setForm({ ...form, consentWhatsapp: v === true })}
            label={t('newContact.consentWhatsapp')}
          />
          <p className="type-caption">{t('newContact.consentHint')}</p>
        </fieldset>
        {error ? <p className="type-body-s text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('newContact.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t('newContact.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

'use client';

import { Button, Callout, Input, Panel, StatusPill, formatDate, formatTime } from '@casvitta/ui';
import { Dialog } from '@casvitta/ui/backoffice';
import { Check, Circle, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { CrmError } from '@/lib/data/crm';
import {
  qrHref,
  useCheckDomain,
  useConnectDomain,
  useDetachDomain,
  type Page,
  type PageDomain,
} from '@/lib/data/page';

import { CopyLink } from './CopyLink';

const errorText = (e: unknown, fallback: string) =>
  e instanceof CrmError && e.message ? e.message : fallback;

/** Minha página › Domínio próprio (docs/mockups/social/14 and 15). */
export function DomainPanel({ page }: { page: Page }) {
  const t = useTranslations('social.domain');
  if (!page.domains_available) {
    return (
      <Panel title={t('title')}>
        <p className="type-body-s text-fg-strong">{t('offer')}</p>
        <Link
          href="/configuracoes"
          className="mt-3 inline-flex min-h-11 items-center type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('seePlans')}
        </Link>
      </Panel>
    );
  }
  return (
    <Panel title={t('title')}>
      {page.domain ? <Connected page={page} domain={page.domain} /> : <Connect />}
    </Panel>
  );
}

function Connect() {
  const t = useTranslations('social.domain');
  const connect = useConnectDomain();
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) connect.mutate(value.trim());
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Input
        label={t('yourDomain')}
        help={t('yourDomainHelp')}
        placeholder="www.seunome.com.br"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="type-caption">{t('notSold')}</p>
      {connect.error ? (
        <p role="alert" className="type-body-s text-danger">
          {errorText(connect.error, t('error'))}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-fit"
        loading={connect.isPending}
        loadingLabel={t('saving')}
      >
        {t('continue')}
      </Button>
    </form>
  );
}

function Step({ done, warn, children }: { done: boolean; warn?: boolean; children: ReactNode }) {
  const Icon = done ? Check : warn ? TriangleAlert : Circle;
  return (
    <li className="flex items-start gap-2 type-body-s">
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${done ? 'text-success' : warn ? 'text-danger' : 'text-fg-muted'}`}
      />
      <span>{children}</span>
    </li>
  );
}

function Connected({ page, domain }: { page: Page; domain: PageDomain }) {
  const t = useTranslations('social.domain');
  const check = useCheckDomain();
  const detach = useDetachDomain();
  const [confirming, setConfirming] = useState(false);
  const [showRecords, setShowRecords] = useState(domain.status !== 'active');
  const subdomain = page.subdomain_url.replace(/^https?:\/\//, '');
  const txtOk = domain.error_code !== 'txt_missing' && domain.last_checked_at !== null;
  const cnameOk = txtOk && !['cname_missing', 'cname_wrong'].includes(domain.error_code ?? '');
  const certOk = domain.status === 'active';
  const problem = t(`problems.${domain.error_code ?? 'cert_failed'}`, {
    found: domain.found_value ?? '',
    target: domain.cname_target,
    host: domain.cname_host,
  });
  const checked = domain.last_checked_at
    ? t('checkedAt', {
        date: formatDate(new Date(domain.last_checked_at)),
        time: formatTime(new Date(domain.last_checked_at)),
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono type-body font-semibold">{domain.hostname}</span>
        <StatusPill
          tone={
            domain.status === 'active'
              ? 'success'
              : domain.status === 'error'
                ? 'danger'
                : 'attention'
          }
        >
          {t(`status.${domain.status}`)}
        </StatusPill>
      </div>

      {domain.status === 'active' ? (
        <>
          <ul className="flex flex-col gap-1.5">
            <Step done>{t('active.https')}</Step>
            <Step done>{t('active.redirect', { subdomain })}</Step>
            <Step done>{t('active.qr')}</Step>
          </ul>
          <CopyLink url={page.url} />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a href={qrHref('png')} download>
                {t('downloadQr')}
              </a>
            </Button>
            <Button variant="ghost" onClick={() => setShowRecords(!showRecords)}>
              {showRecords ? t('hideRecords') : t('showRecords')}
            </Button>
          </div>
        </>
      ) : domain.status === 'error' ? (
        <Callout tone="risk" title={t('problemTitle')}>
          {problem}{' '}
          {domain.activated_at
            ? t('fellBack', { subdomain })
            : t('stillOnSubdomain', { subdomain })}
        </Callout>
      ) : domain.error_code && domain.last_checked_at ? (
        <Callout tone="attention" title={t('notYetTitle')}>
          {problem} {t('pendingNote', { subdomain })}
        </Callout>
      ) : (
        <Callout tone="info">{t('pendingNote', { subdomain })}</Callout>
      )}

      {domain.status !== 'active' ? (
        <ul className="flex flex-col gap-1.5" aria-label={t('progress')}>
          <Step
            done={txtOk}
            warn={domain.error_code === 'txt_missing' && domain.status === 'error'}
          >
            {t('steps.txt')}
          </Step>
          <Step
            done={cnameOk}
            warn={['cname_missing', 'cname_wrong'].includes(domain.error_code ?? '')}
          >
            {t('steps.cname')}
          </Step>
          <Step done={certOk} warn={domain.error_code === 'cert_failed'}>
            {t('steps.cert')}
          </Step>
        </ul>
      ) : null}

      {showRecords ? (
        <section aria-labelledby="dns-title" className="flex flex-col gap-3">
          <h3 id="dns-title" className="type-body font-semibold">
            {t('recordsTitle')}
          </h3>
          <p className="type-body-s text-fg-strong">{t('recordsIntro', { zone: domain.zone })}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Record label={t('cname')} name={domain.cname_host} value={domain.cname_target} />
            <Record label={t('txt')} name={domain.txt_host} value={domain.txt_value} />
          </dl>
          <p className="type-caption">{t('apexNote', { zone: domain.zone })}</p>
          <a
            href="https://registro.br/ajuda/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {t('registroBr')}
          </a>
        </section>
      ) : null}

      {check.error || detach.error ? (
        <p role="alert" className="type-body-s text-danger">
          {errorText(check.error ?? detach.error, t('error'))}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {domain.status !== 'active' ? (
          <Button
            onClick={() => check.mutate()}
            loading={check.isPending}
            loadingLabel={t('checking')}
          >
            {domain.last_checked_at ? t('checkAgain') : t('checkNow')}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          {t('detach')}
        </Button>
        {checked ? <span className="type-caption">{checked}</span> : null}
      </div>
      <p className="type-caption">{t('waitNote')}</p>

      {confirming ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setConfirming(false)}
          title={t('detachTitle', { domain: domain.hostname })}
          description={t('detachText', { subdomain })}
          closeLabel={t('cancel')}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={detach.isPending}
              onClick={() => detach.mutate(undefined, { onSuccess: () => setConfirming(false) })}
            >
              {t('detachConfirm')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function Record({ label, name, value }: { label: string; name: string; value: string }) {
  const t = useTranslations('social.domain');
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line p-3">
      <dt className="type-caption font-semibold">{label}</dt>
      <dd className="flex flex-col gap-1.5">
        <span className="type-caption">
          {t('name')} <span className="font-mono text-fg">{name}</span>
        </span>
        <CopyValue value={value} label={t('valueLabel', { label })} />
      </dd>
    </div>
  );
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const t = useTranslations('social.domain');
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-2 rounded-control border border-line bg-subtle p-1 pl-3">
      <code className="min-w-0 flex-1 truncate type-body-s">{value}</code>
      <Button
        size="sm"
        variant="secondary"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t('copied') : t('copy')}
      </Button>
    </span>
  );
}

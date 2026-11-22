'use client';

import { Button, Callout, Checkbox, IconButton, Input, Panel, Select } from '@casvitta/ui';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CrmError } from '@/lib/data/crm';
import { usePageCollections, useSavePageCollections, type PageCollections } from '@/lib/data/page';
import { useProperties, type PropertyOut } from '@/lib/data/properties';

import { onBio } from './OnboardingScreen';

export const MAX_COLLECTIONS = 8;
export const MAX_POSTS = 12;
const INSTAGRAM =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/[\w-]{5,40}\/?(?:[?#].*)?$/i;
export const isInstagramPost = (url: string) => INSTAGRAM.test(url.trim());

type Draft = {
  collections: Array<{ key: string; title: string; property_ids: string[] }>;
  instagram: Array<{ key: string; url: string; label: string; property_id: string }>;
};

let seq = 0;
const nextKey = () => `n${++seq}`;

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  return copy;
}

/** Minha página › Seleções e "Vi no Instagram" (plans with page_collections). */
export function CollectionsPanel() {
  const t = useTranslations('social.collections');
  const saved = usePageCollections();
  const properties = useProperties();
  if (saved.isPending || properties.isPending) {
    return (
      <Panel title={t('title')}>
        <p className="type-body-s text-fg-muted">{t('loading')}</p>
      </Panel>
    );
  }
  if (!saved.data || !properties.data) {
    return (
      <Panel title={t('title')}>
        <p className="type-body-s text-danger">{t('loadError')}</p>
      </Panel>
    );
  }
  if (!saved.data.available) {
    return (
      <Panel title={t('title')}>
        <Callout tone="info">{t('notInPlan')}</Callout>
        <Link
          href="/configuracoes"
          className="mt-3 inline-flex min-h-11 items-center type-body-s font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('seePlans')}
        </Link>
      </Panel>
    );
  }
  // Remount the editor when the saved set changes (no state copied in an effect).
  return (
    <Editor
      key={saved.dataUpdatedAt}
      saved={saved.data}
      properties={properties.data.filter(onBio)}
    />
  );
}

function Editor({ saved, properties }: { saved: PageCollections; properties: PropertyOut[] }) {
  const t = useTranslations('social.collections');
  const tKinds = useTranslations('crm.properties.kinds');
  const save = useSavePageCollections();
  const [draft, setDraft] = useState<Draft>(() => ({
    collections: saved.collections.map((c) => ({ ...c, key: c.id })),
    instagram: saved.instagram.map((p) => ({ ...p, key: p.id })),
  }));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = (next: Draft) => {
    setDraft(next);
    setDirty(true);
  };
  const label = (p: PropertyOut) =>
    `${p.code} · ${p.title ?? t('defaultTitle', { kind: tKinds(p.kind), place: p.neighborhood })}`;
  const options = properties.map((p) => ({ value: p.id, label: label(p) }));

  const submit = () => {
    if (draft.collections.some((c) => c.title.trim().length < 2)) return setError(t('needTitle'));
    if (draft.instagram.some((p) => !isInstagramPost(p.url))) return setError(t('badUrl'));
    if (draft.instagram.some((p) => p.label.trim().length < 2 || !p.property_id))
      return setError(t('needPost'));
    setError(null);
    save.mutate(
      {
        collections: draft.collections.map(({ title, property_ids }) => ({ title, property_ids })),
        instagram: draft.instagram.map(({ url, label: text, property_id }) => ({
          url,
          label: text,
          property_id,
        })),
      },
      {
        onError: (e) => setError(e instanceof CrmError && e.message ? e.message : t('saveError')),
      },
    );
  };

  return (
    <Panel title={t('title')}>
      <div className="flex flex-col gap-6">
        {properties.length === 0 ? <Callout tone="attention">{t('noProperties')}</Callout> : null}

        <section aria-labelledby="sel-title" className="flex flex-col gap-3">
          <h3 id="sel-title" className="type-body font-semibold">
            {t('selections')}
          </h3>
          <p className="type-body-s text-fg-muted">{t('selectionsHelp')}</p>
          {draft.collections.map((c, i) => (
            <fieldset
              key={c.key}
              className="flex flex-col gap-2 rounded-card border border-line p-4"
            >
              <legend className="sr-only">{t('selectionN', { n: i + 1 })}</legend>
              <div className="flex items-end gap-2">
                <Input
                  className="flex-1"
                  label={t('selectionTitle')}
                  placeholder={t('selectionPlaceholder')}
                  maxLength={60}
                  value={c.title}
                  onChange={(e) =>
                    change({
                      ...draft,
                      collections: draft.collections.map((x) =>
                        x.key === c.key ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Reorder
                  index={i}
                  count={draft.collections.length}
                  name={c.title || t('selectionN', { n: i + 1 })}
                  onMove={(by) => change({ ...draft, collections: move(draft.collections, i, by) })}
                  onRemove={() =>
                    change({ ...draft, collections: draft.collections.filter((x) => x !== c) })
                  }
                />
              </div>
              {properties.map((p) => (
                <Checkbox
                  key={p.id}
                  label={label(p)}
                  checked={c.property_ids.includes(p.id)}
                  onCheckedChange={(v) =>
                    change({
                      ...draft,
                      collections: draft.collections.map((x) =>
                        x.key !== c.key
                          ? x
                          : {
                              ...x,
                              property_ids:
                                v === true
                                  ? [...x.property_ids, p.id]
                                  : x.property_ids.filter((id) => id !== p.id),
                            },
                      ),
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
          <Button
            variant="secondary"
            className="w-fit"
            disabled={draft.collections.length >= MAX_COLLECTIONS}
            onClick={() =>
              change({
                ...draft,
                collections: [
                  ...draft.collections,
                  { key: nextKey(), title: '', property_ids: [] },
                ],
              })
            }
          >
            <Plus aria-hidden="true" />
            {t('addSelection')}
          </Button>
        </section>

        <section aria-labelledby="ig-title" className="flex flex-col gap-3">
          <h3 id="ig-title" className="type-body font-semibold">
            {t('instagram')}
          </h3>
          <p className="type-body-s text-fg-muted">{t('instagramHelp')}</p>
          {draft.instagram.map((post, i) => {
            const update = (patch: Partial<Draft['instagram'][number]>) =>
              change({
                ...draft,
                instagram: draft.instagram.map((x) =>
                  x.key === post.key ? { ...x, ...patch } : x,
                ),
              });
            return (
              <fieldset
                key={post.key}
                className="flex flex-col gap-2 rounded-card border border-line p-4"
              >
                <legend className="sr-only">{t('postN', { n: i + 1 })}</legend>
                <Input
                  label={t('postUrl')}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.instagram.com/reel/…"
                  value={post.url}
                  error={post.url && !isInstagramPost(post.url) ? t('badUrl') : undefined}
                  onChange={(e) => update({ url: e.target.value })}
                />
                <Input
                  label={t('postLabel')}
                  placeholder={t('postLabelPlaceholder')}
                  maxLength={60}
                  value={post.label}
                  onChange={(e) => update({ label: e.target.value })}
                />
                <div className="flex items-end gap-2">
                  <Select
                    className="flex-1"
                    label={t('postProperty')}
                    placeholder={t('choose')}
                    value={post.property_id || undefined}
                    onValueChange={(v) => update({ property_id: v })}
                    options={options}
                  />
                  <Reorder
                    index={i}
                    count={draft.instagram.length}
                    name={post.label || t('postN', { n: i + 1 })}
                    onMove={(by) => change({ ...draft, instagram: move(draft.instagram, i, by) })}
                    onRemove={() =>
                      change({ ...draft, instagram: draft.instagram.filter((x) => x !== post) })
                    }
                  />
                </div>
              </fieldset>
            );
          })}
          <Button
            variant="secondary"
            className="w-fit"
            disabled={draft.instagram.length >= MAX_POSTS || properties.length === 0}
            onClick={() =>
              change({
                ...draft,
                instagram: [
                  ...draft.instagram,
                  { key: nextKey(), url: '', label: '', property_id: properties[0]?.id ?? '' },
                ],
              })
            }
          >
            <Plus aria-hidden="true" />
            {t('addPost')}
          </Button>
        </section>

        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} loading={save.isPending} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
          <p role="status" className="type-body-s text-fg-muted">
            {dirty ? t('unsaved') : t('saved')}
          </p>
        </div>
        <p className="type-caption">{t('onlyLive')}</p>
      </div>
    </Panel>
  );
}

function Reorder({
  index,
  count,
  name,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  name: string;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('social.collections');
  return (
    <div className="flex gap-1">
      <IconButton
        label={t('moveUp', { name })}
        variant="ghost"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        icon={<ArrowUp aria-hidden="true" />}
      />
      <IconButton
        label={t('moveDown', { name })}
        variant="ghost"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        icon={<ArrowDown aria-hidden="true" />}
      />
      <IconButton
        label={t('remove', { name })}
        variant="ghost"
        onClick={onRemove}
        icon={<Trash2 aria-hidden="true" />}
      />
    </div>
  );
}

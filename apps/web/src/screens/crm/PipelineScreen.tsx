'use client';

import { Callout, Chip, KanbanBoard, LeadCard, Panel, cardLinkClass } from '@casvitta/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DemoBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { useMoveLead, usePipeline, type BoardCard } from '@/lib/data/crm';

import { CrmStates, useStageName } from './shared';

/** CR3 · Funil (docs/mockups/crm/03-pipeline). Moves by drag or by the card menu (keyboard). */
export function PipelineScreen() {
  const t = useTranslations('crm');
  const pipeline = usePipeline();
  const move = useMoveLead();
  const stageName = useStageName();
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('pipeline.title')} subtitle={t('pipeline.subtitle')} />
      {error ? <Callout tone="risk">{t('pipeline.moveError')}</Callout> : null}
      <CrmStates query={pipeline} subject={t('pipeline.subject')} feature="pipeline">
        {(columns) => (
          <KanbanBoard<BoardCard>
            label={t('pipeline.boardLabel')}
            columns={columns.map((c) => ({
              key: c.stage.id,
              title: stageName(c.stage),
              items: c.cards,
            }))}
            itemKey={(card) => card.lead_id}
            itemLabel={(card) => card.name}
            onMove={(leadId, stageId) => {
              setError(false);
              move.mutate({ leadId, stageId }, { onError: () => setError(true) });
            }}
            renderItem={(card, menu) => (
              <LeadCard
                name={
                  <Link href={`/contatos/${card.person_id}`} className={cardLinkClass}>
                    {card.name}
                  </Link>
                }
                origin={[t(`source.${card.source as 'manual'}`), card.property_code]
                  .filter(Boolean)
                  .join(' · ')}
                chips={
                  <>
                    {card.automations_paused ? (
                      <Chip>{t('pipeline.automationsPaused')}</Chip>
                    ) : null}
                    {card.is_demo ? <DemoBadge /> : null}
                  </>
                }
                menu={menu}
              />
            )}
            copy={{
              moveTo: t('pipeline.moveTo'),
              moveMenuLabel: (name) => t('pipeline.moveMenuLabel', { name }),
              showMore: (count) => t('pipeline.showMore', { count }),
              showLess: t('pipeline.showLess'),
              moved: (name, column) => t('pipeline.moved', { name, column }),
              empty: t('pipeline.empty'),
            }}
          />
        )}
      </CrmStates>
      <Panel title={t('pipeline.rulesTitle')}>
        <p className="type-body-s text-fg-strong">{t('pipeline.rulesNote')}</p>
      </Panel>
    </div>
  );
}

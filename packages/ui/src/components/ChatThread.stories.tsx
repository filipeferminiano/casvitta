import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { AiDraftComposer, ChatThread, type ChatItem } from './ChatThread.tsx';

const meta = { title: 'Domain/ChatThread' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const items: ChatItem[] = [
  { kind: 'event', id: 'e0', text: 'Marcos clicou no anúncio do Instagram · 14h01' },
  {
    kind: 'message',
    id: 'm1',
    side: 'in',
    text: 'Oi! Vi o apê da Vila Mariana. Ainda está disponível?',
    meta: 'Marcos · 14h01',
  },
  {
    kind: 'message',
    id: 'm2',
    side: 'out',
    ai: true,
    text: 'Oi, Marcos! Está sim. Sou o assistente virtual da Ana Ribeiro.',
    meta: 'IA · 14h01',
  },
  { kind: 'event', id: 'e1', text: 'Qualificação salva no lead' },
  { kind: 'event', id: 'e2', tone: 'success', text: 'Visita marcada · sáb 14/11 · 10h' },
  {
    kind: 'event',
    id: 'e3',
    tone: 'attention',
    text: 'IA passou a conversa para você · motivo: negociação de preço',
  },
  {
    kind: 'message',
    id: 'm3',
    side: 'out',
    text: 'Te aviso assim que o proprietário responder.',
    meta: 'Você · 18h20',
  },
];

export const AiAnswering: Story = {
  render: () => (
    <ChatThread
      className="h-[520px] max-w-xl"
      label="Conversa com Marcos T."
      items={items}
      header={<strong>Marcos T.</strong>}
      footer={
        <div className="flex gap-2">
          <input
            aria-label="Mensagem"
            placeholder="Escreva para assumir a conversa no lugar da IA"
            className="h-11 flex-1 rounded-control border border-line px-3"
          />
          <Button variant="secondary">Assumir conversa</Button>
        </div>
      }
    />
  ),
};

export const Empty: Story = {
  render: () => <ChatThread className="h-[240px] max-w-xl" label="Conversa vazia" items={[]} />,
};

function DraftDemo() {
  const [value, setValue] = useState(
    'Oi, Júlia! Aqui é a Ana. Posso levar a sua proposta ao proprietário?',
  );
  return (
    <div className="max-w-xl">
      <AiDraftComposer
        badge={<Badge variant="ai">Rascunho da IA · revise antes de enviar</Badge>}
        label="Resposta"
        value={value}
        onChange={setValue}
        warning="A IA não cita valores de outras propostas. Confira antes de enviar."
        discard={<button className="type-body-s text-action underline">Descartar</button>}
        actions={
          <>
            <Button variant="secondary">Devolver para a IA</Button>
            <Button>Enviar</Button>
          </>
        }
      />
    </div>
  );
}

export const AiDraft: Story = { render: () => <DraftDemo /> };

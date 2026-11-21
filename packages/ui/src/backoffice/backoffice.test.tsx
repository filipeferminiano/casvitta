import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { House, Users } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Dialog } from '../components/Dialog.tsx';
import { BackofficeShell, EnvironmentBadge } from './BackofficeShell.tsx';
import { PermissionMatrix } from './PermissionMatrix.tsx';
import { QueueTable } from './QueueTable.tsx';

describe('BackofficeShell', () => {
  it('marks the current page and reads queue counts aloud', () => {
    render(
      <BackofficeShell
        brand="CASVITTA"
        badge="BACKOFFICE"
        homeHref="/"
        homeLabel="Visão geral do backoffice"
        navLabel="Backoffice"
        skipLabel="Pular para o conteúdo"
        badges={<EnvironmentBadge environment="production" label="Produção" />}
        groups={[
          {
            key: 'ops',
            label: 'Operação',
            items: [
              { key: 'home', href: '/', label: 'Visão geral', icon: House },
              {
                key: 'creci',
                href: '/creci',
                label: 'Verificação de CRECI',
                icon: Users,
                current: true,
                count: 12,
                countLabel: '12 na fila',
              },
            ],
          },
        ]}
      >
        <p>conteúdo</p>
      </BackofficeShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Backoffice' });
    const current = within(nav).getByRole('link', { name: /Verificação de CRECI/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveTextContent('12 na fila');
    expect(within(nav).getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByText('Produção')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#content',
    );
  });
});

describe('PermissionMatrix', () => {
  it('says allowed or not in words, not only with icons', () => {
    render(
      <PermissionMatrix
        caption="O que cada papel pode fazer"
        permissionHeader="Permissão"
        yesLabel="Pode"
        noLabel="Não pode"
        roles={[
          { key: 'admin', label: 'Admin' },
          { key: 'read_only', label: 'Leitura' },
        ]}
        rows={[
          { key: 'creci', label: 'Verificar CRECI', allowed: { admin: true, read_only: false } },
        ]}
      />,
    );
    const row = screen.getByRole('row', { name: /Verificar CRECI/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Pode');
    expect(cells[1]).toHaveTextContent('Não pode');
  });
});

describe('Dialog', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Editar Marina
        </button>
        <Dialog open={open} onOpenChange={setOpen} title="Editar acesso" closeLabel="Fechar">
          <input aria-label="Código" />
        </Dialog>
      </>
    );
  }

  it('moves focus in, closes with Esc and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Editar Marina' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Editar acesso' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('QueueTable', () => {
  const rows = [
    { id: 'a', name: 'Ana Ribeiro' },
    { id: 'b', name: 'Rafael Souza' },
    { id: 'c', name: 'Carla Mendes' },
  ];

  function Harness() {
    const [selected, setSelected] = useState('a');
    return (
      <>
        <QueueTable
          caption="Fila"
          rows={rows}
          rowKey={(r) => r.id}
          selectedKey={selected}
          onSelect={(r) => setSelected(r.id)}
          selectLabel={(r) => `Ver ${r.name}`}
          primary={{ key: 'n', header: 'Corretor', cell: (r) => r.name }}
          columns={[]}
        />
        <p>aberto: {selected}</p>
      </>
    );
  }

  it('works through the queue with the arrow keys and marks the open row', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ana = screen.getByRole('button', { name: 'Ver Ana Ribeiro' });
    expect(ana).toHaveAttribute('aria-current', 'true');
    ana.focus();
    await user.keyboard('{ArrowDown}');
    const rafael = screen.getByRole('button', { name: 'Ver Rafael Souza' });
    expect(rafael).toHaveFocus();
    expect(rafael).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('aberto: b')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}'); // stops at the last row
    expect(screen.getByRole('button', { name: 'Ver Carla Mendes' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(rafael).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Ver Carla Mendes' }));
    expect(screen.getByText('aberto: c')).toBeInTheDocument();
  });
});

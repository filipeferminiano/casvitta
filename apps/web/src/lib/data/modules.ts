import type { ModuleItem } from '@/domain/types';
import { now } from '@/mocks/clock';

import { withScreenState } from './screen-state';
import { db, mutate } from './store';

export type ModuleView = ModuleItem & { interested: boolean };

export function listModules(): Promise<ModuleView[]> {
  return withScreenState<ModuleView[]>([], () => {
    const data = db();
    return data.modules.map((m) => ({
      ...m,
      interested: data.moduleInterest.some((i) => i.key === m.key),
    }));
  });
}

/**
 * "Em breve" modules never activate: the button only records interest (CLAUDE.md §4.9).
 * Server-side this becomes a module_interest row.
 */
export async function registerInterest(key: string): Promise<void> {
  mutate((data) => {
    const item = data.modules.find((m) => m.key === key);
    if (!item || item.state !== 'soon') throw new Error('Only upcoming modules record interest');
    if (!data.moduleInterest.some((i) => i.key === key)) {
      data.moduleInterest.push({ key, at: now().toISOString() });
    }
  });
}

/** Available modules can be activated (billing happens on the API in Milestone 1). */
export async function activateModule(key: string): Promise<void> {
  mutate((data) => {
    const item = data.modules.find((m) => m.key === key);
    if (!item || item.state !== 'available') throw new Error('Module is not available');
    item.state = 'active';
  });
}

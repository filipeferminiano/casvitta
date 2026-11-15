/**
 * Review helper: in mock mode every screen honours ?state=loading|empty|error so each state can
 * be checked. Data functions call `withScreenState(empty, () => value)`.
 */
import { USE_MOCKS } from '@/mocks/clock';

export type ScreenState = 'loading' | 'empty' | 'error' | null;

export class ScreenStateError extends Error {
  constructor() {
    super('Simulated error (?state=error)');
  }
}

export function currentScreenState(search?: string): ScreenState {
  if (!USE_MOCKS) return null;
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const value = new URLSearchParams(query).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : null;
}

export async function withScreenState<T>(empty: T, read: () => T): Promise<T> {
  switch (currentScreenState()) {
    case 'loading':
      return new Promise<T>(() => {}); // stays loading
    case 'empty':
      return empty;
    case 'error':
      throw new ScreenStateError();
    default:
      return read();
  }
}

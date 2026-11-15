/** Demo clock: the mockups are set on Monday 16/11/2026 10h13 in São Paulo. */
export const DEMO_NOW = '2026-11-16T10:13:00-03:00';

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';

export function now(): Date {
  return USE_MOCKS ? new Date(DEMO_NOW) : new Date();
}

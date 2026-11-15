/**
 * One tracking helper for the public site. Nothing is sent without analytics consent, and the
 * adapter is a no-op until a provider is chosen. No personal data goes in event properties.
 */
export type TrackEvent =
  | { name: 'page_view'; path: string }
  | { name: 'search'; filters: Record<string, string> }
  | { name: 'form_submit'; form: string }
  | { name: 'signup_step'; step: string };

export type AnalyticsAdapter = { send: (event: TrackEvent) => void };

const CONSENT_KEY = 'casvitta.consent.analytics';
const noopAdapter: AnalyticsAdapter = { send: () => {} };
let adapter: AnalyticsAdapter = noopAdapter;

export function setAnalyticsAdapter(next: AnalyticsAdapter): void {
  adapter = next;
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CONSENT_KEY) === 'granted';
}

export function setAnalyticsConsent(granted: boolean): void {
  window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
}

/** Returns whether the event was handed to the adapter. */
export function track(event: TrackEvent): boolean {
  if (!hasAnalyticsConsent()) return false;
  adapter.send(event);
  return true;
}

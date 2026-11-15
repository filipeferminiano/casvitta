/**
 * Analytics through Google Tag Manager (GTM container in config). Events are pushed to
 * `window.dataLayer` as `{ event, ...params }`; GA4 tags are configured inside GTM
 * (see docs/analytics.md). Product decision: tracking is on by default, no consent banner.
 *
 * Never put personal data in params: no names, phones, emails, CEPs or free text typed by
 * people. Ids are slugs or kinds; money is in reais (GA4 `value`) with `currency: 'BRL'`.
 */
type Money = { value: number; currency: 'BRL' };

export type TrackEvent =
  | {
      name: 'page_view';
      page_path: string;
      page_location: string;
      page_title: string;
      site: string;
    }
  | {
      name: 'search';
      search_term: string;
      transaction: string;
      property_kind: string;
      has_max_price: boolean;
    }
  | {
      name: 'view_search_results';
      search_term: string;
      transaction: string;
      results_count: number;
      invest_mode: boolean;
      filters: string;
    }
  | ({
      name: 'view_item';
      item_id: string;
      item_category: string;
      transaction: string;
      neighborhood: string;
      is_demo: boolean;
    } & Money)
  | { name: 'simulate_financing'; item_id: string; term_months: number; down_payment_pct: number }
  | { name: 'ask_question'; item_id: string; answered_from_record: boolean }
  | { name: 'book_visit'; item_id: string; days_ahead: number }
  | { name: 'save_search'; transaction: string }
  | { name: 'generate_lead'; lead_type: string; page_path: string; marketing_consent: boolean }
  | { name: 'select_plan'; plan: string; location: string }
  | { name: 'signup_step'; step: string }
  | { name: 'sign_up'; method: 'phone'; plan: string }
  | ({ name: 'publish_ad'; channels: string; item_id: string } & Money)
  | { name: 'module_interest'; module: string }
  | { name: 'whatsapp_click'; location: string }
  | { name: string; [param: string]: string | number | boolean };

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/** Pushes the event to GTM's dataLayer. Returns false on the server. */
export function track(event: TrackEvent): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  const { name, ...params } = event;
  w.dataLayer.push({ event: name, ...params });
  return true;
}

/**
 * For events right before a full-page navigation (e.g. the signup handoff to the app host):
 * waits for GTM's `eventCallback`, at most `timeoutMs`, so the hit is not lost.
 */
export function trackBeforeNavigation(event: TrackEvent, timeoutMs = 1000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as DataLayerWindow & { google_tag_manager?: unknown };
  if (!w.google_tag_manager) {
    track(event);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const { name, ...params } = event;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({
      event: name,
      ...params,
      eventCallback: () => {
        window.clearTimeout(timer);
        resolve();
      },
      eventTimeout: timeoutMs,
    });
  });
}

/** Reais from integer cents, for GA4 `value`. */
export const toValue = (cents: number): number => Math.round(cents) / 100;

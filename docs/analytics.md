# Analytics (Google Tag Manager → GA4)

The web app loads the GTM container `NEXT_PUBLIC_GTM_ID` (default `GTM-PNMZRJDN`) on every host:
marketplace, Broker OS (`app.`) and landing pages (`{slug}.`). The code only pushes events to
`window.dataLayer` as `{ event: '<name>', ...params }`. GA4 itself is configured inside GTM.

- Helper: `apps/web/src/lib/analytics.ts` (`track`, `trackBeforeNavigation`, `toValue`).
- Page views and generic clicks: `apps/web/src/components/AnalyticsListener.tsx`.
- Script tags: `apps/web/src/components/GoogleTagManager.tsx`.
- Consent: product decision (Nov 2026), tracking is on by default. Consent Mode v2 defaults are
  set to `granted` and there is no banner.
- CI and e2e builds set `NEXT_PUBLIC_GTM_ID=''`, so no test traffic reaches GA4. The dataLayer
  still receives events, which the e2e tests check.

## Privacy rules for event params

- No names, phones, emails, CEPs or free-text messages. Ids are listing slugs, kinds or plan keys.
- `search_term` is the place typed in the search box (a neighborhood or city).
- Money goes in `value` in reais with `currency: 'BRL'` (GA4 convention).
- On the Broker OS host `page_title` is empty, because titles can contain lead names.

## Events

| Event | When | Params |
|---|---|---|
| `page_view` | Every route change, on all hosts | `page_path`, `page_location`, `page_title`, `site` (`marketplace`/`app`/`landing`) |
| `search` | Home search submitted | `search_term`, `transaction`, `property_kind`, `has_max_price` |
| `view_search_results` | /comprar or /alugar shown, and on every filter change | `search_term`, `transaction`, `results_count`, `invest_mode`, `filters` |
| `save_search` | "Salvar busca" | `transaction` |
| `view_item` | Property page opened | `item_id`, `item_category`, `transaction`, `neighborhood`, `is_demo`, `value`, `currency` |
| `simulate_financing` | First change in a financing simulator | `item_id` (`home` on the home page), `term_months`, `down_payment_pct` |
| `ask_question` | Question asked on a property page | `item_id`, `answered_from_record` |
| `open_assistant_chat` | "Tirar dúvidas" on a property (phone) | `item_id` |
| `begin_visit_booking` | "Agendar visita" | `item_id` |
| `book_visit` | Buyer confirms a slot with the assistant | `item_id`, `days_ahead` |
| `whatsapp_click` | Any wa.me link | `location` (path) |
| `generate_lead` | Any capture form sent (owner, agency, developer, investor, rental admin, auction) | `lead_type` (interest kind), `page_path`, `marketing_consent` |
| `begin_signup` | "Começar com um imóvel" on /para-corretores | `location` |
| `select_plan` | Plan link on /para-corretores, or plan chosen in signup | `plan`, `location` (`for_brokers`/`signup`) |
| `signup_step` | Each signup step shown | `step` |
| `sign_up` | Signup finished, before opening Anúncios | `method` (`phone`), `plan` |
| `publish_ad` | Broker publishes an ad (Anúncios) | `item_id`, `channels`, `value` (daily budget), `currency` |
| `module_interest` | "Quero ser avisado" on an upcoming module | `module` |

Server components track clicks declaratively: `data-track="event_name"` plus `data-track-*`
attributes (`data-track-item-id="x"` becomes param `item_id`).

## GTM container setup (one time, in tagmanager.google.com)

1. **Google tag** with your GA4 measurement ID (`G-…`). Turn off "Send a page view event when
   this configuration loads" (the app sends `page_view` itself, including on client-side route
   changes). Trigger: Initialization – All Pages.
2. **Data Layer Variables** for each param above (`item_id`, `value`, `currency`, `plan`, …).
3. **One GA4 Event tag**: event name `{{Event}}`, event parameters mapped from those variables.
   Trigger: Custom Event, event name matching the regex
   `^(page_view|search|view_search_results|save_search|view_item|simulate_financing|ask_question|open_assistant_chat|begin_visit_booking|book_visit|whatsapp_click|generate_lead|begin_signup|select_plan|signup_step|sign_up|publish_ad|module_interest)$`.
4. In GA4, mark as key events: `generate_lead`, `sign_up`, `book_visit`, `publish_ad`
   (optionally `whatsapp_click`). Register the params as custom dimensions/metrics
   (`lead_type`, `plan`, `site`, `invest_mode`, `results_count`, …).
5. Publish the container. Check with GTM Preview on `http://localhost:3000` (dev uses the real
   container) or GA4 DebugView.

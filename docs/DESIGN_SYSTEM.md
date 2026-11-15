# Casvitta Design System — "Planta"

Source of truth for all UI. The visual idea: the property treated as an architectural project — fine lines, a visible grid, numbers in a monospaced face. Calm, exact, transparent about money. Ink and paper make up ~90% of every screen; blue is only for action; yellow is only for attention and the "Demonstrativo" badge; green/red only carry meaning (paid/confirmed, error), never decoration.

Implement these tokens once in `packages/config/tokens.ts`, export CSS variables in `packages/ui/styles/tokens.css`, and generate the Tailwind preset from them. Components never use raw hex values.

## 1. Color tokens

| Token | Hex | Use |
|---|---|---|
| `ink-900` | `#0F1E3D` | primary text, dark surfaces, user chat bubbles |
| `ink-700` | `#23345A` | secondary dark surfaces, body text on paper in long copy |
| `ink-500` | `#4A5568` | muted text, labels (7.4:1 on white) |
| `ink-300` | `#9AA5B8` | dashed borders, disabled icons (never text) |
| `ink-200` | `#D6DCE5` | lines, card borders |
| `ink-100` | `#EEF1F5` | neutral chips, Kanban column background, segmented control |
| `paper` | `#F5F7FA` | app background |
| `surface` | `#FFFFFF` | cards, panels, inputs |
| `blue-700` | `#1739A6` | link hover, text on blue-50 |
| `blue-600` | `#1D4ED8` | primary action, links, focus ring, progress (white text 6.7:1) |
| `blue-200` | `#BFD0F7` | borders on blue-50 |
| `blue-50` | `#EAF0FD` | selected nav item, AI badge background, info chips |
| `yellow-ink` | `#6B4A00` | text on yellow-50 |
| `yellow-400` | `#F2B23A` | "Demonstrativo" badge, hot-lead stripe, "needs you" marker (text on it is always `ink-900`, never white) |
| `yellow-200` | `#EBCB85` | border on yellow-50 |
| `yellow-50` | `#FDF3DC` | attention panels |
| `green-600` | `#157F4C` | paid, confirmed, published |
| `green-50` | `#E4F3EA` | success chip background |
| `red-600` | `#B42318` | errors, destructive |
| `red-50` | `#FCE9E7` | error panel background |
| `chat-bg` | `#E9EEF5` | WhatsApp thread background |
| `disabled-bg` | `#E7EAF0` | disabled control background |
| `disabled-text` | `#6B7486` | disabled control text |

Single theme (light) for now. Keep tokens semantic (`--color-text`, `--color-action`, …) mapped onto the palette so a dark theme can be added later.

## 2. Typography

Google Fonts, self-hosted via `next/font`:

- **Display:** Familjen Grotesk 500/600/700 — headings, big numbers in marketing, the logotype.
- **Body:** IBM Plex Sans 400/500/600/700 — all UI text.
- **Numeric/code:** IBM Plex Mono 400/500/600 with `font-variant-numeric: tabular-nums` — every price, metric, table number, date-time stamp, CRECI number.

| Style | Font | Size/line | Weight | Tracking |
|---|---|---|---|---|
| display-xl | Familjen | 48/52 | 600 | -0.025em |
| display-l | Familjen | 32/38 | 600 | -0.02em |
| title | Familjen | 22/28 | 600 | 0 |
| body | Plex Sans | 16/24 | 400 | 0 |
| body-s | Plex Sans | 14/20 | 400 | 0 |
| caption | Plex Sans | 12/16 | 400 | 0, color `ink-500` |
| value | Plex Mono | 24/28 | 600 | 0 |
| code | Plex Mono | 13/16 | 400 | 0 |
| eyebrow | Plex Mono | 12/16 | 400 | 0.08em, uppercase, `ink-500` |

Headings use `text-wrap: balance`. Body copy max ~65 characters per line. Numbers right-aligned in tables.

## 3. Layout

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 4 (chips, badges), 6 (buttons, inputs), 10 (cards, panels), 999 (pills).
- Desktop: 1440 reference, 12 columns, 24 gutter, 32 margin; side navigation 264px. Content is fluid; side nav collapses under 1024px; everything stacks at phone width.
- Mobile: 390 reference, 4 columns, 16 gutter, 16 margin; bottom tab bar (Início, Leads, Conversas, Agenda, Anúncios). The UI always says "Anúncios"; "Ads Studio" is an internal name only.
- Consumer surfaces (marketplace, landing pages, buyer chat) are **mobile-first**. Operations surfaces (Broker OS, later Agency OS/FII) are **desktop-first, data-dense**.
- Shadows: almost none. Separate with 1px `ink-200` borders and fills. One elevation level for menus/dialogs.
- Icons: 24px grid, 1.6px stroke, round caps/joins, `currentColor`. Use Lucide icons, adjusted to stroke 1.6. No emoji in UI.

## 4. Logo

Approved: option A, "Casa aberta". The roof and floor draw a C with the right wall open (the house receives whoever arrives); the yellow dot is life inside (vita).

```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Casvitta">
  <path d="M82 44 L50 17 L18 44 L18 84 L82 84" fill="none" stroke="#0F1E3D"
        stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="66" cy="62" r="9" fill="#F2B23A"/>
</svg>
```

- Lockup: mark + "CASVITTA" in Familjen Grotesk 700, tracking +0.02em, gap ≈ 0.3× cap height, mark ≈ 1.15× text size.
- On dark (`ink-900`): mark and text white, dot stays `yellow-400`.
- App icon / favicon: white mark on `ink-900` rounded square (radius 22% of side).
- Ship `packages/ui/assets/logo-mark.svg`, `logo-lockup.svg`, `logo-lockup-white.svg`, favicons (16, 32, 180, 512). Convert the wordmark to outlines for the static assets. Raster lockups (`logo-lockup.png`, `logo-lockup-white.png`) are cropped from the approved board `design/logo-board-option-a.png`.

## 5. Mandatory badges

| Badge | Look | Where |
|---|---|---|
| `Demonstrativo` | `yellow-400` bg, `ink-900` text, 11px bold uppercase, radius 4 | any `is_demo` record or example number |
| `CRECI-SP 000.000-F` | Plex Mono 12px, 1px `ink-900` border, radius 4 | every listing, ad creative, landing page, broker card |
| `Feito por IA` | spark icon + text, `blue-50` bg, `blue-700` text | every AI-generated text, AI chat messages, AI suggestions |
| `Simulação · não é aprovação` | `ink-100` bg, `ink-500` text | every financing number |
| `Em breve` | `ink-100` pill, dashed `ink-300` border on its card | future modules |
| `Destaque pago` | `ink-900` bg, white text | sponsored marketplace listings |

## 6. Components (build in `packages/ui`, each with Storybook stories and all states)

**Foundations:** Button (primary blue / secondary outlined ink / ghost / danger; sizes 44 and 36; loading with spinner + label "Publicando…"; disabled `disabled-bg` (`#E7EAF0`) bg, `disabled-text` (`#6B7486`) text), IconButton (aria-label required), Link, Input with label always visible, help text, error text (red border + message saying how to fix), CurrencyInput (prefix `R$`, cents internally), Select, Checkbox, Radio, Switch, SegmentedControl, Tabs, Badge, Chip, StatusPill, Avatar, Tooltip, Dialog, Sheet (mobile), Toast, Skeleton.

**Domain:**
- `PropertyCard` (marketplace): photo with cover, optional "Destaque pago" and "Demonstrativo", type · neighborhood, price in mono, specs line, broker name + CRECI footer.
- `PropertyRow` (operations list): thumbnail, address, neighborhood · area · price, status pill (No ar / Pausado / Rascunho / Sem autorização), leads · visits counts.
- `LeadCard` (Kanban): name, origin · age, qualification chips, note line, media cost in mono at top right; 4px left stripe `yellow-400` when it needs a human, `ink-200` otherwise.
- `KanbanBoard`: columns Novo, Em qualificação, Qualificado, Visita marcada, Visita feita, Proposta (+ history for Ganho/Perdido); column header with count; drag and keyboard "Mover para…" menu.
- `ChatThread`: `chat-bg` background; lead bubbles white with radius 4/10/10/10; outgoing bubbles `ink-900` white text radius 10/4/10/10; meta line in mono 10.5px ("IA · 14h03"); system events as centered pills ("Qualificação salva no lead"); header shows mode ("IA atendendo" / "Você está no controle"); composer "Escreva para assumir a conversa"; AI draft composer with blue border and "Rascunho da IA · revise antes de enviar".
- `QualificationPanel`: rows Financiamento, FGTS, Entrada, Renda informada, Prazo; footnote "Respostas do lead, não verificadas".
- `FinancingSimulation`: inputs (entrada, FGTS, prazo), result first installment, % of income, rate shown as "taxa ilustrativa", always the simulation badge.
- `Timeline` (lead history): icon circle + mono timestamp + title + detail, vertical rule.
- `CalendarWeek`: day columns × time rows; states confirmed (blue-50, 4px blue left border), awaiting lead (yellow-50, yellow border), free-for-AI (white, dashed `ink-300`), blocked (diagonal hatch), empty.
- `StatTile`: label, mono value, caption; optional 4px blue top border for the highlighted metric.
- `DataTable`: header on `paper`, 1px row rules, numbers right-aligned mono, totals row with 2px `ink-900` top border, horizontal scroll inside its container on small screens.
- `FunnelBars`: label, track `ink-100`, fill blue (green for the final stage), mono value; log scale option with caption.
- `Stepper` (Ads Studio: Imóvel → Anúncio → Publicar): numbered circles, done = green check.
- `ChannelToggle`: switch + name + description + cost note ("incluso" / "do orçamento").
- `BudgetPicker`: free daily amount, minimum R$ 20 (from config), with suggestions R$ 20 / 30 / 50 and one marked "recomendado", explanation box with the range and "não é uma promessa", duration, region, max spend.
- `ModuleCard` (store): states Ativo (green pill, "Gerenciar"), Disponível (2px blue border, primary "Ativar"), Em breve (dashed border, "Quero ser avisado").
- `EmptyState`, `LoadingState` (skeleton + what is happening and how long), `ErrorState` (red-50 panel: what failed, what still works, how to fix, two actions). Every list/screen must implement all three.
- `BrowserFrame` for landing page previews; `PhoneFrame` for mobile previews in Ads Studio.

## 7. Voice

Exact and calm. Examples:
- "3 pessoas pediram visita. Custo até agora: R$ 96."
- "A Meta recusou o anúncio. A foto 3 tem texto acima do limite. O marketplace e o Google seguem no ar."
- "Leads aparecem aqui quando alguém responde a um anúncio seu. Publique o primeiro imóvel para começar."
- Never: "Sua campanha otimizou o CPM", "Crédito aprovado!", exclamation-heavy hype.

## 8. Reference screens

The approved mockups are exported in `docs/mockups/` (PNG + HTML per screen, indexed in its README; deviations in `DEVIATIONS.md`). Screen inventory to reproduce:
- Ads Studio: 1 Selecionar imóvel, 2 Anúncio gerado por IA, 3 Publicar, 5 Painel do anúncio com lead novo, 8 Relatório semanal; mobile M1–M4.
- Marketplace: 4 Detalhe do imóvel (galeria, specs, simulação, contato, pergunte à IA); mobile M5–M7.
- Broker OS: Dashboard, CRM Kanban, Detalhe do lead, Inbox com IA, Agenda, Propostas; mobile Conversas e Agenda.
- Landing pages: broker page (`anaribeiro.casvitta.com.br`) and property page (`…/apto-vila-mariana`).

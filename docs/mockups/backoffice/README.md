# Mockups — internal backoffice

Approved designs from the Casvitta design canvas (page "Backoffice"), desktop 1440 px (the routines map is 1840 px), as `.png` and `.html`. Same rules as `docs/mockups/README.md`. Numbers and names are demo data; the "DADOS REAIS HOJE" / "LIGA DEPOIS" tags say which screens have data in the database today.

| File | Screen | Data today |
|---|---|---|
| `00-routines-map` | The team's seven routines and where each lands in the product | — |
| `01-overview` | BO1 · Visão geral | partial |
| `02-creci-verification` | BO2 · Verificação de CRECI | real (`/admin/brokers`) |
| `03-leads-intake` | BO3 · Captações | real (interest signups, property alerts) |
| `04-accounts` | BO4 · Corretores e imobiliárias | later |
| `05-account-360` | BO5 · Conta (visão 360) | later |
| `06-listing-moderation` | BO6 · Moderação de anúncios | later |
| `07-revenue` | BO7 · Receita (SaaS, anúncios, comissões em breve) | later; plan names follow the config catalog |
| `08-team-audit` | BO8 · Equipe, papéis e auditoria | audit real; staff accounts new |

Build prompt: `docs/prompts/PROMPT_BACKOFFICE_BUILD.md`.

## CRM, agents and broker success (added)

| File | Screen | Data today |
|---|---|---|
| `09-crm-messaging-compliance` | BC0 · What changes in the backoffice with CRM + messaging (consent, Meta quality, conversation access) | later |
| `10-agent-quality` | AG8 · Agent quality per account + global AI rules | later |
| `11-broker-activation-maturity` | BM1 · Onboarding funnel, maturity levels, weekly cohort retention | later |
| `12-brokers-list` | BM2 · Brokers: level, score, 8-week activity, signal, suggested next step | later |
| `13-broker-360` | BM3 · Broker 360: checklist, module usage, signals, next steps, CS contact log | later |
| `14-activation-playbooks` | BM4 · Activation playbooks with holdout and confidence intervals | later |
| `15-maturity-method` | BM5 · How level, score and activity are defined | — |
| `16-network-tests-adoption` | PS9 · Network message tests, guardrails, adoption of alerts/signs/owner reports | later |

Build prompt for these: `docs/prompts/PROMPT_CRM_BUILD.md`.

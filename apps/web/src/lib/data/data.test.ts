/**
 * The mock data layer reproduces the mockups' numbers and enforces the product rules that the
 * API will enforce later.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import * as ads from './ads';
import * as calendar from './calendar';
import * as conversations from './conversations';
import { getDashboard } from './dashboard';
import * as leads from './leads';
import { parseFilters } from '@/lib/search-params';

import * as marketplace from './marketplace';
import * as signup from './signup';
import { mutate } from './store';
import * as modules from './modules';
import { resetDb } from './store';

const mutateBroker = (patch: Record<string, unknown>) =>
  mutate((data) => {
    data.broker = { ...data.broker, ...patch };
  });

beforeEach(() => {
  resetDb();
  window.history.replaceState(null, '', '/');
});

describe('dashboard (mockup 30)', () => {
  it('derives the numbers shown in the mockup from the fixtures', async () => {
    const d = await getDashboard();
    expect(d?.stats).toMatchObject({
      activeLeads: 23,
      newThisWeek: 9,
      visitsThisWeek: 6,
      confirmedThisWeek: 4,
      openProposals: 2,
      commissionCents: 4_032_000,
    });
    expect(d?.funnel.map((f) => f.count)).toEqual([6, 5, 5, 4, 1, 2]);
    expect(d?.needsYou.map((n) => n.kind)).toEqual(['compare_proposals', 'handoff', 'stale_leads']);
    expect(d?.needsYou[2]).toEqual({ kind: 'stale_leads', count: 3 });
    expect(d?.todayAgenda.map((a) => a.id)).toEqual(['appt-rafael', 'appt-captacao', 'appt-carla']);
  });

  it('moving a lead on the Kanban updates the funnel', async () => {
    await leads.moveLead('lead-lucas', 'qualifying');
    const d = await getDashboard();
    expect(d?.funnel.map((f) => f.count)).toEqual([5, 6, 5, 4, 1, 2]);
  });
});

describe('screen states', () => {
  it('?state=empty returns empty data and ?state=error throws', async () => {
    window.history.replaceState(null, '', '/?state=empty');
    expect((await leads.listKanban()).every((c) => c.leads.length === 0)).toBe(true);
    window.history.replaceState(null, '', '/?state=error');
    await expect(leads.listKanban()).rejects.toThrow();
  });
});

describe('conversations', () => {
  it('approving the AI draft sends it as the broker and clears the draft', async () => {
    await conversations.sendMessage('conv-julia', 'Oi, Júlia!');
    const detail = await conversations.getConversation('conv-julia');
    expect(detail?.messages.at(-1)).toMatchObject({ sender: 'human', body: 'Oi, Júlia!' });
    expect(detail?.draft).toBeNull();
  });

  it('take over and hand back switch the AI mode', async () => {
    await conversations.takeOver('conv-lucas');
    expect((await conversations.getConversation('conv-lucas'))?.conversation.aiMode).toBe(
      'handed_off',
    );
    await conversations.handBack('conv-lucas');
    expect((await conversations.getConversation('conv-lucas'))?.conversation.aiMode).toBe('active');
  });
});

describe('calendar', () => {
  it('booking a free slot confirms the visit and moves the lead to "Visita marcada"', async () => {
    const id = await calendar.bookSlot('slot-2', 'lead-lucas');
    const appointment = await calendar.getAppointment(id);
    expect(appointment?.status).toBe('confirmed');
    expect(appointment?.lead?.stage).toBe('visit_booked');
    const week = await calendar.getWeek('2026-11-16');
    expect(week.slots.some((s) => s.id === 'slot-2')).toBe(false);
  });
});

describe('ads (CLAUDE.md §4.2 and §4.10)', () => {
  it('blocks properties without owner authorization', async () => {
    const picker = await ads.listPickerProperties();
    expect(picker.find((p) => p.id === 'prop-perdizes')?.publishable).toBe(false);
    await expect(ads.selectProperty('prop-perdizes')).rejects.toThrow();
  });

  it('publishes with max spend = daily budget × days and refuses budgets under the minimum', async () => {
    await ads.selectProperty('prop-vm');
    await ads.updateDraft({ dailyBudgetCents: 1_500 });
    await expect(ads.publishDraft()).rejects.toThrow();
    await ads.updateDraft({ dailyBudgetCents: 3_000, durationDays: 14 });
    const id = await ads.publishDraft();
    const panel = await ads.getCampaignPanel(id);
    expect(panel?.campaign.maxSpendCents).toBe(42_000);
  });

  it('regenerate cycles through creative variants', async () => {
    await ads.selectProperty('prop-vm');
    const first = await ads.getDraftCreative();
    await ads.regenerateCreative();
    const second = await ads.getDraftCreative();
    expect(second?.creative.id).not.toBe(first?.creative.id);
  });
});

describe('modules (CLAUDE.md §4.9)', () => {
  it('"Em breve" only records interest; it never activates', async () => {
    await modules.registerInterest('contracts');
    const list = await modules.listModules();
    expect(list.find((m) => m.key === 'contracts')).toMatchObject({
      state: 'soon',
      interested: true,
    });
    await expect(modules.activateModule('contracts')).rejects.toThrow();
  });
});

describe('marketplace (CLAUDE.md §4.2, §4.4)', () => {
  it('never exposes a property without authorization', () => {
    expect(marketplace.getListingBySlug('apto-perdizes')).toBeNull();
    expect(marketplace.getListingBySlug('apto-vila-mariana')?.sponsored).toBe(true);
  });

  it('answers only from the record and hands off the rest', () => {
    const p = marketplace.getListingBySlug('apto-vila-mariana')!.property;
    expect(marketplace.answerFromRecord(p, 'Aceita pet?')).toMatchObject({
      kind: 'fact',
      source: 'facts.pets',
    });
    expect(marketplace.answerFromRecord(p, 'Qual o valor do condomínio?')).toMatchObject({
      source: 'condo_fee_cents',
    });
    expect(marketplace.answerFromRecord(p, 'Dá para baixar o preço?')).toEqual({ kind: 'handoff' });
  });

  it('a buyer booking creates a lead in "Visita marcada" and takes the slot', async () => {
    const [slot] = marketplace.offeredSlots();
    await marketplace.bookBuyerVisit('apto-vila-mariana', slot!.id, {
      financingPct: 80,
      fgtsCents: 6_000_000,
      householdIncomeCents: 2_200_000,
    });
    const columns = await leads.listKanban();
    expect(columns.find((c) => c.stage === 'visit_booked')?.leads.length).toBe(5);
    expect(marketplace.offeredSlots().some((s) => s.id === slot!.id)).toBe(false);
  });
});

describe('search (mockup 53, CLAUDE.md rules 2 and 12)', () => {
  const base = parseFilters(new URLSearchParams(), 'sale');

  it('puts sponsored listings first and never shows unauthorized properties', () => {
    const results = marketplace.searchListings(base);
    expect(results[0]?.sponsored).toBe(true);
    expect(results.some((r) => r.property.id === 'prop-perdizes')).toBe(false);
    expect(results.every((r) => r.property.transaction === 'sale')).toBe(true);
  });

  it('filters by place, bedrooms, price and FGTS', () => {
    const results = marketplace.searchListings({
      ...base,
      where: 'Vila Mariana',
      minBedrooms: 2,
      maxPriceCents: 75_000_000,
      fgts: true,
    });
    expect(results.map((r) => r.property.slug)).toEqual([
      'apto-vila-mariana',
      'apto-joaquim-tavora',
      'apto-franca-pinto',
    ]);
    expect(results.every((r) => r.installmentCents && r.installmentCents > 0)).toBe(true);
  });

  it('investor estimates appear only in invest mode and with at least 5 comparables', () => {
    expect(marketplace.searchListings(base).every((r) => r.estimate === null)).toBe(true);
    const invest = marketplace.searchListings({ ...base, invest: true });
    const vm = invest.find((r) => r.property.id === 'prop-vm');
    expect(vm?.estimate).toMatchObject({ monthlyRentCents: 390_000, comparables: 9 });
    expect(vm?.estimate?.grossYield.toFixed(3)).toBe('0.068');
    expect(invest.find((r) => r.property.id === 'mk-5')?.estimate).toBeNull(); // 3 comparables
  });
});

describe('broker signup (CLAUDE.md rule 1)', () => {
  it('a pending CRECI blocks publishing', async () => {
    mutateBroker({ creciVerifiedAt: null });
    await ads.selectProperty('prop-vm');
    await expect(ads.publishDraft()).rejects.toThrow('CRECI not verified');
  });

  it('accepts only the demo code in mock mode and stores the CRECI as pending', () => {
    expect(signup.verifyOtp('123 456')).toBe(true);
    expect(signup.verifyOtp('000000')).toBe(false);
    signup.startSignup('Ana Paula Ribeiro', '+5511927408912');
    const draft = signup.submitCreci({
      name: 'Ana Paula Ribeiro',
      number: '000000',
      state: 'SP',
      kind: 'F',
    });
    expect(draft).toMatchObject({ creciNumber: '000.000-F', creciStatus: 'pending' });
  });
});

'use client';

/**
 * TanStack Query hooks over the data modules. Screens use only these. Every mutation invalidates
 * all queries: one action (e.g. moving a lead) updates every screen that shows the same record.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as ads from './ads';
import * as broker from './broker';
import * as calendar from './calendar';
import * as conversations from './conversations';
import * as dashboard from './dashboard';
import * as leads from './leads';
import * as modules from './modules';
import * as proposals from './proposals';
import * as social from './social';

const q = {
  broker: ['broker'],
  navCounts: ['nav-counts'],
  dashboard: ['dashboard'],
  kanban: ['kanban'],
  lead: (id: string) => ['lead', id],
  inbox: ['inbox'],
  conversation: (id: string) => ['conversation', id],
  week: (start: string, length: number) => ['week', start, length],
  day: (day: string) => ['day', day],
  appointment: (id: string) => ['appointment', id],
  proposals: ['proposals'],
  modules: ['modules'],
  picker: ['ad-picker'],
  adDraft: ['ad-draft'],
  draftCreative: ['ad-draft-creative'],
  campaign: (id: string) => ['campaign', id],
  campaigns: ['campaigns'],
  report: (id: string) => ['report', id],
  social: ['social'],
} as const;

export const useBroker = () => useQuery({ queryKey: q.broker, queryFn: broker.getBroker });
export const useNavCounts = () => useQuery({ queryKey: q.navCounts, queryFn: broker.getNavCounts });
export const useDashboard = () =>
  useQuery({ queryKey: q.dashboard, queryFn: dashboard.getDashboard });
export const useKanban = () => useQuery({ queryKey: q.kanban, queryFn: leads.listKanban });
export const useLeadDetail = (id: string) =>
  useQuery({ queryKey: q.lead(id), queryFn: () => leads.getLeadDetail(id) });
export const useInbox = () =>
  useQuery({ queryKey: q.inbox, queryFn: conversations.listConversations });
export const useConversation = (id: string | null) =>
  useQuery({
    queryKey: q.conversation(id ?? ''),
    queryFn: () => conversations.getConversation(id ?? ''),
    enabled: Boolean(id),
  });
export const useWeek = (start: string, length = 5) =>
  useQuery({ queryKey: q.week(start, length), queryFn: () => calendar.getWeek(start, length) });
export const useDay = (day: string) =>
  useQuery({ queryKey: q.day(day), queryFn: () => calendar.getDay(day) });
export const useAppointment = (id: string) =>
  useQuery({ queryKey: q.appointment(id), queryFn: () => calendar.getAppointment(id) });
export const useProposals = () =>
  useQuery({ queryKey: q.proposals, queryFn: proposals.listPropertiesWithProposals });
export const useModules = () => useQuery({ queryKey: q.modules, queryFn: modules.listModules });
export const usePickerProperties = () =>
  useQuery({ queryKey: q.picker, queryFn: ads.listPickerProperties });
export const useAdDraft = () => useQuery({ queryKey: q.adDraft, queryFn: ads.getAdDraft });
export const useDraftCreative = () =>
  useQuery({ queryKey: q.draftCreative, queryFn: ads.getDraftCreative });
export const useCampaignPanel = (id: string) =>
  useQuery({ queryKey: q.campaign(id), queryFn: () => ads.getCampaignPanel(id) });
export const useCampaigns = () => useQuery({ queryKey: q.campaigns, queryFn: ads.listCampaigns });
export const useReport = (id: string) =>
  useQuery({ queryKey: q.report(id), queryFn: () => ads.getReport(id) });
export const useSocialPosts = () =>
  useQuery({ queryKey: q.social, queryFn: social.listSocialPosts });

/** Wraps a data-layer action as a mutation that refreshes every query on success. */
export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => action(...args),
    onSuccess: () => client.invalidateQueries(),
  });
}

export const actions = {
  moveLead: leads.moveLead,
  markLeadSeen: leads.markLeadSeen,
  takeOver: conversations.takeOver,
  handBack: conversations.handBack,
  sendMessage: conversations.sendMessage,
  discardDraft: conversations.discardDraft,
  markRead: conversations.markRead,
  setAiCanBook: calendar.setAiCanBook,
  bookSlot: calendar.bookSlot,
  registerInterest: modules.registerInterest,
  activateModule: modules.activateModule,
  selectProperty: ads.selectProperty,
  regenerateCreative: ads.regenerateCreative,
  updateDraft: ads.updateDraft,
  publishDraft: ads.publishDraft,
  applySuggestion: ads.applySuggestion,
  approvePost: social.approvePost,
};

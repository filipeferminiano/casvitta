/**
 * Domain types shared by screens and data modules. They follow CLAUDE.md §5 so the data layer can
 * switch from mocks to the generated API client without touching screens.
 *
 * Money is always integer cents. Dates are ISO-8601 strings with offset.
 */

export type Cents = number;
export type ISODateTime = string;
export type ID = string;

// ---------------------------------------------------------------- accounts

export type BrokerProfile = {
  id: ID;
  workspaceId: ID;
  displayName: string;
  firstName: string;
  /** Role line under the name, e.g. "Corretora autônoma". */
  roleLabel: string;
  creciNumber: string; // "000.000-F"
  creciState: string; // "SP"
  creciVerifiedAt: ISODateTime | null;
  slug: string;
  regions: string[];
  phoneE164: string;
  plan: 'essencial' | 'profissional';
  isDemo: boolean;
};

// -------------------------------------------------------------- properties

export type PropertyKind = 'apartment' | 'house' | 'studio';
export type Transaction = 'sale' | 'rent';
export type PropertyStatus = 'live' | 'paused' | 'draft' | 'unauthorized';

export type OwnerAuthorization = {
  kind: 'sale' | 'rental';
  exclusive: boolean;
  signedAt: ISODateTime;
  expiresAt: ISODateTime;
  ownerName: string;
};

export type Property = {
  id: ID;
  workspaceId: ID;
  slug: string;
  kind: PropertyKind;
  transaction: Transaction;
  street: string;
  /** Shown only after a visit is booked. */
  streetNumberHint: string | null;
  unit: string | null;
  neighborhood: string;
  city: string;
  state: string;
  /** Short name used across the app, e.g. "Apto Vila Mariana". */
  shortName: string;
  areaM2: number;
  bedrooms: number;
  parking: number;
  condoFeeCents: Cents | null;
  iptuYearCents: Cents | null;
  /** Sale price, or monthly rent when transaction = rent. */
  priceCents: Cents;
  status: PropertyStatus;
  features: string[];
  photoCount: number;
  hasFloorplan: boolean;
  videoSeconds: number | null;
  nearby: { label: string; distanceM: number } | null;
  /** Facts the owner/broker confirmed, e.g. pets allowed. */
  facts: Record<string, string>;
  authorization: OwnerAuthorization | null;
  /** Map position (WGS84). */
  geo: { lat: number; lng: number } | null;
  createdAt: ISODateTime;
  isDemo: boolean;
};

/** Estimated rent from comparable rentals nearby (CLAUDE.md rule 12). */
export type RentEstimate = { monthlyCents: Cents; comparables: number };

// ------------------------------------------------------------------ people

export type Person = {
  id: ID;
  name: string;
  phoneE164: string;
  /** e.g. "Comprador · casal". */
  profileLabel: string | null;
  consents: {
    purpose: 'contact_about_properties' | 'marketing';
    grantedAt: ISODateTime;
    source: string;
  }[];
};

// ------------------------------------------------------------------- leads

export const STAGES = [
  'new',
  'qualifying',
  'qualified',
  'visit_booked',
  'visit_done',
  'proposal',
] as const;
export type ActiveStage = (typeof STAGES)[number];
export type Stage = ActiveStage | 'won' | 'lost';

export type LeadSource =
  'instagram' | 'facebook' | 'google' | 'marketplace' | 'referral' | 'landing';

export type Qualification = {
  financingPct: number | null;
  usesFgts: boolean | null;
  fgtsCents: Cents | null;
  downPaymentCents: Cents | null;
  householdIncomeCents: Cents | null;
  /** Free text from the lead, e.g. "até 3 meses". */
  timeframe: string | null;
};

export type Lead = {
  id: ID;
  workspaceId: ID;
  propertyId: ID;
  personId: ID;
  source: LeadSource;
  campaignId: ID | null;
  acquisitionCostCents: Cents | null;
  stage: Stage;
  qualification: Qualification;
  /** Yellow stripe: a human must act. */
  needsHuman: boolean;
  /** Short status line on the card, written by the AI or the broker. */
  note: string | null;
  /** Second line on the card, e.g. "IA perguntou se quer propor". */
  followUp: string | null;
  createdAt: ISODateTime;
  lastActivityAt: ISODateTime;
  /** Not opened by the broker yet (nav counter). */
  unseen: boolean;
  isDemo: boolean;
};

export type TimelineEventType =
  | 'arrived'
  | 'qualified'
  | 'visit_booked'
  | 'visit_done'
  | 'message'
  | 'proposal'
  | 'stage_changed';

export type TimelineEvent = {
  id: ID;
  leadId: ID;
  type: TimelineEventType;
  title: string;
  detail: string;
  occurredAt: ISODateTime;
};

// ----------------------------------------------------------- conversations

export type AiMode = 'active' | 'paused' | 'handed_off';
export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'marketplace';

export type Conversation = {
  id: ID;
  leadId: ID;
  channel: Channel;
  aiMode: AiMode;
  handoffReason: string | null;
  unread: number;
  /** Context line under the name, e.g. "visitou em 14/11". */
  context: string | null;
  isDemo: boolean;
};

export type MessageSender = 'lead' | 'ai' | 'human' | 'system';

export type Message = {
  id: ID;
  conversationId: ID;
  sender: MessageSender;
  body: string;
  sentAt: ISODateTime;
};

export type AiDraft = {
  conversationId: ID;
  body: string;
  /** Guardrail note shown under the draft. */
  warning: string | null;
};

export type AiRule = { key: string; label: string; value: 'yes' | 'never' | string };

export type AiRules = { enabled: boolean; rules: AiRule[]; hours: string };

// ---------------------------------------------------------------- calendar

export type SlotKind = 'free_for_ai' | 'blocked';

export type AvailabilitySlot = {
  id: ID;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  kind: SlotKind;
  label: string | null;
};

export type AppointmentStatus = 'proposed' | 'confirmed' | 'done' | 'cancelled' | 'no_show';

export type ReminderKind = 'confirmation' | 'day_before' | 'two_hours' | 'post_visit';
export type Reminder = { at: ISODateTime; kind: ReminderKind; sent: boolean };

export type Appointment = {
  id: ID;
  kind: 'visit' | 'task';
  leadId: ID | null;
  propertyId: ID;
  startsAt: ISODateTime;
  status: AppointmentStatus;
  /** Task title or extra info ("2ª visita"). */
  title: string | null;
  note: string | null;
  bookedByAi: boolean;
  reminders: Reminder[];
};

// --------------------------------------------------------------- proposals

export type Proposal = {
  id: ID;
  leadId: ID;
  propertyId: ID;
  amountCents: Cents;
  payment: 'cash' | 'financed' | 'mixed';
  downPaymentCents: Cents | null;
  condition: string;
  deadlineDays: number;
  status: 'draft' | 'sent_to_owner' | 'countered' | 'accepted' | 'rejected';
  /** Owner's counter-offer, when status = countered. */
  counterAmountCents: Cents | null;
  createdAt: ISODateTime;
};

// ---------------------------------------------------------------------- ads

export type ClaimSource = 'record' | 'map' | 'broker';

export type AdCreative = {
  id: ID;
  propertyId: ID;
  variant: number;
  title: string;
  body: string;
  highlights: string[];
  sources: { claim: string; source: ClaimSource }[];
  generatedByAi: true;
  promptVersion: string;
};

export type AdChannel = 'landing' | 'marketplace' | 'meta' | 'google';

export type CampaignStats = {
  spentCents: Cents;
  day: number;
  reach: number;
  clicks: number;
  conversations: number;
  qualified: number;
  visits: number;
};

export type Campaign = {
  id: ID;
  propertyId: ID;
  creativeId: ID;
  channels: AdChannel[];
  dailyBudgetCents: Cents;
  durationDays: number;
  maxSpendCents: Cents;
  regionLabel: string;
  startsAt: ISODateTime;
  status: 'live' | 'paused' | 'ended';
  stats: CampaignStats;
  /** Current week summary shown on the dashboard. */
  week: {
    number: number;
    days: number;
    spentCents: Cents;
    leads: number;
    visits: number;
    note: string;
  };
};

/** Ads Studio draft for the 3-step flow. */
export type AdDraft = {
  propertyId: ID | null;
  creativeVariant: number;
  /** Broker's edits to the AI text (null = keep the AI version). */
  editedTitle: string | null;
  editedBody: string | null;
  coverPhoto: number;
  channels: AdChannel[];
  dailyBudgetCents: Cents;
  durationDays: number;
};

export type ChannelReportRow = {
  channel: Exclude<AdChannel, 'landing'>;
  spentCents: Cents;
  leads: number;
  qualified: number;
  visits: number;
};

export type WeeklyReport = {
  id: ID;
  campaignId: ID;
  propertyId: ID;
  week: number;
  periodStart: ISODateTime;
  periodEnd: ISODateTime;
  dailyBudgetCents: Cents;
  days: number;
  visitsDone: number;
  rows: ChannelReportRow[];
  leadsPerDay: { day: ISODateTime; leads: number }[];
  suggestion: { body: string; smallSample: string | null };
};

// ------------------------------------------------------------------ social

export type SocialPost = {
  id: ID;
  date: ISODateTime;
  format: 'carousel' | 'reels' | 'post' | 'story';
  title: string;
  channels: ('instagram' | 'facebook')[];
  status: 'suggested' | 'awaiting_approval' | 'scheduled' | 'published';
  scheduledAt: ISODateTime | null;
};

// ----------------------------------------------------------------- modules

export type ModuleState = 'active' | 'available' | 'soon';

export type ModuleItem = {
  key: string;
  name: string;
  description: string;
  state: ModuleState;
  /** Price or plan line in mono, e.g. "Incluído no plano". */
  priceLine: string;
  icon: 'users' | 'sparkles' | 'megaphone' | 'file' | 'building' | 'calendar' | 'shield' | 'home';
};

// ------------------------------------------------------------------ broker signup

export type SignupStep = 'conta' | 'creci' | 'whatsapp' | 'plano' | 'primeiro-imovel';

/** /cadastro draft (mock mode). Real auth and profiles arrive in Milestone 1. */
export type SignupDraft = {
  id: ID;
  name: string;
  phoneE164: string;
  phoneVerified: boolean;
  creciName: string | null;
  creciNumber: string | null;
  creciState: string | null;
  creciKind: 'F' | 'J' | null;
  /** Pending until staff verify it (CLAUDE.md rule 1); publishing stays blocked. */
  creciStatus: 'missing' | 'pending' | 'verified';
  whatsappE164: string | null;
  plan: 'essencial' | 'profissional';
  createdAt: ISODateTime;
};

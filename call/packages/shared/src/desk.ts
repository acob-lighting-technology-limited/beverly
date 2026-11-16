/**
 * Contracts for the call desk: presence, routing, case creation, callbacks, supervision, inbox,
 * customer actions, metrics and admin. Imported by both apps through the package index.
 */
import { z } from 'zod'

/* ---- Languages and presence ---- */
export const languageSchema = z.enum(['en', 'ha', 'yo', 'ig', 'pcm'])
export type LanguageCode = z.infer<typeof languageSchema>
export const LANGUAGE_NAMES: Record<LanguageCode, string> = { en: 'English', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo', pcm: 'Pidgin' }

export const presenceStatusSchema = z.enum(['available', 'busy', 'acw', 'break', 'away'])
export type PresenceStatus = z.infer<typeof presenceStatusSchema>
export const setPresenceSchema = z.object({
  status: presenceStatusSchema,
  languages: z.array(languageSchema).min(1).max(5).default(['en']),
  clientName: z.string().min(1).max(64).optional(),
})
export const presenceRowSchema = z.object({
  agentId: z.string(), name: z.string(), status: presenceStatusSchema, languages: z.array(languageSchema),
  sinceSeconds: z.number().int(), online: z.boolean(),
})
export type PresenceRow = z.infer<typeof presenceRowSchema>

/* ---- Active call ---- */
export const activeCallSchema = z.object({
  id: z.string(), name: z.string(), number: z.string(), startedAt: z.string(), language: languageSchema,
  customer: z.object({ id: z.string(), name: z.string(), meter: z.string(), balance: z.number().nullable() }).nullable(),
  openTickets: z.number().int(), outage: z.string().nullable(),
})
export type ActiveCall = z.infer<typeof activeCallSchema>
export const transferSchema = z.object({ toAgentId: z.string().min(1).max(64), warm: z.boolean().default(false) })
export const noteSchema = z.object({ text: z.string().trim().min(1).max(1000) })
export const callNoteSchema = z.object({ by: z.string(), text: z.string(), at: z.string() })
export type CallNote = z.infer<typeof callNoteSchema>

/* ---- Cases ---- */
export const caseCategorySchema = z.enum(['token_not_received', 'wallet_debited_no_token', 'meter_rejected_token', 'wrong_meter_credited', 'hardware_fault', 'meter_tamper', 'billing_dispute', 'other'])
export type CaseCategory = z.infer<typeof caseCategorySchema>
export const CASE_SLA_MINUTES: Record<CaseCategory, number> = {
  token_not_received: 60, wallet_debited_no_token: 45, meter_rejected_token: 90, wrong_meter_credited: 120,
  hardware_fault: 240, meter_tamper: 120, billing_dispute: 480, other: 480,
}
export const createCaseSchema = z.object({
  category: caseCategorySchema,
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  customerRef: z.string().min(1).max(64),
  customerPhone: z.string().max(32).optional(),
  meterNumber: z.string().max(32).optional(),
  callId: z.string().uuid().optional(),
  amountNgn: z.number().nonnegative().max(100_000_000).default(0),
  notes: z.string().max(1000).optional(),
})
export type CreateCase = z.infer<typeof createCaseSchema>
export const assignCaseSchema = z.object({ agentId: z.string().min(1).max(64) })

export const tokenRevealSchema = z.object({
  purchaseId: z.string().min(1).max(64),
  verified: z.object({ name: z.literal(true), meter: z.literal(true), lastVend: z.literal(true) }),
  reason: z.enum(['Customer asked for the token', 'Resend failed', 'Verified by supervisor']),
})

/* ---- Callbacks ---- */
export const rescheduleSchema = z.object({
  minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(1440)]),
  lastOutcome: z.enum(['No answer', 'Line busy', 'Wrong number', 'Customer asked for later']),
  note: z.string().max(500).default(''),
})
export const createCallbackSchema = z.object({
  phone: z.string().min(5).max(32), customerRef: z.string().max(64).optional(), language: languageSchema.default('en'),
  reason: z.string().max(300).optional(), minutes: z.number().int().min(0).max(10080).default(30),
})
export const callbackFullSchema = z.object({
  id: z.string(), time: z.string(), name: z.string(), language: z.string(), status: z.enum(['Overdue', 'Due', 'Later']),
  phone: z.string(), reason: z.string().nullable(), attempts: z.number().int(), scheduledFor: z.string(),
})
export type CallbackFull = z.infer<typeof callbackFullSchema>

/* ---- Supervision ---- */
export const monitorSchema = z.object({ mode: z.enum(['listen', 'whisper', 'barge', 'end']), agentId: z.string().min(1).max(64) })
export const coachSchema = z.object({ agentId: z.string().min(1).max(64), text: z.string().trim().min(1).max(300) })
export const coachingEntrySchema = z.object({ at: z.string(), text: z.string(), agentId: z.string() })
export type CoachingEntry = z.infer<typeof coachingEntrySchema>
export const qaSchema = z.object({ score: z.number().int().min(0).max(100), notes: z.string().max(500).default('') })
export const qaSampleSchema = z.array(z.object({ callId: z.string(), at: z.string(), agentId: z.string(), score: z.number().int().nullable() }))
export type QaSample = z.infer<typeof qaSampleSchema>

/* ---- Inbox ---- */
export const notificationSchema = z.object({
  key: z.string(), category: z.enum(['esc', 'cb', 'sys']), tone: z.enum(['bad', 'ye', 'ok', 'vi']),
  title: z.string(), body: z.string(), link: z.string().nullable(), at: z.string(), unread: z.boolean(),
})
export type AppNotification = z.infer<typeof notificationSchema>
export const handoverSchema = z.object({ body: z.string().trim().min(1).max(2000) })
export const handoverViewSchema = z.object({ latest: z.object({ by: z.string(), body: z.string(), at: z.string() }).nullable() })
export type HandoverView = z.infer<typeof handoverViewSchema>
export const savedRepliesSchema = z.array(z.string().min(1).max(300)).max(50)
export const DEFAULT_SAVED_REPLIES: string[] = [
  'Thank you for calling. How can I help you today?',
  'I can see your payment. I am sending this to our wallet team now.',
  'Please keep your meter number ready.',
  'Your case number is in the SMS we are sending. It will tell you when it is fixed.',
  'Is there anything else I can help with?',
  'Sorry for the wait. Thank you for your patience.',
]
export const outageSchema = z.object({ area: z.string().min(1).max(80), message: z.string().min(1).max(200), until: z.string().max(40) })
export const outagesSchema = z.array(outageSchema).max(20)
export type Outage = z.infer<typeof outageSchema>
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

/* ---- Customer actions ---- */
export const customerSmsSchema = z.object({ phone: z.string().min(5).max(32), text: z.string().trim().min(1).max(320), customerRef: z.string().max(64).optional() })
export const customerNoteSchema = z.object({ by: z.string(), text: z.string(), at: z.string() })
export const timelineEventSchema = z.object({
  at: z.string(), kind: z.enum(['call', 'case', 'callback', 'note', 'purchase']), text: z.string(), tone: z.enum(['bad', 'ye', 'ok', 'vi']),
})
export type TimelineEvent = z.infer<typeof timelineEventSchema>
export const customerFullSchema = z.object({
  notes: z.array(customerNoteSchema), timeline: z.array(timelineEventSchema),
  stages: z.object({ reported: z.number().int(), escalated: z.number().int(), working: z.number().int(), fixed: z.number().int() }),
  callbacks: z.array(z.object({ id: z.string(), scheduledFor: z.string(), status: z.string() })),
  lastContacted: z.string().nullable(),
})
export type CustomerFull = z.infer<typeof customerFullSchema>

/* ---- Metrics and report extras ---- */
export const metricKeySchema = z.enum(['calls', 'handle_time', 'abandoned', 'service_level', 'open_cases', 'overdue_cases'])
export type MetricKey = z.infer<typeof metricKeySchema>
export const metricPeriodSchema = z.enum(['24h', '7d', '30d'])
export type MetricPeriod = z.infer<typeof metricPeriodSchema>
export const metricSchema = z.object({
  key: metricKeySchema, period: metricPeriodSchema, unit: z.string(), current: z.number(), low: z.number(), avg: z.number(), high: z.number(),
  deltaPct: z.number(), series: z.array(z.object({ label: z.string(), value: z.number() })),
})
export type Metric = z.infer<typeof metricSchema>
export const reportExtrasSchema = z.object({
  heatmap: z.array(z.array(z.number().int())),
  forecast: z.array(z.object({ day: z.string(), calls: z.number().int() })),
  leaderboard: z.array(z.object({ agentId: z.string(), name: z.string(), calls: z.number().int(), avgRating: z.number().nullable() })),
  avgCostNgn: z.number().nullable(),
  serviceLevelPct: z.number().int(), abandonedPct: z.number(),
  languages: z.array(z.object({ language: languageSchema, count: z.number().int() })),
})
export type ReportExtras = z.infer<typeof reportExtrasSchema>

/* ---- Admin ---- */
export const connectionSchema = z.object({ name: z.string(), ok: z.boolean(), detail: z.string() })
export type Connection = z.infer<typeof connectionSchema>
export const staffUserSchema = z.object({ id: z.string(), name: z.string(), role: z.string(), roleLabel: z.string().nullable(), active: z.boolean(), lastLogin: z.string().nullable() })
export type StaffUser = z.infer<typeof staffUserSchema>
export const numberInfoSchema = z.object({ virtualNumber: z.string().nullable(), retentionDays: z.number().int() })

export const walletInfoSchema = z.object({ status: z.string(), currency: z.string(), balance: z.number(), holds: z.number(), available: z.number() })
export type WalletInfo = z.infer<typeof walletInfoSchema>
export const roleSummarySchema = z.object({ roleKey: z.string(), label: z.string(), description: z.string().nullable(), people: z.number().int(), permissions: z.number().int() })
export type RoleSummary = z.infer<typeof roleSummarySchema>

/* ---- Interface languages: the same four locales Beverly uses (packages/tokens/i18n.js). Pidgin stays a SPOKEN language for calls only. ---- */
export const INTERFACE_LOCALES = [
  { code: 'en', label: 'English', nativeLabel: 'English', intl: 'en-NG' },
  { code: 'yo', label: 'Yoruba', nativeLabel: 'Yorùbá', intl: 'yo-NG' },
  { code: 'ha', label: 'Hausa', nativeLabel: 'Hausa', intl: 'ha-NG' },
  { code: 'ig', label: 'Igbo', nativeLabel: 'Igbo', intl: 'ig-NG' },
] as const
export const interfaceLocaleSchema = z.enum(['en', 'yo', 'ha', 'ig'])
export type InterfaceLocale = z.infer<typeof interfaceLocaleSchema>

/* ---- Beverly support tickets (public.support_tickets), worked through Beverly's admin API so its side effects (customer notices, logging) run ---- */
export const supportStatusSchema = z.enum(['open', 'pending', 'awaiting_customer', 'resolved', 'closed'])
export type SupportStatus = z.infer<typeof supportStatusSchema>
export const supportPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
export type SupportPriority = z.infer<typeof supportPrioritySchema>
export const supportTicketSchema = z.object({
  id: z.string(), reference: z.string(), subject: z.string(), category: z.string(), priority: supportPrioritySchema, status: supportStatusSchema,
  requesterType: z.string(), requesterName: z.string(), customerId: z.string().nullable(), assignedTo: z.string().nullable(),
  lastMessageAt: z.string(), createdAt: z.string(), meterContext: z.string().nullable(),
})
export type SupportTicket = z.infer<typeof supportTicketSchema>
export const supportMessageSchema = z.object({ id: z.string(), sender: z.string(), senderType: z.string(), body: z.string(), internal: z.boolean(), at: z.string() })
export type SupportMessage = z.infer<typeof supportMessageSchema>
export const supportTicketDetailSchema = supportTicketSchema.extend({ messages: z.array(supportMessageSchema) })
export type SupportTicketDetail = z.infer<typeof supportTicketDetailSchema>
export const supportStatsSchema = z.object({ total: z.number().int(), open: z.number().int(), pending: z.number().int(), awaiting_customer: z.number().int(), resolved: z.number().int(), closed: z.number().int() })
export type SupportStats = z.infer<typeof supportStatsSchema>
export const supportPatchSchema = z.object({
  status: supportStatusSchema.optional(), priority: supportPrioritySchema.optional(),
  assignToMe: z.boolean().optional(), unassign: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' })
export const supportMessageInputSchema = z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().default(false) })

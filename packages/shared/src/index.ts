/**
 * Contracts shared by apps/web and apps/api. Single source of truth for DTO shapes:
 * the API validates with these schemas, the web app consumes the inferred types.
 */
import { z } from 'zod'

export const roleSchema = z.enum(['agent', 'supervisor', 'admin'])
export type Role = z.infer<typeof roleSchema>

export const screenIdSchema = z.enum(['call', 'cb', 'cust', 'wall', 'cases', 'rec', 'rep', 'admin'])
export type ScreenId = z.infer<typeof screenIdSchema>

export const sessionUserSchema = z.object({ id: z.string().min(1), name: z.string().min(1), role: roleSchema })
export type SessionUser = z.infer<typeof sessionUserSchema>

export const loginRequestSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) })
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const caseStateSchema = z.enum(['Overdue', 'Working', 'New', 'Done'])
export type CaseState = z.infer<typeof caseStateSchema>

export const caseCommentSchema = z.object({ by: z.string(), text: z.string(), at: z.string() })
export type CaseComment = z.infer<typeof caseCommentSchema>

export const supportCaseSchema = z.object({
  id: z.string(),
  issue: z.string(),
  by: z.string(),
  agentId: z.string().nullable(),
  slaMinutes: z.number().int(),
  state: caseStateSchema,
  customer: z.string(),
  amount: z.number().nonnegative(),
  comments: z.array(caseCommentSchema),
})
export type SupportCase = z.infer<typeof supportCaseSchema>

export const addCommentSchema = z.object({ text: z.string().trim().min(1).max(1000) })
export const resolveCaseSchema = z.object({ note: z.string().trim().min(1).max(1000) })

export const callbackSchema = z.object({
  id: z.string(), time: z.string(), name: z.string(), language: z.string(),
  status: z.enum(['Overdue', 'Due', 'Later']),
})
export type Callback = z.infer<typeof callbackSchema>

export const wrapUpSchema = z.object({
  outcome: z.enum(['Resolved on the call', 'Escalated to wallet staff', 'Callback needed', 'Customer dropped']),
  notes: z.string().max(2000).default(''),
})

/* ---- Monitor, review, customers, admin ---- */
export const wallSchema = z.object({
  activeCalls: z.number().int(), waitingCallbacks: z.number().int(), overdueCases: z.number().int(), openCases: z.number().int(),
  longestWaitSeconds: z.number().int(), abandonedPct: z.number(), serviceLevelPct: z.number().int(),
  calls: z.array(z.object({ id: z.string(), agentId: z.string(), agentName: z.string(), caller: z.string(), seconds: z.number().int() })),
  hourly: z.array(z.number().int()),
  alerts: z.array(z.string()),
})
export type WallSnapshot = z.infer<typeof wallSchema>

export const recordingSchema = z.object({
  id: z.string(), date: z.string(), caller: z.string(), agentId: z.string(), seconds: z.number().int(),
  expiresAt: z.string(), legalHold: z.boolean(),
})
export type Recording = z.infer<typeof recordingSchema>

export const reportRangeSchema = z.enum(['1', '7', '30'])
export type ReportRange = z.infer<typeof reportRangeSchema>
export const reportSchema = z.object({
  calls: z.number().int(), avgHandleSeconds: z.number().int(), firstCallResolvedPct: z.number().int(),
  buckets: z.array(z.object({ label: z.string(), calls: z.number().int() })),
  topIssues: z.array(z.object({ issue: z.string(), count: z.number().int() })),
})
export type Report = z.infer<typeof reportSchema>

export const customerSchema = z.object({
  id: z.string(), name: z.string(), meter: z.string(), phone: z.string(), area: z.string(),
  accountType: z.string(), balance: z.number().nullable(),
})
export type Customer = z.infer<typeof customerSchema>

export const auditRowSchema = z.object({ seq: z.number().int(), at: z.string(), actorRole: z.string(), action: z.string(), entity: z.string(), entityId: z.string() })
export type AuditRow = z.infer<typeof auditRowSchema>

/* ---- Admin settings, retention, customer detail ---- */
export const alertLimitsSchema = z.object({
  longestWaitSeconds: z.number().int().min(20).max(180),
  abandonRatePct: z.number().int().min(1).max(15),
  creditDays: z.number().int().min(1).max(14),
})
export type AlertLimits = z.infer<typeof alertLimitsSchema>
export const DEFAULT_ALERT_LIMITS: AlertLimits = { longestWaitSeconds: 60, abandonRatePct: 5, creditDays: 7 }

export const callFlowStepSchema = z.object({ id: z.string().min(1).max(32), title: z.string().min(1).max(40), detail: z.string().max(80) })
export const callFlowSchema = z.array(callFlowStepSchema).min(1).max(12)
export type CallFlowStep = z.infer<typeof callFlowStepSchema>
export const DEFAULT_CALL_FLOW: CallFlowStep[] = [
  { id: 'welcome', title: 'Welcome', detail: 'Recording notice' },
  { id: 'language', title: 'Language', detail: 'EN HA YO IG PCM' },
  { id: 'menu', title: 'Menu', detail: 'Token, Wallet, Vendor, Agent' },
  { id: 'queue', title: 'Queue', detail: 'Topic and language' },
  { id: 'noagent', title: 'No agent', detail: 'Offer callback' },
]

export const retentionSchema = z.object({
  lastRunAt: z.string().nullable(), lastDeleted: z.number().int(), lastHeld: z.number().int(), lastFailed: z.number().int(),
  pendingPurge: z.number().int(), retentionDays: z.number().int(),
})
export type RetentionStatus = z.infer<typeof retentionSchema>

export const purchaseSchema = z.object({
  id: z.string(), at: z.string(), amount: z.number(), status: z.string(), tokenMasked: z.string(),
})
export type Purchase = z.infer<typeof purchaseSchema>

export const customerTicketSchema = z.object({ ref: z.string(), category: z.string(), status: z.string(), createdAt: z.string() })
export const customerDetailSchema = z.object({
  meters: z.array(z.string()),
  purchases: z.array(purchaseSchema), tickets: z.array(customerTicketSchema),
})
export type CustomerDetail = z.infer<typeof customerDetailSchema>

export * from './desk.js'

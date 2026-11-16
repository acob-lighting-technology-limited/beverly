import type { SupportPriority, SupportStatus } from '@beverly-call/shared'

/** Colour for a Beverly purchase status: delivered is good, failed or reversed is bad, anything in progress is a warning. */
export function purchaseTone(status: string): 'ok' | 'bad' | 'ye' {
  if (status === 'delivered') return 'ok'
  if (status === 'failed' || status === 'reversed') return 'bad'
  return 'ye'
}

/** "delivery_pending_review" -> "Delivery pending review". */
export function humanStatus(s: string): string {
  const t = s.replaceAll('_', ' ').trim()
  return t ? t[0]!.toUpperCase() + t.slice(1) : t
}

export const supportStatusTone = (s: SupportStatus): 'ok' | 'bad' | 'ye' | 'vi' =>
  ({ open: 'bad', pending: 'ye', awaiting_customer: 'vi', resolved: 'ok', closed: 'ok' } as const)[s]

export const supportPriorityTone = (p: SupportPriority): 'ok' | 'bad' | 'ye' | 'vi' =>
  ({ low: 'vi', normal: 'ok', high: 'ye', urgent: 'bad' } as const)[p]

/**
 * The call desk stores escalation priority as CRITICAL / HIGH / MEDIUM / LOW (the call_centre schema). Show Beverly's
 * support wording instead (urgent, high, normal, low) so staff see one vocabulary across both systems.
 */
export const escalationPriorityLabel = (p: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string =>
  ({ CRITICAL: 'Urgent', HIGH: 'High', MEDIUM: 'Normal', LOW: 'Low' } as const)[p]

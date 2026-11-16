import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

/**
 * Africa's Talking voice and SMS callbacks (form-encoded). Provider details stay in this file so a different
 * carrier only needs another adapter producing the same CallEvent and SmsEvent.
 */
const rawEvent = z.object({
  sessionId: z.string().min(1),
  isActive: z.enum(['0', '1']),
  direction: z.enum(['inbound', 'outbound']).default('inbound'),
  callerNumber: z.string().min(3).max(32),
  durationInSeconds: z.coerce.number().int().min(0).default(0),
  recordingUrl: z.string().url().optional(),
  dtmfDigits: z.string().max(8).optional(),
  amount: z.string().max(32).optional(),
})

export interface CallEvent {
  sessionId: string
  active: boolean
  direction: 'inbound' | 'outbound'
  callerNumber: string
  durationSeconds: number
  recordingUrl?: string
  dtmfDigits?: string
  costNgn?: number
}

/** "NGN 3.5000" or "3.5" -> 3.5. Returns undefined for other currencies or junk. */
export function parseAmount(raw?: string): number | undefined {
  if (!raw) return undefined
  const m = /^(?:NGN\s*)?(\d+(?:\.\d+)?)$/i.exec(raw.trim())
  return m ? Number(m[1]) : undefined
}

export function parseCallEvent(body: unknown): CallEvent | null {
  const p = rawEvent.safeParse(body)
  if (!p.success) return null
  const e = p.data
  return {
    sessionId: e.sessionId, active: e.isActive === '1', direction: e.direction, callerNumber: e.callerNumber,
    durationSeconds: e.durationInSeconds, recordingUrl: e.recordingUrl, dtmfDigits: e.dtmfDigits, costNgn: parseAmount(e.amount),
  }
}

const rawSms = z.object({ from: z.string().min(3).max(32), text: z.string().max(500), id: z.string().optional() })
export interface SmsEvent { from: string; text: string }
export function parseSmsEvent(body: unknown): SmsEvent | null {
  const p = rawSms.safeParse(body)
  return p.success ? { from: p.data.from, text: p.data.text } : null
}

/** A rating reply is a single digit 1 to 5, optionally with spaces or a full stop. */
export function parseRating(text: string): number | null {
  const m = /^\s*([1-5])\s*\.?\s*$/.exec(text)
  return m ? Number(m[1]) : null
}

/** Constant-time check of the shared secret. */
export function secretMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

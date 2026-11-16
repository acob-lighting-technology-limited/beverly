import type { Pool } from 'pg'
import type { CommunicationsProvider } from '../telephony/provider.js'

export type SmsKind = 'case_resolved' | 'rating_request' | 'agent' | 'callback'

/**
 * Sends an SMS and records it in call_centre.sms_log. The row is written first as "queued", so an attempt is
 * never invisible; its status is then updated to the carrier result or "failed". Never throws: SMS must not break the action that triggered it.
 */
export async function sendLoggedSms(pool: Pool, provider: CommunicationsProvider, to: string, text: string, kind: SmsKind, by: string | null): Promise<'sent' | 'failed' | 'skipped'> {
  const row = await pool.query<{ id: string }>('insert into call_centre.sms_log (to_number, body, kind, created_by) values ($1,$2,$3,$4) returning id', [to, text, kind, by])
  const id = row.rows[0]!.id
  if (!provider.configured) {
    await pool.query(`update call_centre.sms_log set status = 'skipped: carrier not configured' where id = $1`, [id])
    return 'skipped'
  }
  try {
    const r = await provider.sendSms(to, text)
    await pool.query('update call_centre.sms_log set status = $2, provider_ref = $3 where id = $1', [id, r.status, r.ref])
    return 'sent'
  } catch {
    await pool.query(`update call_centre.sms_log set status = 'failed' where id = $1`, [id])
    return 'failed'
  }
}

/** Customer-facing wording, kept in one place. */
export const resolvedSms = (ref: string, rate: boolean): string =>
  `Your case ${ref} is fixed.${rate ? ' How was our service? Reply 1 to 5.' : ''}`

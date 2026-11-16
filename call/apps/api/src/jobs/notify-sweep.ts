import type { Pool } from 'pg'
import { notify, type PushSender } from '../notify/notify.js'

/**
 * Creates alerts for newly overdue cases, callbacks due soon and recordings waiting too long to ingest.
 * Idempotent: dedupe keys mean each event alerts once, so the job can run every minute.
 */
export async function notifySweep(pool: Pool, send: PushSender | null): Promise<number> {
  let created = 0
  const over = await pool.query<{ ticket_ref: string; category: string; agent_crm_id: string | null }>(
    `select ticket_ref, category, agent_crm_id from call_centre.tickets
     where status in ('OPEN','INVESTIGATING') and sla_due_at < now()`)
  for (const t of over.rows) {
    if (await notify(pool, send, { userId: t.agent_crm_id, category: 'esc', tone: 'bad', title: `${t.ticket_ref} is past its deadline`, body: t.category.replaceAll('_', ' '), link: '/cases', dedupeKey: `overdue:${t.ticket_ref}` })) created++
  }
  const due = await pool.query<{ callback_ref: string; phone_number: string; assigned_to_crm_id: string | null }>(
    `select callback_ref, phone_number, assigned_to_crm_id from call_centre.callbacks
     where status in ('pending','assigned') and scheduled_for <= now() + interval '15 minutes'`)
  for (const c of due.rows) {
    if (await notify(pool, send, { userId: c.assigned_to_crm_id, category: 'cb', tone: 'ye', title: 'Callback due soon', body: c.phone_number, link: '/cb', dedupeKey: `cbdue:${c.callback_ref}` })) created++
  }
  const stuck = await pool.query<{ n: string }>(
    `select count(*) n from call_centre.recordings where ingested_at is null and deleted_at is null and source_url is not null and created_at < now() - interval '1 hour'`)
  if (Number(stuck.rows[0]?.n ?? 0) > 0) {
    const hour = new Date().toISOString().slice(0, 13)
    if (await notify(pool, send, { category: 'sys', tone: 'ye', title: 'Recordings are not being saved', body: `${stuck.rows[0]!.n} waiting more than an hour`, link: '/rec', dedupeKey: `ingest-stuck:${hour}` })) created++
  }
  return created
}

import { createRequire } from 'node:module'
import type { Pool } from 'pg'
import type { Env } from '../config/env.js'

// web-push is CommonJS with no default export under Node ESM, so load it through require.
const webpush = createRequire(import.meta.url)('web-push') as typeof import('web-push')

export interface NewNotification {
  userId?: string | null            // null or undefined = everyone with the call portal
  category: 'esc' | 'cb' | 'sys'
  tone?: 'bad' | 'ye' | 'ok' | 'vi'
  title: string
  body?: string
  link?: string
  dedupeKey?: string
}

/** Sends a payload to every saved subscription for the user. Dead subscriptions (404 or 410) are removed. */
export type PushSender = (sub: { endpoint: string; p256dh: string; auth: string }, payload: string) => Promise<void>

export function webPushSender(env: Env): PushSender | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  return async (s, payload) => { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload) }
}

/**
 * Stores a notification (once per dedupeKey) and, when push is configured, delivers it to the target's devices.
 * Returns true when a new notification was created.
 */
export async function notify(pool: Pool, send: PushSender | null, n: NewNotification): Promise<boolean> {
  const r = await pool.query(
    `insert into call_centre.notifications (user_crm_id, category, tone, title, body, link, dedupe_key)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (dedupe_key) do nothing returning id`,
    [n.userId ?? null, n.category, n.tone ?? 'vi', n.title, n.body ?? '', n.link ?? null, n.dedupeKey ?? null])
  if (!r.rowCount) return false
  if (send) {
    const subs = await pool.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      n.userId ? 'select id, endpoint, p256dh, auth from call_centre.push_subscriptions where user_crm_id = $1' : 'select id, endpoint, p256dh, auth from call_centre.push_subscriptions',
      n.userId ? [n.userId] : [])
    const payload = JSON.stringify({ title: n.title, body: n.body ?? '', link: n.link ?? '/' })
    for (const s of subs.rows) {
      try { await send(s, payload) }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await pool.query('delete from call_centre.push_subscriptions where id = $1', [s.id])
      }
    }
  }
  return true
}

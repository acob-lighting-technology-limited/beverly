import { z } from 'zod'
import type { SupportMessage, SupportStats, SupportTicket, SupportTicketDetail } from '@beverly-call/shared'
import { supportPrioritySchema, supportStatusSchema } from '@beverly-call/shared'
import type { Env } from '../config/env.js'
import { BeverlyError } from './beverly-api.js'
import type { FetchLike } from './beverly-auth.js'

/**
 * Beverly's customer support tickets (public.support_tickets), worked through Beverly's own admin API with the agent's
 * token rather than by writing to the table. Beverly's service layer does the side effects (customer notices on public replies,
 * action logging), and the role permission `wallet.support.manage` decides who may do this.
 *   GET   /api/v1/admin/support/tickets?status&search&assigned=me   -> { tickets: [...] }
 *   GET   /api/v1/admin/support/tickets/:id                          -> ticket + support_ticket_messages
 *   PATCH /api/v1/admin/support/tickets/:id { status, priority, assign_to_me, unassign }
 *   POST  /api/v1/admin/support/tickets/:id/messages { body, internal }
 *   GET   /api/v1/admin/support/tickets/stats
 */
const row = z.object({
  id: z.string(), reference: z.string(), subject: z.string(), category: z.string().nullish(),
  priority: supportPrioritySchema.catch('normal'), status: supportStatusSchema.catch('open'),
  requester_actor_type: z.string().nullish(), requester_name: z.string().nullish(), customer_id: z.string().nullish(),
  assigned_to_user_id: z.string().nullish(), last_message_at: z.string().nullish(), created_at: z.string().nullish(), meter_context: z.unknown().nullish(),
}).passthrough()
const msg = z.object({ id: z.string(), sender_actor_type: z.string().nullish(), sender_name: z.string().nullish(), body: z.string(), is_internal: z.boolean().nullish(), created_at: z.string() }).passthrough()
const list = z.object({ tickets: z.array(row) })
const detail = row.extend({ support_ticket_messages: z.array(msg).default([]) })
const stats = z.object({ total: z.number(), open: z.number(), pending: z.number(), awaiting_customer: z.number(), resolved: z.number(), closed: z.number() })

/** Meter context is free-form JSON; show the meter number when there is one. */
function meterOf(ctx: unknown): string | null {
  if (typeof ctx === 'string') return ctx || null
  if (ctx && typeof ctx === 'object') {
    const o = ctx as Record<string, unknown>
    const v = o.meter_id ?? o.meterId ?? o.meterNumber ?? o.meter
    return typeof v === 'string' || typeof v === 'number' ? String(v) : null
  }
  return null
}

const toTicket = (r: z.infer<typeof row>): SupportTicket => ({
  id: r.id, reference: r.reference, subject: r.subject, category: r.category ?? 'general', priority: r.priority, status: r.status,
  requesterType: r.requester_actor_type ?? 'customer', requesterName: r.requester_name ?? 'Customer', customerId: r.customer_id ?? null,
  assignedTo: r.assigned_to_user_id ?? null, lastMessageAt: r.last_message_at ?? r.created_at ?? '', createdAt: r.created_at ?? '', meterContext: meterOf(r.meter_context),
})
const toMessage = (m: z.infer<typeof msg>): SupportMessage => ({
  id: m.id, sender: m.sender_name ?? m.sender_actor_type ?? 'Unknown', senderType: m.sender_actor_type ?? 'unknown', body: m.body, internal: Boolean(m.is_internal), at: m.created_at,
})

async function call(env: Env, token: string, method: string, path: string, f: FetchLike, body?: unknown): Promise<unknown> {
  const r = await f(`${env.BEVERLY_API_URL}/api/v1/admin/support${path}`, {
    method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (r.status === 404) throw new BeverlyError(404, 'Ticket not found')
  if (r.status === 401 || r.status === 403) throw new BeverlyError(r.status, 'Beverly refused this action')
  if (r.status === 400) throw new BeverlyError(400, 'Beverly rejected that change')
  if (!r.ok) throw new BeverlyError(502, 'Beverly support is unavailable')
  return r.status === 204 ? null : r.json()
}

export async function listSupportTickets(env: Env, token: string, q: { status?: string; search?: string; mine?: boolean }, f: FetchLike = fetch): Promise<SupportTicket[]> {
  const qs = new URLSearchParams()
  if (q.status) qs.set('status', q.status)
  if (q.search) qs.set('search', q.search.slice(0, 80))
  if (q.mine) qs.set('assigned', 'me')
  const p = list.safeParse(await call(env, token, 'GET', `/tickets${qs.size ? `?${qs}` : ''}`, f))
  if (!p.success) throw new BeverlyError(502, 'Unexpected ticket list')
  return p.data.tickets.map(toTicket)
}

export async function getSupportTicket(env: Env, token: string, id: string, f: FetchLike = fetch): Promise<SupportTicketDetail> {
  const p = detail.safeParse(await call(env, token, 'GET', `/tickets/${encodeURIComponent(id)}`, f))
  if (!p.success) throw new BeverlyError(502, 'Unexpected ticket')
  return { ...toTicket(p.data), messages: p.data.support_ticket_messages.map(toMessage) }
}

export async function supportStats(env: Env, token: string, f: FetchLike = fetch): Promise<SupportStats> {
  const p = stats.safeParse(await call(env, token, 'GET', '/tickets/stats', f))
  if (!p.success) throw new BeverlyError(502, 'Unexpected ticket stats')
  return p.data
}

export async function patchSupportTicket(env: Env, token: string, id: string, v: { status?: string; priority?: string; assignToMe?: boolean; unassign?: boolean }, f: FetchLike = fetch): Promise<void> {
  await call(env, token, 'PATCH', `/tickets/${encodeURIComponent(id)}`, f, { status: v.status, priority: v.priority, assign_to_me: v.assignToMe, unassign: v.unassign })
}

export async function postSupportMessage(env: Env, token: string, id: string, v: { body: string; internal: boolean }, f: FetchLike = fetch): Promise<void> {
  await call(env, token, 'POST', `/tickets/${encodeURIComponent(id)}/messages`, f, { body: v.body, internal: v.internal })
}

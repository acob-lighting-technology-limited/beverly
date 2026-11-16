import type { FastifyPluginAsync } from 'fastify'
import type { ZodTypeAny } from 'zod'
import { z } from 'zod'
import {
  DEFAULT_ALERT_LIMITS, DEFAULT_CALL_FLOW, DEFAULT_SAVED_REPLIES, alertLimitsSchema, callFlowSchema, outagesSchema, savedRepliesSchema,
  type Connection, type RetentionStatus, type StaffUser,
} from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { verifyStoredChain } from '../audit/audit-log.js'
import { africasTalking } from '../telephony/provider.js'

const SETTINGS: Record<string, { schema: ZodTypeAny; fallback: unknown }> = {
  alert_limits: { schema: alertLimitsSchema, fallback: DEFAULT_ALERT_LIMITS },
  call_flow: { schema: callFlowSchema, fallback: DEFAULT_CALL_FLOW },
  saved_replies: { schema: savedRepliesSchema, fallback: DEFAULT_SAVED_REPLIES },
  outages: { schema: outagesSchema, fallback: [] },
}

const staffRow = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  full_name: z.string().optional(), name: z.string().optional(), email: z.string().optional(),
  role_key: z.string().optional(), role: z.string().optional(),
  is_active: z.boolean().optional(), active: z.boolean().optional(),
  last_login_at: z.string().nullable().optional(), last_sign_in_at: z.string().nullable().optional(),
  portal_access: z.array(z.string()).optional(),
}).passthrough()

/** Admin configuration, health and evidence. Reads are open to supervisors where they need them; writes are admin only. */
export const adminRoutes = ({ env, pool, fetchImpl, provider }: AppDeps): FastifyPluginAsync => async (app) => {
  const f = fetchImpl ?? fetch
  const carrier = provider ?? africasTalking(env, fetchImpl)
  const admin = requireRole('admin')

  app.get<{ Params: { key: string } }>('/admin/settings/:key', { preHandler: requireRole('supervisor', 'admin') }, async (req, reply) => {
    const def = SETTINGS[req.params.key]
    if (!def) return reply.code(404).send({ error: 'Unknown setting' })
    const r = await pool.query<{ value: unknown }>('select value from call_centre.settings where key = $1', [req.params.key])
    const parsed = def.schema.safeParse(r.rows[0]?.value)
    return parsed.success ? parsed.data : def.fallback
  })

  app.put<{ Params: { key: string } }>('/admin/settings/:key', { preHandler: admin }, async (req, reply) => {
    const def = SETTINGS[req.params.key]
    if (!def) return reply.code(404).send({ error: 'Unknown setting' })
    const body = def.schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid value' })
    await pool.query(
      `insert into call_centre.settings (key, value, updated_by) values ($1,$2,$3)
       on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
      [req.params.key, JSON.stringify(body.data), req.session!.user.id])
    await auditAs(pool, req, 'settings.update', 'settings', req.params.key)
    return body.data
  })

  app.get('/admin/retention', { preHandler: admin }, async (): Promise<RetentionStatus> => {
    const [last, pending] = await Promise.all([
      pool.query<{ ran_at: Date; deleted_count: number; held_count: number; failed_count: number }>(
        'select ran_at, deleted_count, held_count, failed_count from call_centre.retention_runs order by ran_at desc limit 1'),
      pool.query<{ n: string }>('select count(*) n from call_centre.recordings where deleted_at is null and legal_hold = false and expires_at < now()'),
    ])
    const l = last.rows[0]
    return {
      lastRunAt: l ? l.ran_at.toISOString() : null, lastDeleted: l?.deleted_count ?? 0, lastHeld: l?.held_count ?? 0, lastFailed: l?.failed_count ?? 0,
      pendingPurge: Number(pending.rows[0]?.n ?? 0), retentionDays: env.RECORDING_RETENTION_DAYS,
    }
  })

  /** Re-verifies the whole hash chain on demand. The daily `verify-audit` job does the same and fails loudly. */
  app.get('/admin/audit/verify', { preHandler: admin }, async () => verifyStoredChain(pool))

  app.get('/admin/number', { preHandler: admin }, async () => ({ virtualNumber: env.AT_VIRTUAL_NUMBER ?? null, retentionDays: env.RECORDING_RETENTION_DAYS }))

  /** Live health of every dependency, so an admin can see what is connected without reading logs. */
  app.get('/admin/connections', { preHandler: admin }, async (): Promise<Connection[]> => {
    const out: Connection[] = []
    try { await pool.query('select 1'); out.push({ name: 'Database', ok: true, detail: 'Connected' }) }
    catch { out.push({ name: 'Database', ok: false, detail: 'Unreachable' }) }
    try {
      const r = await f(`${env.BEVERLY_AUTH_URL}/auth/v1/health`, { headers: { apikey: env.BEVERLY_AUTH_ANON_KEY } })
      out.push({ name: 'Beverly sign-on', ok: r.ok, detail: r.ok ? 'Connected' : `HTTP ${r.status}` })
    } catch { out.push({ name: 'Beverly sign-on', ok: false, detail: 'Unreachable' }) }
    const hb = await pool.query<{ last_seen: Date }>(`select last_seen from call_centre.webhook_heartbeat where provider = 'africastalking'`)
    const seen = hb.rows[0]?.last_seen
    out.push({ name: 'Carrier webhooks', ok: Boolean(env.AT_WEBHOOK_SECRET) && Boolean(seen), detail: !env.AT_WEBHOOK_SECRET ? 'Secret not set' : seen ? `Last event ${seen.toISOString()}` : 'Test needed: no events yet' })
    out.push({ name: 'Carrier API (SMS, calls, softphone)', ok: carrier.configured, detail: carrier.configured ? 'Credentials set' : 'AT_API_KEY or AT_USERNAME not set' })
    out.push({ name: 'Recording storage', ok: Boolean(env.RECORDINGS_STORAGE_URL && env.RECORDINGS_STORAGE_KEY), detail: env.RECORDINGS_STORAGE_URL ? 'Configured' : 'Not configured' })
    out.push({ name: 'Push alerts', ok: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY), detail: env.VAPID_PUBLIC_KEY ? 'Configured' : 'VAPID keys not set' })
    return out
  })

  /**
   * Staff who can use Beverly Call. Identity is owned by Beverly (roles, portal access, activation, password resets are managed there),
   * so this is read-only. TODO(debt): endpoint and field names assumed (GET /api/v1/admin/staff); confirm with the Beverly team.
   */
  app.get('/admin/users', { preHandler: admin }, async (req, reply): Promise<StaffUser[] | void> => {
    const r = await f(`${env.BEVERLY_API_URL}/api/v1/admin/staff?limit=500`, { headers: { authorization: `Bearer ${req.session!.beverlyToken}` } })
    if (!r.ok) return reply.code(502).send({ error: 'Beverly staff list is unavailable' })
    const raw = (await r.json()) as { data?: unknown[] } | unknown[]
    const list = z.array(staffRow).safeParse(Array.isArray(raw) ? raw : raw.data ?? [])
    if (!list.success) return reply.code(502).send({ error: 'Unexpected staff response' })
    return list.data
      .filter((s) => !s.portal_access || s.portal_access.includes('call'))
      .map((s) => ({ id: s.id, name: s.full_name ?? s.name ?? s.email ?? s.id, role: s.role_key ?? s.role ?? 'unknown', active: s.is_active ?? s.active ?? true, lastLogin: s.last_login_at ?? s.last_sign_in_at ?? null }))
  })
}

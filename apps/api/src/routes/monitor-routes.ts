import type { FastifyPluginAsync } from 'fastify'
import { DEFAULT_ALERT_LIMITS, alertLimitsSchema, metricKeySchema, metricPeriodSchema, reportRangeSchema, type AuditRow, type LanguageCode, type Metric, type MetricKey, type Recording, type Report, type ReportExtras, type WallSnapshot } from '@beverly-call/shared'
import type { AppDeps } from '../app.js'
import { requireRole } from '../auth/guards.js'
import { auditAs } from '../audit/audit-request.js'
import { staffNames } from '../beverly/staff-directory.js'
import { StorageUnavailable, supabaseRecordingStorage } from '../storage/recording-storage.js'

const SL_SECONDS = 20   // service level: answered within this many seconds

/** Read-only monitoring, review, metrics and audit endpoints for supervisors and admins. */
export const monitorRoutes = ({ env, pool, fetchImpl, storage }: AppDeps): FastifyPluginAsync => async (app) => {
  const lead = requireRole('supervisor', 'admin')

  app.get('/wall', { preHandler: lead }, async (req): Promise<WallSnapshot> => {
    const names = await staffNames(env, req.session!.beverlyToken, fetchImpl, pool)
    const [calls, cb, cases, today, hourly, limitsRow] = await Promise.all([
      pool.query<{ id: string; agent_crm_id: string | null; caller_number: string; secs: string }>(
        `select id, agent_crm_id, caller_number, extract(epoch from now() - started_at)::int as secs
         from call_centre.calls where ended_at is null order by started_at limit 100`),
      pool.query<{ n: string }>(`select count(*) n from call_centre.callbacks where status in ('pending','assigned')`),
      pool.query<{ open: string; overdue: string }>(
        `select count(*) filter (where status in ('OPEN','INVESTIGATING')) open,
                count(*) filter (where status in ('OPEN','INVESTIGATING') and sla_due_at < now()) overdue from call_centre.tickets`),
      pool.query<{ total: string; abandoned: string; sl: string }>(
        `select count(*) total,
                count(*) filter (where answered_at is null and ended_at is not null) abandoned,
                count(*) filter (where answered_at is not null and answered_at - started_at <= ($1 || ' seconds')::interval) sl
         from call_centre.calls where started_at >= date_trunc('day', now())`, [SL_SECONDS]),
      pool.query<{ h: number; n: string }>(`select extract(hour from started_at)::int h, count(*) n from call_centre.calls where started_at >= date_trunc('day', now()) group by 1`),
      pool.query<{ value: unknown }>(`select value from call_centre.settings where key = 'alert_limits'`),
    ])
    const limits = alertLimitsSchema.safeParse(limitsRow.rows[0]?.value).data ?? DEFAULT_ALERT_LIMITS
    const total = Number(today.rows[0]?.total ?? 0)
    const abandonedPct = total ? Math.round((Number(today.rows[0]?.abandoned ?? 0) / total) * 1000) / 10 : 0
    const serviceLevelPct = total ? Math.round((Number(today.rows[0]?.sl ?? 0) / total) * 100) : 100
    const waits = await pool.query<{ w: number | null }>(`select max(extract(epoch from now() - started_at))::int w from call_centre.calls where ended_at is null and answered_at is null`)
    const longestWaitSeconds = waits.rows[0]?.w ?? 0
    const overdue = Number(cases.rows[0]?.overdue ?? 0)
    const alerts: string[] = []
    if (longestWaitSeconds > limits.longestWaitSeconds) alerts.push(`A caller has waited ${longestWaitSeconds}s (limit ${limits.longestWaitSeconds}s)`)
    if (abandonedPct > limits.abandonRatePct) alerts.push(`Abandon rate ${abandonedPct}% is above ${limits.abandonRatePct}%`)
    if (overdue) alerts.push(`${overdue} case${overdue > 1 ? 's' : ''} past SLA`)
    const hours = Array<number>(24).fill(0)
    for (const h of hourly.rows) hours[h.h] = Number(h.n)
    return {
      activeCalls: calls.rows.length, waitingCallbacks: Number(cb.rows[0]?.n ?? 0), openCases: Number(cases.rows[0]?.open ?? 0), overdueCases: overdue,
      longestWaitSeconds, abandonedPct, serviceLevelPct, hourly: hours, alerts,
      calls: calls.rows.map((r) => ({ id: r.id, agentId: r.agent_crm_id ?? '', agentName: r.agent_crm_id ? names.get(r.agent_crm_id) ?? r.agent_crm_id : 'Unassigned', caller: r.caller_number, seconds: Number(r.secs) })),
    }
  })

  app.get('/recordings', { preHandler: lead }, async (req): Promise<Recording[]> => {
    const r = await pool.query<{ id: string; started_at: Date; caller_number: string; agent_crm_id: string | null; duration_seconds: number; expires_at: Date; legal_hold: boolean }>(
      `select r.id, c.started_at, c.caller_number, c.agent_crm_id, r.duration_seconds, r.expires_at, r.legal_hold
       from call_centre.recordings r join call_centre.calls c on c.id = r.call_id
       where r.deleted_at is null order by c.started_at desc limit 200`)
    await auditAs(pool, req, 'recording.list', 'recording', 'list')
    return r.rows.map((x) => ({ id: x.id, date: x.started_at.toISOString(), caller: x.caller_number, agentId: x.agent_crm_id ?? 'Unassigned', seconds: x.duration_seconds, expiresAt: x.expires_at.toISOString(), legalHold: x.legal_hold }))
  })

  /** Hold a recording for legal review (exempt from purge) or release the hold. */
  app.post<{ Params: { id: string }; Body: { hold?: boolean } }>('/recordings/:id/hold', { preHandler: lead }, async (req, reply) => {
    const hold = (req.body as { hold?: unknown } | null)?.hold
    if (typeof hold !== 'boolean') return reply.code(400).send({ error: 'hold must be true or false' })
    const r = await pool.query('update call_centre.recordings set legal_hold = $2 where id = $1 and deleted_at is null returning id', [req.params.id, hold])
    if (!r.rowCount) return reply.code(404).send({ error: 'Recording not found' })
    await auditAs(pool, req, hold ? 'recording.hold' : 'recording.release', 'recording', req.params.id)
    return reply.code(204).send()
  })

  /** Short-lived signed URL. Every playback is audited; the file never passes through this API. */
  app.get<{ Params: { id: string } }>('/recordings/:id/url', { preHandler: lead }, async (req, reply) => {
    const r = await pool.query<{ storage_bucket: string; storage_key: string; ingested_at: Date | null }>(
      'select storage_bucket, storage_key, ingested_at from call_centre.recordings where id = $1 and deleted_at is null', [req.params.id])
    const rec = r.rows[0]
    if (!rec) return reply.code(404).send({ error: 'Recording not found' })
    if (!rec.ingested_at) return reply.code(409).send({ error: 'This recording is still being saved' })
    try {
      const url = await (storage ?? supabaseRecordingStorage(env)).signedUrl(rec.storage_bucket, rec.storage_key, 300)
      await auditAs(pool, req, 'recording.play', 'recording', req.params.id)
      return { url }
    } catch (e) {
      if (e instanceof StorageUnavailable) return reply.code(503).send({ error: 'Playback is unavailable' })
      throw e
    }
  })

  app.get<{ Querystring: { range?: string } }>('/reports', { preHandler: lead }, async (req, reply): Promise<Report | void> => {
    const range = reportRangeSchema.safeParse(req.query.range ?? '1')
    if (!range.success) return reply.code(400).send({ error: 'range must be 1, 7 or 30' })
    const days = Number(range.data)
    const unit = days === 1 ? 'hour' : 'day'
    const [tot, buckets, issues] = await Promise.all([
      pool.query<{ n: string; avg: string | null; fcr: string }>(
        `select count(*) n, avg(extract(epoch from ended_at - started_at))::int avg,
                count(*) filter (where disposition = 'Resolved on the call') fcr
         from call_centre.calls where started_at > now() - ($1 || ' days')::interval`, [days]),
      pool.query<{ label: string; n: string }>(
        `select to_char(date_trunc('${unit}', started_at), '${unit === 'hour' ? 'HH24' : 'Dy DD'}') label, count(*) n
         from call_centre.calls where started_at > now() - ($1 || ' days')::interval
         group by date_trunc('${unit}', started_at) order by date_trunc('${unit}', started_at)`, [days]),
      pool.query<{ category: string; n: string }>(
        `select category, count(*) n from call_centre.tickets where created_at > now() - ($1 || ' days')::interval
         group by category order by n desc limit 5`, [days]),
    ])
    const n = Number(tot.rows[0]?.n ?? 0)
    return {
      calls: n, avgHandleSeconds: Number(tot.rows[0]?.avg ?? 0),
      firstCallResolvedPct: n ? Math.round((Number(tot.rows[0]?.fcr ?? 0) / n) * 100) : 0,
      buckets: buckets.rows.map((b) => ({ label: b.label, calls: Number(b.n) })),
      topIssues: issues.rows.map((i) => ({ issue: i.category.replaceAll('_', ' '), count: Number(i.n) })),
    }
  })

  /** Busy-hours heatmap, 7-day forecast, leaderboard, cost per call, service level and language mix. */
  app.get<{ Querystring: { range?: string } }>('/reports/extras', { preHandler: lead }, async (req, reply): Promise<ReportExtras | void> => {
    const range = reportRangeSchema.safeParse(req.query.range ?? '7')
    if (!range.success) return reply.code(400).send({ error: 'range must be 1, 7 or 30' })
    const days = Number(range.data)
    const names = await staffNames(env, req.session!.beverlyToken, fetchImpl, pool)
    const [heat, kpi, board, langs] = await Promise.all([
      pool.query<{ dow: number; h: number; n: string }>(
        `select extract(isodow from started_at)::int dow, extract(hour from started_at)::int h, count(*) n from call_centre.calls
         where started_at > now() - interval '28 days' group by 1, 2`),
      pool.query<{ total: string; abandoned: string; sl: string; cost: string | null }>(
        `select count(*) total, count(*) filter (where answered_at is null and ended_at is not null) abandoned,
                count(*) filter (where answered_at is not null and answered_at - started_at <= ($2 || ' seconds')::interval) sl, avg(cost_ngn) cost
         from call_centre.calls where started_at > now() - ($1 || ' days')::interval`, [days, SL_SECONDS]),
      pool.query<{ agent: string; n: string; rating: string | null }>(
        `select agent_crm_id agent, count(*) n, avg(rating) rating from call_centre.calls
         where agent_crm_id is not null and started_at > now() - ($1 || ' days')::interval group by 1 order by n desc limit 10`, [days]),
      pool.query<{ language: LanguageCode; n: string }>(
        `select language, count(*) n from call_centre.calls where started_at > now() - ($1 || ' days')::interval group by 1 order by n desc`, [days]),
    ])
    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
    for (const x of heat.rows) heatmap[x.dow - 1]![x.h] = Number(x.n)
    // Forecast: the average of the same weekday over the last four weeks.
    const dayTotals = heatmap.map((row) => Math.round(row.reduce((a, b) => a + b, 0) / 4))
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 864e5)
      return { day: d.toLocaleDateString('en-GB', { weekday: 'short' }), calls: dayTotals[(d.getDay() + 6) % 7] ?? 0 }
    })
    const total = Number(kpi.rows[0]?.total ?? 0)
    return {
      heatmap, forecast,
      leaderboard: board.rows.map((b) => ({ agentId: b.agent, name: names.get(b.agent) ?? b.agent, calls: Number(b.n), avgRating: b.rating === null ? null : Math.round(Number(b.rating) * 10) / 10 })),
      avgCostNgn: kpi.rows[0]?.cost == null ? null : Math.round(Number(kpi.rows[0].cost) * 100) / 100,
      serviceLevelPct: total ? Math.round((Number(kpi.rows[0]?.sl ?? 0) / total) * 100) : 100,
      abandonedPct: total ? Math.round((Number(kpi.rows[0]?.abandoned ?? 0) / total) * 1000) / 10 : 0,
      languages: langs.rows.map((l) => ({ language: l.language, count: Number(l.n) })),
    }
  })

  /** Trend for one KPI tile over 24h, 7d or 30d. Keys and units are whitelisted, so nothing user-supplied reaches the SQL. */
  app.get<{ Params: { key: string }; Querystring: { period?: string } }>('/metrics/:key', { preHandler: lead }, async (req, reply): Promise<Metric | void> => {
    const key = metricKeySchema.safeParse(req.params.key)
    const period = metricPeriodSchema.safeParse(req.query.period ?? '24h')
    if (!key.success || !period.success) return reply.code(400).send({ error: 'Unknown metric or period' })
    const P = { '24h': { unit: 'hour', n: 24, fmt: 'HH24' }, '7d': { unit: 'day', n: 7, fmt: 'Dy' }, '30d': { unit: 'day', n: 30, fmt: 'DD Mon' } }[period.data]
    const M: Record<MetricKey, { table: string; ts: string; expr: string; unit: string }> = {
      calls: { table: 'call_centre.calls', ts: 'started_at', expr: 'count(*)', unit: 'calls' },
      handle_time: { table: 'call_centre.calls', ts: 'started_at', expr: 'coalesce(round(avg(extract(epoch from ended_at - started_at)) filter (where ended_at is not null)), 0)', unit: 'seconds' },
      abandoned: { table: 'call_centre.calls', ts: 'started_at', expr: 'count(*) filter (where answered_at is null and ended_at is not null)', unit: 'calls' },
      service_level: { table: 'call_centre.calls', ts: 'started_at', expr: `coalesce(round(100.0 * count(*) filter (where answered_at is not null and answered_at - started_at <= interval '${SL_SECONDS} seconds') / nullif(count(*), 0)), 0)`, unit: '%' },
      open_cases: { table: 'call_centre.tickets', ts: 'created_at', expr: `count(*) filter (where status in ('OPEN','INVESTIGATING'))`, unit: 'cases' },
      overdue_cases: { table: 'call_centre.tickets', ts: 'created_at', expr: `count(*) filter (where status in ('OPEN','INVESTIGATING') and sla_due_at < now())`, unit: 'cases' },
    }
    const m = M[key.data]
    const r = await pool.query<{ label: string; v: string }>(
      `select to_char(b.bucket, '${P.fmt}') label, coalesce(a.v, 0) v
       from generate_series(date_trunc('${P.unit}', now()) - ($1 || ' ${P.unit}s')::interval, date_trunc('${P.unit}', now()), '1 ${P.unit}'::interval) b(bucket)
       left join (select date_trunc('${P.unit}', ${m.ts}) bucket, ${m.expr} v from ${m.table}
                  where ${m.ts} >= date_trunc('${P.unit}', now()) - ($1 || ' ${P.unit}s')::interval group by 1) a on a.bucket = b.bucket
       order by b.bucket`, [P.n - 1])
    const series = r.rows.map((x) => ({ label: x.label, value: Number(x.v) }))
    const vals = series.map((s) => s.value)
    const first = vals[0] ?? 0
    const last = vals[vals.length - 1] ?? 0
    return {
      key: key.data, period: period.data, unit: m.unit, current: last, low: Math.min(...vals), high: Math.max(...vals),
      avg: Math.round((vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)) * 10) / 10,
      deltaPct: first ? Math.round(((last - first) / first) * 100) : 0, series,
    }
  })

  app.get('/audit', { preHandler: requireRole('admin') }, async (): Promise<AuditRow[]> => {
    const r = await pool.query<{ seq: string; created_at: Date; actor_role: string; action: string; entity: string; entity_id: string }>(
      'select seq, created_at, actor_role, action, entity, entity_id from call_centre.audit_log order by seq desc limit 50')
    return r.rows.map((x) => ({ seq: Number(x.seq), at: x.created_at.toISOString(), actorRole: x.actor_role, action: x.action, entity: x.entity, entityId: x.entity_id }))
  })
}

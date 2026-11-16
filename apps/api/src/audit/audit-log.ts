import { createHash } from 'node:crypto'
import type { Pool } from 'pg'

/** Fields hashed into the chain. Order and encoding are part of the contract: never change them. */
export interface AuditEntryInput {
  actorId: string
  actorRole: string
  action: string
  entity: string
  entityId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export const GENESIS_HASH = '0'.repeat(64)

/** Key-sorted JSON so the hash survives a round trip through jsonb, which does not preserve key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** entry_hash = SHA-256(prev_hash + canonical row content), matching call_centre.audit_log. */
export function computeEntryHash(prevHash: string, e: AuditEntryInput, createdAt: string): string {
  const body = canonical([e.actorId, e.actorRole, e.action, e.entity, e.entityId, e.metadata ?? {}, e.ipAddress ?? null, createdAt])
  return createHash('sha256').update(prevHash + body).digest('hex')
}

export interface StoredAuditRow { prev_hash: string; entry_hash: string; input: AuditEntryInput; created_at: string }

/** Recomputes a stored chain and returns the index of the first broken link, or null if intact. */
export function verifyChain(rows: StoredAuditRow[]): number | null {
  let prev = GENESIS_HASH
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!
    if (r.prev_hash !== prev || computeEntryHash(prev, r.input, r.created_at) !== r.entry_hash) return i
    prev = r.entry_hash
  }
  return null
}

/** Appends one entry. A transaction advisory lock serialises writers so the chain cannot fork. */
export async function appendAudit(pool: Pool, entry: AuditEntryInput): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock(hashtext($1))', ['call_centre.audit_log'])
    const last = await client.query<{ entry_hash: string }>('select entry_hash from call_centre.audit_log order by seq desc limit 1')
    const prev = last.rows[0]?.entry_hash ?? GENESIS_HASH
    const createdAt = new Date().toISOString()
    await client.query(
      `insert into call_centre.audit_log (actor_id, actor_role, action, entity, entity_id, metadata, ip_address, created_at, prev_hash, entry_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [entry.actorId, entry.actorRole, entry.action, entry.entity, entry.entityId, JSON.stringify(entry.metadata ?? {}), entry.ipAddress ?? null, createdAt, prev, computeEntryHash(prev, entry, createdAt)],
    )
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

interface AuditDbRow {
  prev_hash: string; entry_hash: string; actor_id: string; actor_role: string; action: string; entity: string; entity_id: string
  metadata: Record<string, unknown>; ip_address: string | null; created_at: Date
}

/** Reads the whole log in order and verifies it. Returns the first broken sequence position or null. */
export async function verifyStoredChain(pool: Pool): Promise<{ checked: number; brokenAt: number | null }> {
  const r = await pool.query<AuditDbRow>(
    `select prev_hash, entry_hash, actor_id, actor_role, action, entity, entity_id, metadata, ip_address, created_at
     from call_centre.audit_log order by seq asc`)
  const rows: StoredAuditRow[] = r.rows.map((x) => ({
    prev_hash: x.prev_hash, entry_hash: x.entry_hash, created_at: x.created_at.toISOString(),
    input: { actorId: x.actor_id, actorRole: x.actor_role, action: x.action, entity: x.entity, entityId: x.entity_id, metadata: x.metadata, ipAddress: x.ip_address ?? undefined },
  }))
  return { checked: rows.length, brokenAt: verifyChain(rows) }
}

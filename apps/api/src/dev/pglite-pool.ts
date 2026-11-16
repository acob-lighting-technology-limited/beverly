import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Pool } from 'pg'

/** Serialises access to PGlite's single connection so one request's transaction cannot interleave with another's. */
class Mutex {
  private tail: Promise<void> = Promise.resolve()
  acquire(): Promise<() => void> {
    let release!: () => void
    const next = new Promise<void>((r) => { release = r })
    const ready = this.tail.then(() => release)
    this.tail = this.tail.then(() => next)
    return ready
  }
}

interface QueryResult { rows: unknown[]; rowCount: number }

/**
 * A pg.Pool lookalike over in-memory Postgres (PGlite). Used by `pnpm dev:mock` and the integration tests so
 * the real migrations and real SQL run end to end. Only `query` and `connect` are implemented, which is all the API uses.
 */
export function pgliteAsPool(db: PGlite): Pool {
  const mutex = new Mutex()
  const run = async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    const r = await db.query(sql, params)
    return { rows: r.rows as unknown[], rowCount: r.affectedRows ? r.affectedRows : r.rows.length }
  }
  const pool = {
    async query(sql: string, params?: unknown[]): Promise<QueryResult> {
      const release = await mutex.acquire()
      try { return await run(sql, params) } finally { release() }
    },
    async connect() {
      const release = await mutex.acquire()   // a client holds the connection until released
      let done = false
      return {
        query: (sql: string, params?: unknown[]) => run(sql, params),
        release: () => { if (!done) { done = true; release() } },
      }
    },
  }
  return pool as unknown as Pool
}

const DB_DIR = fileURLToPath(new URL('../../../../db/baseline/', import.meta.url))

/** Stand-ins for the Beverly CRM tables the migrations insert into. */
const BEVERLY_STUBS = `
  create role anon;
  create role authenticated;
  create table if not exists public.roles (role_key text primary key, role_name text, label text, description text, updated_at timestamptz default now());
  create table if not exists public.permissions (role_key text, route_hash text, primary key (role_key, route_hash));
`

/** Boots an in-memory database with the real call-centre migrations applied, connected as the privileged owner. */
/** Runs every baseline migration into a fresh database. */
export async function buildSchema(db: PGlite): Promise<void> {
  await db.exec(BEVERLY_STUBS)
  const files = readdirSync(DB_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) await db.exec(readFileSync(join(DB_DIR, f), 'utf8'))
}

/**
 * A ready database. When PGLITE_SEED points at a dump made by the test global setup it loads that (fast);
 * otherwise it runs the migrations itself.
 */
export async function createCallCentreDb(): Promise<{ db: PGlite; pool: Pool }> {
  const seed = process.env.PGLITE_SEED
  if (seed) {
    const db = new PGlite({ loadDataDir: new Blob([readFileSync(seed)]) })
    return { db, pool: pgliteAsPool(db) }
  }
  const db = new PGlite()
  await buildSchema(db)
  return { db, pool: pgliteAsPool(db) }
}

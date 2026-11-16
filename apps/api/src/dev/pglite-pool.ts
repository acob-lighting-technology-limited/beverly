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
  create table if not exists public.roles (role_key text primary key, role_name text, name text, label text, description text, updated_at timestamptz default now());
  create table if not exists public.permissions (role_key text, route_hash text, primary key (role_key, route_hash));
  -- Beverly tables the read-access views sit on. Sensitive columns are included on purpose: tests prove the views never expose them.
  create table if not exists public.customers (id uuid primary key default gen_random_uuid(), name text, customer_name text, full_name text, phone text, email text, status text default 'active',
    site_id text, account_no text, kyc_tier int default 0, kyc_status text, created_at timestamptz default now(), vend_pin_hash text, vend_pin_salt text, kyc_data jsonb, raw_payload jsonb);
  create table if not exists public.customer_meters (id uuid primary key default gen_random_uuid(), customer_id uuid, meter_id text, meter_type text, station_id text, tariff_id text,
    nickname text, alias text, meter_name text, status text default 'approved', created_at timestamptz default now());
  create table if not exists public.users (id uuid primary key default gen_random_uuid(), auth_user_id uuid, user_name text, email text, role_key text, station_id text, station_ids text[],
    portal_access text[], created_at timestamptz default now(), updated_at timestamptz default now(), password_session_id text);
  create table if not exists public.wallets (id uuid primary key default gen_random_uuid(), owner_type text, owner_id uuid, currency text default 'NGN', status text default 'active');
  create table if not exists public.wallet_balances_stub (wallet_id uuid, ledger_balance_minor bigint, active_holds_minor bigint, available_balance_minor bigint);
  create or replace view public.v_wallet_balances as
    select w.id as wallet_id, w.currency, w.status, coalesce(s.ledger_balance_minor, 0) ledger_balance_minor, coalesce(s.active_holds_minor, 0) active_holds_minor, coalesce(s.available_balance_minor, 0) available_balance_minor
    from public.wallets w left join public.wallet_balances_stub s on s.wallet_id = w.id;
  create table if not exists public.purchase_orders (id uuid primary key default gen_random_uuid(), actor_type text, actor_id uuid, wallet_id uuid, customer_id text, customer_name text,
    meter_id text, station_id text, tariff_id text, amount_minor bigint, units_kwh numeric, purchase_mode text default 'wallet', token text, status text, delivery_state text,
    failure_reason text, idempotency_key text, created_at timestamptz default now(), updated_at timestamptz default now());
`

/** Runs every baseline migration (not rollbacks) into a fresh database. */
export async function buildSchema(db: PGlite): Promise<void> {
  await db.exec(BEVERLY_STUBS)
  const files = readdirSync(DB_DIR).filter((f) => f.endsWith('.sql') && !f.endsWith('.rollback.sql')).sort()
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

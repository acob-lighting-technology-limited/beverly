import type { Pool } from 'pg'
import type { Customer, RoleSummary, WalletInfo } from '@beverly-call/shared'
import type { Env } from '../config/env.js'
import type { VerifiedSession } from '../auth/session-token.js'
import { fetchCustomers, fetchMeters, fetchPurchases, fetchWallet } from './beverly-api.js'
import type { FetchLike } from './beverly-auth.js'
import { fetchCustomersDb, fetchMetersDb, fetchPurchasesDb, fetchRolesDb, fetchWalletDb, revealTokenDb } from './beverly-db.js'
import { fetchStaff, type BeverlyStaff } from './staff-directory.js'
import { fetchStaffDb } from './beverly-db.js'

/** Beverly data the call desk reads, independent of where it comes from (database views or Beverly's admin API). */
export interface BeverlyData {
  customers(q: string, limit?: number): Promise<Customer[]>
  meters(customerId: string): Promise<string[]>
  /** Recent purchases. Rows carry `token_last4` (database) or `token` (API); callers mask either. */
  purchases(customerId: string): Promise<Record<string, unknown>[]>
  revealToken(customerId: string, purchaseId: string): Promise<string | null>
  staff(): Promise<(BeverlyStaff & { role_label?: string | null })[]>
  wallet(customerId: string): Promise<WalletInfo | null>
  /** Roles with people and permission counts. Only the database source has them. */
  roles(): Promise<RoleSummary[]>
}

interface Deps { env: Env; pool: Pool; fetchImpl?: FetchLike }

/**
 * `BEVERLY_READ_MODE=db` (default) reads the call_centre_read views as the restricted database role.
 * `BEVERLY_READ_MODE=api` calls Beverly's admin API with the agent's own token instead.
 */
export function beverlyData({ env, pool, fetchImpl }: Deps, session: VerifiedSession): BeverlyData {
  const actor = { id: session.user.id, role: session.user.role }
  if (env.BEVERLY_READ_MODE === 'db') {
    return {
      customers: (q, limit) => fetchCustomersDb(pool, actor, q, limit),
      meters: (id) => fetchMetersDb(pool, actor, id),
      purchases: (id) => fetchPurchasesDb(pool, actor, id),
      revealToken: (customerId, purchaseId) => revealTokenDb(pool, actor, customerId, purchaseId),
      staff: () => fetchStaffDb(pool),
      wallet: (id) => fetchWalletDb(pool, actor, id),
      roles: () => fetchRolesDb(pool),
    }
  }
  return {
    customers: (q, limit) => fetchCustomers(env, session.beverlyToken, q, fetchImpl, limit),
    meters: (id) => fetchMeters(env, session.beverlyToken, id, fetchImpl),
    purchases: (id) => fetchPurchases(env, session.beverlyToken, id, fetchImpl),
    revealToken: async (_customerId, purchaseId) => {
      const p = (await fetchPurchases(env, session.beverlyToken, _customerId, fetchImpl)).find((x) => String(x.id) === purchaseId)
      return p && typeof p.token === 'string' ? p.token : null
    },
    staff: () => fetchStaff(env, session.beverlyToken, fetchImpl),
    wallet: (id) => fetchWallet(env, session.beverlyToken, id, fetchImpl),
    roles: async () => [],
  }
}

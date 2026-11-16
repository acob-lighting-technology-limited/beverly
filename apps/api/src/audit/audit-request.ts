import type { FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { appendAudit } from './audit-log.js'

/** Audit an action performed by the signed-in user of this request. Routes call this instead of repeating the actor fields. */
export function auditAs(pool: Pool, req: FastifyRequest, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
  const u = req.session!.user
  return appendAudit(pool, { actorId: u.id, actorRole: u.role, action, entity, entityId, metadata, ipAddress: req.ip })
}

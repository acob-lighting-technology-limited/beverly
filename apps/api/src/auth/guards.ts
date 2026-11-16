import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role } from '@beverly-call/shared'

/** preHandler factory: 401 when signed out, 403 when the role is not allowed. Server-side source of truth for access. */
export const requireRole = (...allowed: Role[]) => async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (!req.session) return reply.code(401).send({ error: 'Signed out' })
  if (!allowed.includes(req.session.user.role)) return reply.code(403).send({ error: 'Not allowed' })
}

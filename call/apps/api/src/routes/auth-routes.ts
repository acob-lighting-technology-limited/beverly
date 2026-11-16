import type { FastifyPluginAsync } from 'fastify'
import { loginRequestSchema } from '@beverly-call/shared'
import { COOKIE, type AppDeps } from '../app.js'
import { AuthError, signInStaff } from '../beverly/beverly-auth.js'
import { signSession } from '../auth/session-token.js'
import { appendAudit } from '../audit/audit-log.js'

export const authRoutes = ({ env, pool, fetchImpl }: AppDeps): FastifyPluginAsync => async (app) => {
  const cookieOpts = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' }

  // Stricter limit on credential attempts than the global default.
  app.post('/auth/login', { config: { rateLimit: { max: env.LOGIN_RATE_LIMIT, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginRequestSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid request' })
    try {
      const { user, token } = await signInStaff(env, body.data.email, body.data.password, fetchImpl, pool)
      const jwt = await signSession(user, token, env.SESSION_SECRET, env.SESSION_TTL_MINUTES)
      await appendAudit(pool, { actorId: user.id, actorRole: user.role, action: 'auth.login', entity: 'session', entityId: user.id, ipAddress: req.ip })
      return reply.setCookie(COOKIE, jwt, { ...cookieOpts, maxAge: env.SESSION_TTL_MINUTES * 60 }).code(204).send()
    } catch (e) {
      if (e instanceof AuthError) { req.log.warn({ status: e.status, reason: e.reason }, 'login refused'); return reply.code(e.status).send({ error: e.message }) }
      req.log.error(e, 'login failed')
      return reply.code(502).send({ error: 'Sign-in is unavailable' })
    }
  })

  app.post('/auth/logout', async (req, reply) => {
    if (req.session) await pool.query('delete from call_centre.agent_presence where agent_crm_id = $1', [req.session.user.id])
    if (req.session) await appendAudit(pool, { actorId: req.session.user.id, actorRole: req.session.user.role, action: 'auth.logout', entity: 'session', entityId: req.session.user.id, ipAddress: req.ip })
    return reply.clearCookie(COOKIE, cookieOpts).code(204).send()
  })

  app.get('/session', async (req, reply) => (req.session ? req.session.user : reply.code(401).send({ error: 'Signed out' })))
}

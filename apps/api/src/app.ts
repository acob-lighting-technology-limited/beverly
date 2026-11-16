import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import type { Pool } from 'pg'
import type { Env } from './config/env.js'
import { verifySession, type VerifiedSession } from './auth/session-token.js'
import type { FetchLike } from './beverly/beverly-auth.js'
import { authRoutes } from './routes/auth-routes.js'
import { healthRoutes } from './routes/health-routes.js'
import { caseRoutes } from './routes/case-routes.js'
import { callbackRoutes } from './routes/callback-routes.js'
import { callRoutes } from './routes/call-routes.js'
import { monitorRoutes } from './routes/monitor-routes.js'
import { customerRoutes } from './routes/customer-routes.js'
import { adminRoutes } from './routes/admin-routes.js'
import { webhookRoutes } from './routes/webhook-routes.js'
import formbody from '@fastify/formbody'
import type { RecordingStorage } from './storage/recording-storage.js'
import type { CommunicationsProvider } from './telephony/provider.js'
import type { PushSender } from './notify/notify.js'
import { presenceRoutes } from './routes/presence-routes.js'
import { supervisionRoutes } from './routes/supervision-routes.js'
import { inboxRoutes } from './routes/inbox-routes.js'

export const COOKIE = 'bc_session'

declare module 'fastify' {
  interface FastifyRequest { session: VerifiedSession | null }
}

/** Everything the app depends on. Tests inject fakes; production leaves optional deps undefined to use real ones. */
export interface AppDeps {
  env: Env
  pool: Pool
  fetchImpl?: FetchLike
  storage?: RecordingStorage
  provider?: CommunicationsProvider
  /** null disables push; undefined builds the real sender from env. */
  push?: PushSender | null
}

/** Builds the Fastify app. Pure function of its dependencies so tests can inject a fake pool and Beverly. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { env } = deps
  const app = Fastify({ logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] }, trustProxy: true })

  // Accept an empty body on JSON requests (POSTs like logout or start carry none) instead of failing with 400.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body) return done(null, undefined)
    try { done(null, JSON.parse(body as string)) } catch { const e = new Error('Invalid JSON') as Error & { statusCode: number }; e.statusCode = 400; done(e, undefined) }
  })
  await app.register(helmet)
  await app.register(cookie)
  await app.register(formbody)
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })

  // Reject cross-site writes: browsers always send Origin on cross-origin POSTs.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.url.startsWith('/api/webhooks/') && req.headers.origin !== env.ALLOWED_ORIGIN) {
      return reply.code(403).send({ error: 'Origin not allowed' })
    }
  })

  app.decorateRequest('session', null)
  app.addHook('preHandler', async (req: FastifyRequest) => {
    const raw = req.cookies[COOKIE]
    req.session = raw ? await verifySession(raw, env.SESSION_SECRET) : null
  })

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes(deps), { prefix: '/api' })
  await app.register(caseRoutes(deps), { prefix: '/api' })
  await app.register(callbackRoutes(deps), { prefix: '/api' })
  await app.register(presenceRoutes(deps), { prefix: '/api' })
  await app.register(callRoutes(deps), { prefix: '/api' })
  await app.register(monitorRoutes(deps), { prefix: '/api' })
  await app.register(supervisionRoutes(deps), { prefix: '/api' })
  await app.register(inboxRoutes(deps), { prefix: '/api' })
  await app.register(customerRoutes(deps), { prefix: '/api' })
  await app.register(adminRoutes(deps), { prefix: '/api' })
  await app.register(webhookRoutes(deps), { prefix: '/api' })
  return app
}

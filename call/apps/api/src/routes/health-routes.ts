import type { FastifyPluginAsync } from 'fastify'

/** Liveness probe for the host and uptime monitors. No dependencies, no data. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }))
}

import pg from 'pg'
import { loadEnv } from './config/env.js'
import { buildApp } from './app.js'

const env = loadEnv()
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined })
const app = await buildApp({ env, pool })

const stop = async () => { await app.close(); await pool.end(); process.exit(0) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

await app.listen({ port: env.PORT, host: '0.0.0.0' })

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConnectionOptions } from 'node:tls'
import type { Env } from '../config/env.js'

/**
 * TLS settings for the database connection. Certificate verification is always on in production.
 * Supabase's pooler is signed by its own root, so point DATABASE_SSL_CA at certs/supabase-ca.pem (or paste a PEM).
 * Outside production without a CA, TLS is requested but not verified so local work against a hosted database still connects.
 */
export function dbSsl(env: Env): ConnectionOptions | undefined {
  const ca = env.DATABASE_SSL_CA
  if (ca) {
    const pem = ca.includes('BEGIN CERTIFICATE') ? ca : readFileSync(existsSync(ca) ? ca : resolve(process.cwd(), ca), 'utf8')
    return { ca: pem, rejectUnauthorized: true }
  }
  return env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
}

import { describe, expect, it } from 'vitest'
import { dbSsl } from '../src/db/ssl.js'
import { testEnv } from './helpers.js'

describe('database TLS', () => {
  it('always verifies the server certificate in production', () => {
    expect(dbSsl(testEnv({ NODE_ENV: 'production' }))).toEqual({ rejectUnauthorized: true })
  })

  it('trusts the Supabase root from a file and still verifies', () => {
    const ssl = dbSsl(testEnv({ NODE_ENV: 'production', DATABASE_SSL_CA: 'certs/supabase-ca.pem' }))
    expect(ssl?.rejectUnauthorized).toBe(true)
    expect(String(ssl?.ca)).toContain('BEGIN CERTIFICATE')
  })

  it('accepts an inline PEM', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'
    expect(dbSsl(testEnv({ DATABASE_SSL_CA: pem }))?.ca).toBe(pem)
  })

  it('requests TLS without verifying only outside production and without a CA', () => {
    expect(dbSsl(testEnv({ NODE_ENV: 'development' }))).toEqual({ rejectUnauthorized: false })
  })
})

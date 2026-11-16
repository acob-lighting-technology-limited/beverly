import { z } from 'zod'

/** All configuration comes from the environment. Secrets are never hard-coded or committed. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  /** Pooler URL for the least-privilege `beverly_call_api` role (call_centre schema only). */
  DATABASE_URL: z.string().url(),
  /** Beverly's Supabase project used for staff sign-on. */
  BEVERLY_AUTH_URL: z.string().url(),
  BEVERLY_AUTH_ANON_KEY: z.string().min(1),
  /** Beverly admin API base, called with each agent's own bearer token. */
  BEVERLY_API_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /** Sign-in attempts allowed per minute per IP. */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(10000).default(8),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(720).default(60),
  ALLOWED_ORIGIN: z.string().url(),
  /** Shared secret Africa's Talking sends on voice webhooks. Webhooks are refused when unset. */
  AT_WEBHOOK_SECRET: z.string().min(16).optional(),
  /** Supabase Storage for recordings. Playback and purge are refused when unset. */
  RECORDINGS_STORAGE_URL: z.string().url().optional(),
  RECORDINGS_STORAGE_KEY: z.string().min(1).optional(),
  /** Africa's Talking REST credentials (SMS, outbound calls, WebRTC tokens). Features degrade cleanly when unset. */
  AT_API_KEY: z.string().min(1).optional(),
  AT_USERNAME: z.string().min(1).optional(),
  AT_VIRTUAL_NUMBER: z.string().min(5).optional(),
  /** Public base URL of this API, used to build carrier callback URLs. */
  API_PUBLIC_URL: z.string().url().optional(),
  /** Web Push (VAPID). Push alerts are disabled when unset. */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default('mailto:ops@example.com'),
  RECORDING_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
})
export type Env = z.infer<typeof envSchema>

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${fields}`)
  }
  return parsed.data
}

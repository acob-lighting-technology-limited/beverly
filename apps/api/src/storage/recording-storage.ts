import type { Env } from '../config/env.js'
import type { FetchLike } from '../beverly/beverly-auth.js'

/** Seam over recording storage so playback, ingest and the purge job are testable without Supabase. */
export interface RecordingStorage {
  signedUrl(bucket: string, key: string, ttlSeconds: number): Promise<string>
  remove(bucket: string, key: string): Promise<void>
  upload(bucket: string, key: string, bytes: Uint8Array, contentType: string): Promise<void>
}

export class StorageUnavailable extends Error {}

/**
 * Supabase Storage in the shared project. Uses a dedicated key (RECORDINGS_STORAGE_KEY) scoped to the
 * recordings bucket, never the CRM service role.
 */
export function supabaseRecordingStorage(env: Env, f: FetchLike = fetch): RecordingStorage {
  const base = env.RECORDINGS_STORAGE_URL
  const key = env.RECORDINGS_STORAGE_KEY
  if (!base || !key) throw new StorageUnavailable('Recording storage is not configured')
  const auth = { authorization: `Bearer ${key}`, apikey: key }
  const path = (bucket: string, k: string) => `${encodeURIComponent(bucket)}/${k.split('/').map(encodeURIComponent).join('/')}`
  return {
    async signedUrl(bucket, k, ttl) {
      const r = await f(`${base}/storage/v1/object/sign/${path(bucket, k)}`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: ttl }) })
      if (!r.ok) throw new StorageUnavailable(`Signing failed (${r.status})`)
      const body = (await r.json()) as { signedURL?: string }
      if (!body.signedURL) throw new StorageUnavailable('No signed URL returned')
      return `${base}/storage/v1${body.signedURL}`
    },
    async remove(bucket, k) {
      const r = await f(`${base}/storage/v1/object/${path(bucket, k)}`, { method: 'DELETE', headers: auth })
      if (!r.ok && r.status !== 404) throw new StorageUnavailable(`Delete failed (${r.status})`)
    },
    async upload(bucket, k, bytes, contentType) {
      const r = await f(`${base}/storage/v1/object/${path(bucket, k)}`, { method: 'POST', headers: { ...auth, 'content-type': contentType, 'x-upsert': 'true' }, body: bytes as unknown as BodyInit })
      if (!r.ok) throw new StorageUnavailable(`Upload failed (${r.status})`)
    },
  }
}

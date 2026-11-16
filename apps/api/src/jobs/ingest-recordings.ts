import type { Pool } from 'pg'
import type { FetchLike } from '../beverly/beverly-auth.js'
import type { RecordingStorage } from '../storage/recording-storage.js'

export interface IngestResult { ingested: number; failed: number }

/**
 * Copies carrier-hosted recordings into our storage bucket. A recording is marked ingested only after the
 * upload succeeds, so a failure is retried on the next run. Only https carrier URLs are fetched (no SSRF to internal hosts).
 */
export async function ingestRecordings(pool: Pool, storage: RecordingStorage, f: FetchLike = fetch, batch = 25): Promise<IngestResult> {
  const due = await pool.query<{ id: string; storage_bucket: string; storage_key: string; source_url: string }>(
    `select id, storage_bucket, storage_key, source_url from call_centre.recordings
     where ingested_at is null and deleted_at is null and source_url is not null order by created_at limit $1`, [batch])
  let ingested = 0
  let failed = 0
  for (const r of due.rows) {
    try {
      const u = new URL(r.source_url)
      if (u.protocol !== 'https:') throw new Error('Only https sources are fetched')
      const res = await f(r.source_url)
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (!bytes.length) throw new Error('Empty recording')
      await storage.upload(r.storage_bucket, r.storage_key, bytes, res.headers.get('content-type') ?? 'audio/mpeg')
      await pool.query('update call_centre.recordings set ingested_at = now(), file_size_bytes = $2 where id = $1', [r.id, bytes.length])
      ingested++
    } catch {
      failed++
    }
  }
  return { ingested, failed }
}

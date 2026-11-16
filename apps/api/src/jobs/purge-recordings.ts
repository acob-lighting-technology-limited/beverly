import type { Pool } from 'pg'
import type { RecordingStorage } from '../storage/recording-storage.js'

export interface PurgeResult { deleted: number; held: number; failed: number }

/**
 * NDPA retention: removes recordings past expires_at unless legal_hold is set.
 * The file is deleted first; the row is only marked deleted when that succeeds, so a failure is retried next run.
 * Every run is logged to call_centre.retention_runs as the retention proof.
 */
export async function purgeExpiredRecordings(pool: Pool, storage: RecordingStorage, batch = 200): Promise<PurgeResult> {
  const due = await pool.query<{ id: string; storage_bucket: string; storage_key: string }>(
    `select id, storage_bucket, storage_key from call_centre.recordings
     where deleted_at is null and legal_hold = false and expires_at < now() order by expires_at limit $1`, [batch])
  const held = await pool.query<{ n: string }>(
    'select count(*) n from call_centre.recordings where deleted_at is null and legal_hold = true and expires_at < now()')

  let deleted = 0
  let failed = 0
  for (const r of due.rows) {
    try {
      await storage.remove(r.storage_bucket, r.storage_key)
      await pool.query('update call_centre.recordings set deleted_at = now() where id = $1', [r.id])
      deleted++
    } catch {
      failed++
    }
  }
  const result = { deleted, held: Number(held.rows[0]?.n ?? 0), failed }
  await pool.query('insert into call_centre.retention_runs (deleted_count, held_count, failed_count) values ($1,$2,$3)', [result.deleted, result.held, result.failed])
  return result
}

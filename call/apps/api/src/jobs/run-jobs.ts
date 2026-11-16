import pg from 'pg'
import { loadEnv } from '../config/env.js'
import { supabaseRecordingStorage } from '../storage/recording-storage.js'
import { purgeExpiredRecordings } from './purge-recordings.js'
import { ingestRecordings } from './ingest-recordings.js'
import { notifySweep } from './notify-sweep.js'
import { webPushSender } from '../notify/notify.js'
import { verifyStoredChain } from '../audit/audit-log.js'

/**
 * Scheduler entry point: `tsx src/jobs/run-jobs.ts <job>` where job is purge | ingest | sweep | verify-audit.
 * Run ingest and sweep every minute, purge and verify-audit daily. A non-zero exit signals the scheduler to alert.
 */
const job = process.argv[2]
const env = loadEnv()
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: true } })
try {
  if (job === 'purge') {
    const r = await purgeExpiredRecordings(pool, supabaseRecordingStorage(env))
    console.log(JSON.stringify({ job, ...r })); process.exitCode = r.failed ? 1 : 0
  } else if (job === 'ingest') {
    const r = await ingestRecordings(pool, supabaseRecordingStorage(env))
    console.log(JSON.stringify({ job, ...r })); process.exitCode = r.failed ? 1 : 0
  } else if (job === 'sweep') {
    console.log(JSON.stringify({ job, created: await notifySweep(pool, webPushSender(env)) }))
  } else if (job === 'verify-audit') {
    const r = await verifyStoredChain(pool)
    console.log(JSON.stringify({ job, ...r })); process.exitCode = r.brokenAt === null ? 0 : 2
  } else {
    console.error('Usage: run-jobs.ts purge | ingest | sweep | verify-audit'); process.exitCode = 64
  }
} finally {
  await pool.end()
}

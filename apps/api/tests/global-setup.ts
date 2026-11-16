import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { buildSchema } from '../src/dev/pglite-pool.js'

/** Applies the real migrations once and saves a snapshot; each test file clones it instead of re-running them. */
export default async function setup(): Promise<void> {
  const db = new PGlite()
  await buildSchema(db)
  const dump = await db.dumpDataDir('none')
  const dir = mkdtempSync(join(tmpdir(), 'bc-pglite-'))
  const file = join(dir, 'seed.tar')
  writeFileSync(file, Buffer.from(await dump.arrayBuffer()))
  process.env.PGLITE_SEED = file
  await db.close()
}

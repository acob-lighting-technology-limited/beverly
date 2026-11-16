import { describe, expect, it } from 'vitest'
import { GENESIS_HASH, computeEntryHash, verifyChain, type AuditEntryInput } from '../src/audit/audit-log.js'

const mk = (action: string): AuditEntryInput => ({ actorId: 'u1', actorRole: 'agent', action, entity: 'call', entityId: 'c1' })

function chain(n: number) {
  const rows: Parameters<typeof verifyChain>[0] = []
  let prev = GENESIS_HASH
  for (let i = 0; i < n; i++) {
    const input = mk(`a${i}`), at = `2026-11-16T09:0${i}:00.000Z`
    const h = computeEntryHash(prev, input, at)
    rows.push({ prev_hash: prev, entry_hash: h, input, created_at: at })
    prev = h
  }
  return rows
}

describe('audit hash chain', () => {
  it('accepts an intact chain', () => expect(verifyChain(chain(4))).toBeNull())
  it('detects an edited entry', () => {
    const rows = chain(4)
    rows[2]!.input = mk('tampered')
    expect(verifyChain(rows)).toBe(2)
  })
  it('detects a removed entry', () => {
    const rows = chain(4)
    rows.splice(1, 1)
    expect(verifyChain(rows)).toBe(1)
  })
})

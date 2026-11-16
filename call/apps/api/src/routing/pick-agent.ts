import type { LanguageCode } from '@beverly-call/shared'

export interface Candidate {
  agentId: string
  clientName: string
  status: string
  languages: string[]
  skills: string[]
  idleSinceMs: number
  lastSeenMs: number
}

/** An agent not heard from within this window is treated as offline (heartbeat is about every 30 s). */
export const PRESENCE_TTL_MS = 90_000

/**
 * Longest-idle-first routing. Only agents who are available, recently seen, speak the caller's language and
 * have the skill are eligible. Returns null when nobody qualifies, which triggers the callback offer.
 */
export function pickAgent(cands: Candidate[], language: LanguageCode, nowMs: number, skill = 'vending'): Candidate | null {
  const eligible = cands.filter((c) =>
    c.status === 'available' && nowMs - c.lastSeenMs <= PRESENCE_TTL_MS && c.languages.includes(language) && c.skills.includes(skill))
  if (!eligible.length) return null
  return eligible.reduce((best, c) => (c.idleSinceMs < best.idleSinceMs ? c : best))
}

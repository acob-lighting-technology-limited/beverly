import type { Env } from '../config/env.js'
import type { FetchLike } from '../beverly/beverly-auth.js'

/** Everything the app needs from a carrier. A different carrier only needs another implementation. */
export interface CommunicationsProvider {
  readonly configured: boolean
  sendSms(to: string, text: string): Promise<{ ref: string | null; status: string }>
  makeCall(from: string, to: string): Promise<{ ref: string | null }>
  webrtcToken(clientName: string, ttlSeconds: number): Promise<{ token: string; clientName: string }>
}

export class ProviderUnavailable extends Error {}

/** Normalises Nigerian numbers to E.164: 0803... -> +234803... */
export function toE164(n: string): string {
  const d = n.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) return d
  if (d.startsWith('234')) return `+${d}`
  if (d.startsWith('0')) return `+234${d.slice(1)}`
  return `+${d}`
}

/**
 * Africa's Talking REST. TODO(debt): endpoints and payloads follow AT's public docs from memory and must be
 * verified against the live account (sandbox first) before go-live: messaging v1, voice call, WebRTC capability token.
 */
export function africasTalking(env: Env, f: FetchLike = fetch): CommunicationsProvider {
  const key = env.AT_API_KEY
  const user = env.AT_USERNAME
  const configured = Boolean(key && user)
  const need = (): { key: string; user: string } => {
    if (!key || !user) throw new ProviderUnavailable('Carrier credentials are not configured')
    return { key, user }
  }
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString()
  return {
    configured,
    async sendSms(to, text) {
      const c = need()
      const r = await f('https://api.africastalking.com/version1/messaging', {
        method: 'POST', headers: { apiKey: c.key, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: form({ username: c.user, to: toE164(to), message: text, ...(env.AT_VIRTUAL_NUMBER ? { from: env.AT_VIRTUAL_NUMBER } : {}) }),
      })
      if (!r.ok) throw new ProviderUnavailable(`SMS failed (${r.status})`)
      const body = (await r.json()) as { SMSMessageData?: { Recipients?: { messageId?: string; status?: string }[] } }
      const rec = body.SMSMessageData?.Recipients?.[0]
      return { ref: rec?.messageId ?? null, status: rec?.status ?? 'Sent' }
    },
    async makeCall(from, to) {
      const c = need()
      const r = await f('https://voice.africastalking.com/call', {
        method: 'POST', headers: { apiKey: c.key, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: form({ username: c.user, from: toE164(from), to: toE164(to) }),
      })
      if (!r.ok) throw new ProviderUnavailable(`Call failed (${r.status})`)
      const body = (await r.json()) as { entries?: { sessionId?: string }[] }
      return { ref: body.entries?.[0]?.sessionId ?? null }
    },
    async webrtcToken(clientName, ttlSeconds) {
      const c = need()
      const r = await f('https://webrtc.africastalking.com/capability-token/request', {
        method: 'POST', headers: { apiKey: c.key, 'content-type': 'application/json' },
        body: JSON.stringify({ username: c.user, clientName, phoneNumber: env.AT_VIRTUAL_NUMBER, incoming: true, outgoing: true, lifeTimeSec: String(ttlSeconds) }),
      })
      if (!r.ok) throw new ProviderUnavailable(`Token request failed (${r.status})`)
      const body = (await r.json()) as { token?: string; clientName?: string }
      if (!body.token) throw new ProviderUnavailable('No token returned')
      return { token: body.token, clientName: body.clientName ?? clientName }
    },
  }
}

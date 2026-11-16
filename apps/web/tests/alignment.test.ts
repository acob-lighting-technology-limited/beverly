import { describe, expect, it } from 'vitest'
import { INTERFACE_LOCALES } from '@beverly-call/shared'
import { intl, resolveLocale, setLocale } from '@/lib/locale'
import { escalationPriorityLabel, humanStatus, purchaseTone, supportPriorityTone, supportStatusTone } from '@/lib/status'
import { groupLabel, screenTitle } from '@/lib/i18n'
import { ROLE_SCREENS } from '@/lib/roles'

describe('languages match Beverly', () => {
  it('offers the four Beverly locales and nothing else', () => expect(INTERFACE_LOCALES.map((l) => l.code)).toEqual(['en', 'yo', 'ha', 'ig']))
  it('turns retired or unknown codes (like the old Pidgin interface) into English', () => {
    expect(resolveLocale('pcm')).toBe('en'); expect(resolveLocale('fr')).toBe('en'); expect(resolveLocale(undefined)).toBe('en'); expect(resolveLocale('ha')).toBe('ha')
  })
  it('formats with the Nigerian locale tag for the chosen language', () => {
    setLocale('yo'); expect(intl()).toBe('yo-NG'); setLocale('en'); expect(intl()).toBe('en-NG')
  })
  it('has navigation labels and the support-tickets title for every interface language', () => {
    for (const l of INTERFACE_LOCALES) { expect(groupLabel(l.code, 0)).not.toBe(''); expect(screenTitle(l.code, 'tix')).not.toBe('') }
  })
})

describe('status wording matches Beverly', () => {
  it('colours purchase statuses', () => {
    expect(purchaseTone('delivered')).toBe('ok'); expect(purchaseTone('failed')).toBe('bad'); expect(purchaseTone('reversed')).toBe('bad'); expect(purchaseTone('delivery_pending_review')).toBe('ye')
  })
  it('humanises underscored statuses', () => expect(humanStatus('awaiting_customer')).toBe('Awaiting customer'))
  it('maps support status and priority to a colour', () => {
    expect(supportStatusTone('resolved')).toBe('ok'); expect(supportStatusTone('open')).toBe('bad'); expect(supportPriorityTone('urgent')).toBe('bad')
  })
  it('shows escalation priority in Beverly’s words', () => {
    expect(escalationPriorityLabel('CRITICAL')).toBe('Urgent'); expect(escalationPriorityLabel('MEDIUM')).toBe('Normal')
  })
})

describe('support tickets are reachable by every role that can work them', () => {
  it('agents, supervisors and admins can open them', () => { for (const r of ['agent', 'supervisor', 'admin'] as const) expect(ROLE_SCREENS[r]).toContain('tix') })
})

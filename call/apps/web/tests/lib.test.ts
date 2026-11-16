import { describe, expect, it } from 'vitest'
import { slaLabel } from '@/lib/sla'
import { maskPhone } from '@/lib/mask'
import { canOpen } from '@/lib/roles'

describe('slaLabel', () => {
  it('flags overdue', () => expect(slaLabel(-5)).toEqual({ text: '5m over', tone: 'bad' }))
  it('warns under 15m', () => expect(slaLabel(9).tone).toBe('ye'))
  it('formats hours', () => expect(slaLabel(63).text).toBe('1h 03m left'))
  it('closes done', () => expect(slaLabel(5, true).text).toBe('Closed'))
})
describe('maskPhone', () => {
  it('masks the middle', () => expect(maskPhone('0803 555 0142')).toBe('0803 ••• 0142'))
})
describe('canOpen', () => {
  it('agents cannot open admin', () => expect(canOpen('agent', 'admin')).toBe(false))
  it('admins cannot take calls', () => expect(canOpen('admin', 'call')).toBe(false))
})

import { csvCell, clock } from '@/lib/format'
describe('format', () => {
  it('neutralises spreadsheet formulas', () => expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)"))
  it('quotes commas and quotes', () => expect(csvCell('a,"b"')).toBe('"a,""b"""'))
  it('formats clock', () => expect(clock(125)).toBe('02:05'))
})

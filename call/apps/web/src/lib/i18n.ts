import type { LanguageCode } from '@beverly-call/shared'
import type { ScreenId } from '@/types'

/** Navigation and screen titles in the five supported languages. Page content stays in English until translated by the business. */
const GROUP: Record<LanguageCode, string[]> = {
  en: ['Calls', 'Customers', 'Monitor', 'Review', 'Admin'],
  ha: ['Kira', 'Abokan ciniki', 'Sa ido', 'Bita', 'Gudanarwa'],
  yo: ['Ìpè', 'Oníbàárà', 'Àbójútó', 'Àyẹ̀wò', 'Alákòóso'],
  ig: ['Ọkpụkpọ', 'Ndị ahịa', 'Nlekota', 'Nyocha', 'Nchịkwa'],
  pcm: ['Calls', 'Customers', 'Monitor', 'Review', 'Admin'],
}
const SCREEN: Record<LanguageCode, Record<ScreenId, string>> = {
  en: { call: 'Call', cust: 'Customers', wall: 'Live wall', cases: 'Escalations', cb: 'Callbacks', rec: 'Recordings', rep: 'Reports', admin: 'Admin' },
  ha: { call: 'Kira', cust: 'Abokan ciniki', wall: 'Allon kai tsaye', cases: 'Aika zuwa sama', cb: 'Kira baya', rec: 'Rikodi', rep: 'Rahotanni', admin: 'Gudanarwa' },
  yo: { call: 'Ìpè', cust: 'Oníbàárà', wall: 'Ògiri ààyè', cases: 'Gbígbé sókè', cb: 'Ìpè padà', rec: 'Àwọn ìgbàsílẹ̀', rep: 'Àwọn ìròyìn', admin: 'Alákòóso' },
  ig: { call: 'Ọkpụkpọ', cust: 'Onye ahịa', wall: 'Ihuenyo ndụ', cases: 'Ibuga elu', cb: 'Kpọgharịa', rec: 'Ndekọ', rep: 'Akụkọ', admin: 'Nchịkwa' },
  pcm: { call: 'Call', cust: 'Customer', wall: 'Live board', cases: 'Escalate', cb: 'Call back', rec: 'Recordings', rep: 'Reports', admin: 'Admin' },
}
export const groupLabel = (lang: LanguageCode, i: number): string => GROUP[lang][i] ?? GROUP.en[i] ?? ''
export const screenTitle = (lang: LanguageCode, s: ScreenId): string => SCREEN[lang][s]

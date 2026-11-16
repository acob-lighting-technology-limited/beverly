import type { InterfaceLocale } from '@beverly-call/shared'
import type { ScreenId } from '@/types'

/** Navigation and screen titles in Beverly's four interface languages (English, Hausa, Yoruba, Igbo). Page content stays in English until translated by the business. */
const GROUP: Record<InterfaceLocale, string[]> = {
  en: ['Calls', 'Customers', 'Monitor', 'Review', 'Admin'],
  ha: ['Kira', 'Abokan ciniki', 'Sa ido', 'Bita', 'Gudanarwa'],
  yo: ['Ìpè', 'Oníbàárà', 'Àbójútó', 'Àyẹ̀wò', 'Alákòóso'],
  ig: ['Ọkpụkpọ', 'Ndị ahịa', 'Nlekota', 'Nyocha', 'Nchịkwa'],
}
const SCREEN: Record<InterfaceLocale, Record<ScreenId, string>> = {
  en: { tix: 'Support tickets', call: 'Call', cust: 'Customers', wall: 'Live wall', cases: 'Escalations', cb: 'Callbacks', rec: 'Recordings', rep: 'Reports', admin: 'Admin' },
  ha: { tix: 'Support tickets', call: 'Kira', cust: 'Abokan ciniki', wall: 'Allon kai tsaye', cases: 'Aika zuwa sama', cb: 'Kira baya', rec: 'Rikodi', rep: 'Rahotanni', admin: 'Gudanarwa' },
  yo: { tix: 'Support tickets', call: 'Ìpè', cust: 'Oníbàárà', wall: 'Ògiri ààyè', cases: 'Gbígbé sókè', cb: 'Ìpè padà', rec: 'Àwọn ìgbàsílẹ̀', rep: 'Àwọn ìròyìn', admin: 'Alákòóso' },
  ig: { tix: 'Support tickets', call: 'Ọkpụkpọ', cust: 'Onye ahịa', wall: 'Ihuenyo ndụ', cases: 'Ibuga elu', cb: 'Kpọgharịa', rec: 'Ndekọ', rep: 'Akụkọ', admin: 'Nchịkwa' },
}
export const groupLabel = (lang: InterfaceLocale, i: number): string => GROUP[lang][i] ?? GROUP.en[i] ?? ''
export const screenTitle = (lang: InterfaceLocale, s: ScreenId): string => SCREEN[lang][s]

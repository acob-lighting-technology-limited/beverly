const PHONE = /\b(0\d{3}) \d{3} (\d{4})\b/g
export const maskPhone = (s: string) => s.replace(PHONE, '$1 ••• $2')

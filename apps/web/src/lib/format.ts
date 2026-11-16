import { intl } from '@/lib/locale'

export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 125 -> "02:05". */
export const clock = (seconds: number): string => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`

export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleString(intl(), { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Escapes a value for CSV, including the leading-formula characters spreadsheets would execute. */
export function csvCell(v: string | number): string {
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** Today in Beverly's time zone (WAT) as YYYY-MM-DD, whatever the browser's own zone is. */
export const lagosToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

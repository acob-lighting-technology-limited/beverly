export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 125 -> "02:05". */
export const clock = (seconds: number): string => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`

export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Escapes a value for CSV, including the leading-formula characters spreadsheets would execute. */
export function csvCell(v: string | number): string {
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

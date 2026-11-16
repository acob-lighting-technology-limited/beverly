/**
 * STS tokens are never shown by default. Keeps only the last four digits, e.g. "•••• •••• •••• 5561".
 * The raw token is released only after caller verification and an audit entry (separate, audited flow).
 */
export function maskToken(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `•••• •••• •••• ${digits.slice(-4)}` : '••••'
}

/** Masked token from the last four digits only (database mode never selects the token itself). */
export const maskLast4 = (last4: unknown): string => (typeof last4 === 'string' && last4.length === 4 ? `•••• •••• •••• ${last4}` : '••••')

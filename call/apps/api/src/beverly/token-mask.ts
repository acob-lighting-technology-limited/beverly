/**
 * STS tokens are never shown by default. Keeps only the last four digits, e.g. "•••• •••• •••• 5561".
 * The raw token is released only after caller verification and an audit entry (separate, audited flow).
 */
export function maskToken(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `•••• •••• •••• ${digits.slice(-4)}` : '••••'
}

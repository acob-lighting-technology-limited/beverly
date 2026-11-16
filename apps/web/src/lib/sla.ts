/** Label and tone for minutes left on a case deadline. Negative means overdue. */
export function slaLabel(minutes: number, done = false): { text: string; tone: 'ok' | 'ye' | 'bad' } {
  if (done) return { text: 'Closed', tone: 'ok' }
  if (minutes < 0) return { text: `${-minutes}m over`, tone: 'bad' }
  const t = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
  return { text: `${t} left`, tone: minutes < 15 ? 'ye' : 'ok' }
}

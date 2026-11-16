/** Beverly runs on Nigerian time (WAT, UTC+1, no daylight saving). Reports, "today" and message times use it, never UTC. */
export const TZ = 'Africa/Lagos'

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** 2026-11-16T08:05:00Z -> "09:05" (Lagos). */
export const hm = (d: Date): string => fmt.format(d)

/** Today in Lagos as YYYY-MM-DD. */
export const lagosDate = (d = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

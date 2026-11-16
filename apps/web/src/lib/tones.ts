/** DTMF keypad tones (two simultaneous frequencies), generated in the browser. Silent when the user disabled sounds. */
const DT: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
}
let ctx: AudioContext | null = null

export function playDtmf(key: string, enabled: boolean): void {
  const f = DT[key]
  if (!f || !enabled) return
  try {
    ctx = ctx ?? new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    void ctx.resume()
    const g = ctx.createGain()
    g.gain.value = 0.05
    g.connect(ctx.destination)
    for (const hz of f) {
      const o = ctx.createOscillator()
      o.frequency.value = hz
      o.connect(g)
      o.start()
      o.stop(ctx.currentTime + 0.12)
    }
  } catch { /* audio blocked until a user gesture */ }
}

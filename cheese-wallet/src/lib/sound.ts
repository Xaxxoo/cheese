// Synthesised cash-register "cha-ching" using the Web Audio API.
// No audio file required — works offline and as a PWA.
export function playChaChing(): void {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const t = ctx.currentTime

    // ── "cha" — short percussive click ──────────────────────
    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    click.connect(clickGain)
    clickGain.connect(ctx.destination)
    click.frequency.setValueAtTime(320, t)
    click.frequency.exponentialRampToValueAtTime(80, t + 0.055)
    clickGain.gain.setValueAtTime(0.55, t)
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055)
    click.start(t)
    click.stop(t + 0.055)

    // ── "ching" — bright metallic ring (fundamental) ────────
    const bell1 = ctx.createOscillator()
    const bell1Gain = ctx.createGain()
    bell1.connect(bell1Gain)
    bell1Gain.connect(ctx.destination)
    bell1.type = 'triangle'
    bell1.frequency.setValueAtTime(1400, t + 0.045)
    bell1Gain.gain.setValueAtTime(0.28, t + 0.045)
    bell1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
    bell1.start(t + 0.045)
    bell1.stop(t + 0.65)

    // ── "ching" — upper harmonic (brightness) ───────────────
    const bell2 = ctx.createOscillator()
    const bell2Gain = ctx.createGain()
    bell2.connect(bell2Gain)
    bell2Gain.connect(ctx.destination)
    bell2.type = 'triangle'
    bell2.frequency.setValueAtTime(2100, t + 0.045)
    bell2Gain.gain.setValueAtTime(0.14, t + 0.045)
    bell2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    bell2.start(t + 0.045)
    bell2.stop(t + 0.5)

    // ── shimmer — very short high sine for metallic sheen ───
    const shimmer = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    shimmer.connect(shimmerGain)
    shimmerGain.connect(ctx.destination)
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(3400, t + 0.048)
    shimmerGain.gain.setValueAtTime(0.08, t + 0.048)
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    shimmer.start(t + 0.048)
    shimmer.stop(t + 0.25)

    setTimeout(() => ctx.close(), 800)
  } catch {
    // Silently fail — sound is non-critical
  }
}

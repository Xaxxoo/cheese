// Play the cash-register cha-ching sound.
// Uses a real audio file served from /sounds/cha-ching.mp4.
export function playChaChing(): void {
  if (typeof window === 'undefined') return
  try {
    const audio = new Audio('/sounds/cha-ching.mp4')
    audio.volume = 0.8
    void audio.play()
  } catch {
    // Silently fail — sound is non-critical
  }
}

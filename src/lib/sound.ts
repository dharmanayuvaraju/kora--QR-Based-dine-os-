"use client";

type SoundKind = "new_order" | "item_ready" | "payment_success" | "alert";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playChime(kind: SoundKind, muted = false): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number, gainPeak = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    };

    if (kind === "new_order") {
      // Crisp kitchen service bell double chime
      playTone(880, 0, 0.25, 0.09);
      playTone(1174.66, 0.14, 0.35, 0.09);
    } else if (kind === "item_ready") {
      // Uplifting 3-note pass-ready ping for waiters
      playTone(659.25, 0, 0.18, 0.08);
      playTone(783.99, 0.12, 0.18, 0.08);
      playTone(1046.5, 0.24, 0.32, 0.09);
    } else if (kind === "payment_success") {
      playTone(523.25, 0, 0.18, 0.07);
      playTone(659.25, 0.1, 0.2, 0.07);
      playTone(783.99, 0.2, 0.35, 0.08);
    } else {
      playTone(440, 0, 0.2, 0.08);
      playTone(392, 0.16, 0.25, 0.08);
    }
  } catch {
    // Ignore autoplay restriction errors before user gesture
  }
}

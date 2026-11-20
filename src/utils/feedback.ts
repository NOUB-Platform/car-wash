export type SoundEffectType = 'click' | 'success' | 'invoice' | 'sync' | 'error';

const SOUND_ENABLED_KEY = 'washcare_sound_enabled_v1';

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabledPref(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSoundEffect(effect: SoundEffectType): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    switch (effect) {
      case 'click':
        playTone(ctx, 640, 0, 0.055, 0.045, 'sine');
        break;
      case 'success':
        playTone(ctx, 523.25, 0, 0.11, 0.06, 'triangle');
        playTone(ctx, 659.25, 0.08, 0.14, 0.065, 'triangle');
        break;
      case 'invoice':
        playTone(ctx, 587.33, 0, 0.09, 0.06, 'triangle');
        playTone(ctx, 783.99, 0.07, 0.1, 0.065, 'triangle');
        playTone(ctx, 1046.5, 0.15, 0.22, 0.07, 'sine');
        break;
      case 'sync':
        playTone(ctx, 440, 0, 0.09, 0.05, 'sine');
        playTone(ctx, 554.37, 0.07, 0.1, 0.055, 'sine');
        playTone(ctx, 659.25, 0.14, 0.16, 0.06, 'sine');
        break;
      case 'error':
        playTone(ctx, 260, 0, 0.14, 0.06, 'sawtooth');
        playTone(ctx, 210, 0.12, 0.18, 0.05, 'sawtooth');
        break;
    }
  } catch {
    // Ignore audio context errors on restricted browsers
  }
}

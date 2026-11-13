/**
 * Sound, synthesised. No files, no CDN, nothing to fail to load.
 *
 * The audio context is only created after a real tap, which is also what the
 * browser requires before it will let us make noise at all.
 */

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (muted) return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  if (value && ctx) {
    void ctx.suspend();
  } else if (!value && ctx) {
    void ctx.resume();
  }
}

export function isMuted(): boolean {
  return muted;
}

function noiseBurst(duration: number, gain: number, filterHz: number, q = 1): void {
  const ac = audio();
  if (!ac) return;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterHz;
  filter.Q.value = q;
  const g = ac.createGain();
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

function tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine'): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

export const sfx = {
  tap(): void {
    noiseBurst(0.07, 0.12, 1800, 0.9);
  },
  stokeHit(): void {
    noiseBurst(0.22, 0.2, 420, 0.7);
    tone(78, 0.22, 0.16, 'sine');
  },
  stokeMiss(): void {
    noiseBurst(0.12, 0.08, 240, 1.4);
  },
  doorOpen(): void {
    noiseBurst(1.1, 0.16, 180, 0.5);
    tone(52, 1.2, 0.1, 'sine');
  },
  fine(): void {
    tone(660, 0.9, 0.1, 'sine');
    tone(990, 0.75, 0.055, 'sine');
  },
  transmuted(): void {
    tone(523.25, 1.2, 0.1, 'sine');
    tone(784, 1.0, 0.07, 'sine');
    tone(1046.5, 0.9, 0.05, 'sine');
  },
  dull(): void {
    tone(180, 0.4, 0.07, 'triangle');
  },
};

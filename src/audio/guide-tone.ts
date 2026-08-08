import { createAudioContext } from './context.js';
import { clamp01 } from '../math.js';
import type { Note } from '../engine/melody.js';

export const GUIDE_SECONDS = 12;

const FADE = 0.02;
const VOLUME = 0.15;

export interface GuideToneHandlers {
  durationSeconds?: number;
  onProgress?: (t: number) => void;
  onEnd?: () => void;
}

export interface GuideTone {
  play(guide: readonly Note[], handlers?: GuideToneHandlers): Promise<void>;
  stop(): void;
}

export function createGuideTone(): GuideTone {
  let audioCtx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let raf = 0;
  let token = 0;

  function teardown(): void {
    cancelAnimationFrame(raf);
    raf = 0;
    if (osc && gain && audioCtx) {
      const now = audioCtx.currentTime;
      osc.onended = null;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + FADE);
        osc.stop(now + FADE * 2);
      } catch {
        // Already stopped.
      }
      osc = null;
      gain = null;
    }
  }

  function stop(): void {
    token++;
    teardown();
  }

  async function play(
    guide: readonly Note[],
    { durationSeconds = GUIDE_SECONDS, onProgress, onEnd }: GuideToneHandlers = {},
  ): Promise<void> {
    stop();

    const firstNote = guide[0];
    if (!firstNote) return;

    const mine = ++token;

    audioCtx ??= createAudioContext();
    await audioCtx.resume();
    if (mine !== token) return;

    const ctx = audioCtx;
    const duration = Math.max(0.1, durationSeconds);
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain).connect(ctx.destination);

    const startedAt = ctx.currentTime + FADE;
    const endsAt = startedAt + duration;

    if (guide.some((note) => note.endT != null)) {
      scheduleTimedGain(gain.gain, guide, ctx.currentTime, startedAt, duration);
    } else {
      scheduleContinuousGain(gain.gain, ctx.currentTime, startedAt, endsAt);
    }

    osc.frequency.setValueAtTime(firstNote.hz, startedAt);
    for (const note of guide) {
      osc.frequency.setValueAtTime(note.hz, startedAt + note.t * duration);
    }

    osc.start();
    osc.stop(endsAt);

    osc.onended = () => {
      if (mine !== token) return;
      teardown();
      onEnd?.();
    };

    const step = (): void => {
      if (mine !== token) return;
      raf = requestAnimationFrame(step);
      onProgress?.(clamp01((ctx.currentTime - startedAt) / duration));
    };
    step();
  }

  return { play, stop };
}

function scheduleContinuousGain(param: AudioParam, now: number, startedAt: number, endsAt: number): void {
  param.setValueAtTime(0, now);
  param.linearRampToValueAtTime(VOLUME, startedAt);
  param.setValueAtTime(VOLUME, endsAt - FADE);
  param.linearRampToValueAtTime(0, endsAt);
}

function scheduleTimedGain(
  param: AudioParam,
  guide: readonly Note[],
  now: number,
  startedAt: number,
  duration: number,
): void {
  param.setValueAtTime(0, now);
  for (const note of guide) {
    const start = startedAt + clamp01(note.t) * duration;
    const end = startedAt + clamp01(note.endT ?? 1) * duration;
    if (end <= start) continue;

    const fade = Math.min(FADE, (end - start) / 3);
    param.setValueAtTime(0, Math.max(now, start - fade));
    param.linearRampToValueAtTime(VOLUME, start + fade);
    param.setValueAtTime(VOLUME, Math.max(start + fade, end - fade));
    param.linearRampToValueAtTime(0, end);
  }
}

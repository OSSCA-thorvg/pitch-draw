import type { Melody, Note } from './melody.js';

export interface RecordedPitchSample {
  readonly t: number;
  readonly hz: number;
}

interface Segment {
  readonly midi: number;
  readonly start: number;
  readonly end: number;
}

const MIN_SEGMENT_SECONDS = 0.08;
const MERGE_GAP_SECONDS = 0.14;

export function recordedSamplesToMelody(
  samples: readonly RecordedPitchSample[],
  label = '녹음한 노래',
): Melody {
  const voiced = samples
    .filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.hz) && sample.hz > 0)
    .sort((a, b) => a.t - b.t);
  if (!voiced.length) throw new Error('녹음된 음정을 찾지 못했습니다.');

  const segments = mergeSameMidi(filterShortSegments(segmentSamples(voiced)));
  if (!segments.length) throw new Error('너무 짧습니다. 첫 음부터 다시 불러주세요.');

  const start = segments[0]!.start;
  const end = Math.max(start + 1, segments[segments.length - 1]!.end);
  const notes: Note[] = segments.map((segment) => ({
    t: (segment.start - start) / (end - start),
    hz: hzOfMidi(segment.midi),
  }));
  return { label, notes, seconds: end - start };
}

function segmentSamples(samples: readonly RecordedPitchSample[]): Segment[] {
  const out: Segment[] = [];
  let midi = midiOf(samples[0]!.hz);
  let start = samples[0]!.t;
  let end = start;

  for (const sample of samples.slice(1)) {
    const next = midiOf(sample.hz);
    if (next !== midi) {
      out.push({ midi, start, end: sample.t });
      midi = next;
      start = sample.t;
    }
    end = sample.t;
  }
  out.push({ midi, start, end });
  return out;
}

function filterShortSegments(segments: readonly Segment[]): Segment[] {
  return segments.filter((segment) => segment.end - segment.start >= MIN_SEGMENT_SECONDS);
}

function mergeSameMidi(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const segment of segments) {
    const last = out[out.length - 1];
    if (last && last.midi === segment.midi && segment.start - last.end <= MERGE_GAP_SECONDS) {
      out[out.length - 1] = { midi: last.midi, start: last.start, end: segment.end };
    } else {
      out.push(segment);
    }
  }
  return out;
}

function midiOf(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

function hzOfMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

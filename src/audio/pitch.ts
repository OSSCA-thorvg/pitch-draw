/**
 * 음 높이 추출 — 자기상관(autocorrelation) 방식.
 *
 * 파형이 자기 자신과 얼마나 잘 겹치는지를 여러 지연값에 대해 재고,
 * 가장 잘 겹치는 지연을 주기로 본다. 그 주기의 역수가 주파수다.
 */

/** 이 값보다 조용하면 음정을 판단하지 않는다. */
const RMS_GATE = 0.008;

/** 파형 양끝을 자를 때 쓸 최대 기준. 입력이 크면 예전처럼 강하게 자른다. */
const MAX_TRIM_THRESHOLD = 0.2;

/**
 * 음정을 잡아볼 범위 (Hz) — 사람 목소리와 기타가 들어가는 대략의 폭.
 * 화면 세로에 대응시키는 "부를 수 있는 음역"과는 뜻이 다르다. 그쪽은 range.ts 에 있다.
 */
export const MIN_HZ = 70;
export const MAX_HZ = 1200;

/** 잡아낸 음 하나. 신뢰도는 0~1 이다. */
export interface Pitch {
  readonly hz: number;
  readonly clarity: number;
}

/** @returns 소리가 없거나 음정을 못 잡으면 null */
export function detectPitch(buf: Float32Array, sampleRate: number): Pitch | null {
  const size = buf.length;

  // 너무 조용하면 바로 포기 — 잡음에서 엉뚱한 음정이 나오는 걸 막는다.
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / size);
  if (rms < RMS_GATE) return null;

  // 앞뒤의 조용한 구간을 잘라낸다. 남는 구간만 비교해야 상관값이 선명해진다.
  const threshold = Math.min(MAX_TRIM_THRESHOLD, rms * 0.5);
  let start = 0;
  let end = size - 1;
  while (start < size / 2 && Math.abs(buf[start]!) < threshold) start++;
  while (end > size / 2 && Math.abs(buf[end]!) < threshold) end--;

  const trimmed = buf.slice(start, end);
  const n = trimmed.length;
  if (n < 128) return null;

  // 지연값별 상관값. 관심 있는 주파수 범위에 해당하는 지연만 본다.
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_HZ));
  if (maxLag <= minLag) return null;

  // 지연값마다 겹치는 구간의 길이가 다르지만, **나누는 값은 지연과 무관해야 한다.**
  // `/(n - lag)` 로 나누면 긴 지연일수록 적은 항을 적은 수로 나눠 상관값이 부풀고,
  // 주기의 2배·3배 지점이 진짜 주기와 같은 높이가 된다. 그러면 어느 봉우리가 이기는지를
  // 부동소수점 잡음이 정하고, 잡힌 음이 한두 옥타브씩 아래로 떨어진다.
  const corr = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i]! * trimmed[i + lag]!;
    corr[lag] = sum / n;
  }

  // 첫 번째 골짜기를 지난 뒤의 최고점을 찾는다.
  // 골짜기를 건너뛰지 않으면 lag=0 근처의 자기 자신과의 상관이 항상 이긴다.
  let lag = minLag;
  while (lag < maxLag && corr[lag]! > corr[lag + 1]!) lag++;

  let bestLag = -1;
  let bestVal = 0;
  for (let i = lag; i <= maxLag; i++) {
    if (corr[i]! > bestVal) {
      bestVal = corr[i]!;
      bestLag = i;
    }
  }
  if (bestLag <= 0) return null;

  // 포물선 보간 — 정수 지연값 사이의 실제 꼭짓점을 추정해 음정을 매끄럽게 만든다.
  const y0 = corr[bestLag - 1] ?? bestVal;
  const y1 = bestVal;
  const y2 = corr[bestLag + 1] ?? bestVal;
  const denom = 2 * (2 * y1 - y0 - y2);
  const shift = denom !== 0 ? (y2 - y0) / denom : 0;

  const hz = sampleRate / (bestLag + shift);
  if (hz < MIN_HZ || hz > MAX_HZ) return null;

  // 상관값을 0번 지연(자기 자신)으로 정규화하면 0~1의 신뢰도가 된다.
  let energy = 0;
  for (let i = 0; i < n; i++) energy += trimmed[i]! * trimmed[i]!;
  const clarity = energy > 0 ? bestVal / (energy / n) : 0;

  if (clarity < 0.35) return null;

  return { hz, clarity: Math.min(1, clarity) };
}

/** 표시용 음이름 (A4 = 440Hz 기준) */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SOLFEGE_NAMES = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'] as const;

export function hzToNoteName(hz: number): string {
  const midi = midiFromHz(hz);
  return NOTE_NAMES[((midi % 12) + 12) % 12] + String(Math.floor(midi / 12) - 1);
}

export function hzToSolfegeName(hz: number): string {
  const midi = midiFromHz(hz);
  return SOLFEGE_NAMES[((midi % 12) + 12) % 12] + String(Math.floor(midi / 12) - 1);
}

function midiFromHz(hz: number): number {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return midi;
}

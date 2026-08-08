/**
 * MIDI 시계 — tick 이 초로 옮겨지는지.
 * midi.test.ts 가 전체 경로를 훑지만, SMPTE 처럼 실제 파일로는 잘 안 만나는 갈래는 여기서 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMidiClock } from './midi-clock.js';

const TPQ = 480;

test('tempo 가 없으면 120BPM — 4분음표가 0.5초다', () => {
  const clock = createMidiClock(TPQ, []);
  assert.equal(clock(0), 0);
  assert.ok(Math.abs(clock(TPQ) - 0.5) < 1e-9);
  assert.ok(Math.abs(clock(TPQ * 4) - 2) < 1e-9);
});

test('tempo 를 적으면 그대로 따른다', () => {
  const clock = createMidiClock(TPQ, [{ tick: 0, usPerQuarter: 1_000_000 }]); // 60BPM
  assert.ok(Math.abs(clock(TPQ) - 1) < 1e-9);
});

test('도중에 바뀌면 그 지점부터 다르게 흐른다', () => {
  const clock = createMidiClock(TPQ, [
    { tick: 0, usPerQuarter: 500_000 },        // 120BPM
    { tick: TPQ * 2, usPerQuarter: 1_000_000 }, // 그 뒤로 60BPM
  ]);
  assert.ok(Math.abs(clock(TPQ * 2) - 1) < 1e-9, '앞 두 박은 1초');
  assert.ok(Math.abs(clock(TPQ * 3) - 2) < 1e-9, '세 번째 박은 1초짜리');
  assert.ok(Math.abs(clock(TPQ * 4) - 3) < 1e-9);
});

test('첫 tempo 가 0 보다 뒤에 있어도 그 앞은 기본값으로 흐른다', () => {
  const clock = createMidiClock(TPQ, [{ tick: TPQ, usPerQuarter: 1_000_000 }]);
  assert.ok(Math.abs(clock(TPQ) - 0.5) < 1e-9, '첫 박은 아직 120BPM');
  assert.ok(Math.abs(clock(TPQ * 2) - 1.5) < 1e-9, '그 뒤는 60BPM');
});

test('SMPTE 는 tempo 와 무관하게 초당 tick 이 고정이다', () => {
  // 상위 바이트 -25 프레임/초, 하위 40 tick/프레임 → 초당 1000 tick
  const division = ((256 - 25) << 8) | 40;
  const clock = createMidiClock(division, [{ tick: 0, usPerQuarter: 1_000_000 }]);
  assert.ok(Math.abs(clock(1000) - 1) < 1e-9, 'tempo 를 무시해야 한다');
  assert.ok(Math.abs(clock(2500) - 2.5) < 1e-9);
});

test('division 이 0 인 깨진 파일에도 나누기로 죽지 않는다', () => {
  const clock = createMidiClock(0, []);
  assert.ok(Number.isFinite(clock(1000)));
});

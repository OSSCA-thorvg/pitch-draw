/**
 * MIDI 악보 읽기 — 손으로 만든 파일로 확인한다.
 *
 * 진짜 .mid 파일을 저장소에 넣지 않는다. 바이트를 직접 짜면 무엇을 시험하는지가
 * 테스트 안에 다 보이고, 어느 바이트가 문제인지도 바로 안다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiToMelody } from './midi.js';
import { buildMidi } from './midi.fixture.js';
import { noteAt, SING_LOW_HZ, SING_HIGH_HZ } from './melody.js';

test('음높이와 순서를 읽는다', () => {
  // C4 D4 E4 G4 — 옥타브를 옮겨도 음 사이 간격은 그대로여야 한다
  const melody = midiToMelody(buildMidi([[[0, 60], [48, 62], [48, 64], [48, 67]]]), '테스트');
  assert.equal(melody.notes.length, 4);
  assert.equal(melody.label, '테스트');

  const cents = (a: number, b: number): number => 1200 * Math.log2(b / a);
  const hz = melody.notes.map((n) => n.hz);
  assert.ok(Math.abs(cents(hz[0]!, hz[1]!) - 200) < 1e-6, '도→레 는 온음');
  assert.ok(Math.abs(cents(hz[1]!, hz[2]!) - 200) < 1e-6, '레→미 는 온음');
  assert.ok(Math.abs(cents(hz[2]!, hz[3]!) - 300) < 1e-6, '미→솔 은 단3도');
});

test('시간 축이 0 에서 시작해 커진다', () => {
  const melody = midiToMelody(buildMidi([[[0, 60], [48, 62], [96, 64]]]), 'x');
  assert.equal(melody.notes[0]!.t, 0);
  for (let i = 1; i < melody.notes.length; i++) {
    assert.ok(melody.notes[i]!.t > melody.notes[i - 1]!.t, '시간이 뒤로 가지 않는다');
    assert.ok(melody.notes[i]!.t < 1, '마지막 음도 자리를 차지한다');
  }
  // 간격이 두 배면 t 간격도 두 배다
  const [a, b, c] = melody.notes.map((n) => n.t) as [number, number, number];
  assert.ok(Math.abs((c - b) / (b - a) - 2) < 1e-6, `길이 비율이 안 맞는다 (${b - a}, ${c - b})`);
});

test('악기가 무엇이든 목소리 음역으로 옮겨진다', () => {
  // 콘트라베이스처럼 아주 낮게, 피콜로처럼 아주 높게 적힌 같은 곡
  const low = midiToMelody(buildMidi([[[0, 24], [48, 26], [48, 28]]]), '낮게');
  const high = midiToMelody(buildMidi([[[0, 96], [48, 98], [48, 100]]]), '높게');

  for (const melody of [low, high]) {
    for (const note of melody.notes) {
      assert.ok(
        note.hz > SING_LOW_HZ / 2 && note.hz < SING_HIGH_HZ * 2,
        `${melody.label}: ${note.hz.toFixed(1)}Hz 는 못 부른다`,
      );
    }
  }
  // 옥타브만 옮겼으므로 두 곡의 음 간격은 완전히 같다
  const shape = (m: typeof low): number[] =>
    m.notes.map((n) => 1200 * Math.log2(n.hz / m.notes[0]!.hz));
  assert.deepEqual(
    shape(low).map((c) => Math.round(c)),
    shape(high).map((c) => Math.round(c)),
  );
});

test('성부가 여럿이면 선율선을 고른다', () => {
  // 반주 트랙은 화음이라 note-on 이 많지만, 같은 시각의 화음은 한 음으로 줄어든다.
  const accompaniment: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    accompaniment.push([i === 0 ? 0 : 96, 48], [0, 52], [0, 55]); // 같은 시각의 3화음
  }
  const tune: [number, number][] = [[0, 72], [48, 74], [48, 76], [48, 77], [48, 79], [48, 81]];

  const melody = midiToMelody(buildMidi([accompaniment, tune]), '두 성부');
  assert.equal(melody.notes.length, 6, '음이 더 많은 선율선을 골라야 한다');
});

test('세기 0 인 note-on 은 음이 아니다', () => {
  // 많은 사보 프로그램이 note-off 대신 세기 0 의 note-on 을 쓴다. 쉼표를 음으로 세면 안 된다.
  const bytes = buildMidi([[[0, 60], [48, 62]]]);
  const melody = midiToMelody(bytes, 'x');
  assert.equal(melody.notes.length, 2);
});

test('한 음짜리 악보도 받는다', () => {
  const melody = midiToMelody(buildMidi([[[0, 69]]]), '한 음');
  assert.equal(melody.notes.length, 1);
  assert.equal(melody.notes[0]!.t, 0);
  assert.equal(noteAt(melody, 0.5), melody.notes[0]!.hz, '내내 그 음이다');
});

test('tempo 로 곡의 실제 길이를 잰다', () => {
  // 4분음표 4개(각 480tick), 120BPM → 4분음표 하나가 0.5초 → 2초짜리 곡
  const melody = midiToMelody(buildMidi([[[0, 60], [480, 62], [480, 64], [480, 65]]]), 'x');
  assert.ok(melody.seconds !== null);
  assert.ok(Math.abs(melody.seconds! - 2) < 0.01, `${melody.seconds}초로 쟀다`);
});

test('tempo 가 다르면 길이도 다르다', () => {
  const notes: [number, number][] = [[0, 60], [480, 62], [480, 64], [480, 65]];
  const fast = midiToMelody(buildMidi([notes], [[0, 240]]), '빠르게');
  const slow = midiToMelody(buildMidi([notes], [[0, 60]]), '느리게');
  assert.ok(Math.abs(fast.seconds! - 1) < 0.01, `빠른 곡이 ${fast.seconds}초`);
  assert.ok(Math.abs(slow.seconds! - 4) < 0.01, `느린 곡이 ${slow.seconds}초`);

  // 길이는 달라도 음이 놓인 자리(0~1)는 같다 — 같은 곡이니까
  assert.deepEqual(
    fast.notes.map((n) => Number(n.t.toFixed(6))),
    slow.notes.map((n) => Number(n.t.toFixed(6))),
  );
});

test('곡 도중 tempo 가 바뀌면 음의 자리도 그만큼 밀린다', () => {
  // 네 음이 tick 으로는 등간격인데, 세 번째 음부터 두 배 느려진다.
  const notes: [number, number][] = [[0, 60], [480, 62], [480, 64], [480, 65]];
  const steady = midiToMelody(buildMidi([notes], [[0, 120]]), '고른');
  const slowing = midiToMelody(buildMidi([notes], [[0, 120], [960, 60]]), '느려짐');

  const gaps = (m: typeof steady): number[] =>
    m.notes.slice(1).map((n, i) => n.t - m.notes[i]!.t);

  const [a, b, c] = gaps(steady) as [number, number, number];
  assert.ok(Math.abs(a - b) < 1e-6 && Math.abs(b - c) < 1e-6, '고른 곡은 간격이 같다');

  const [, , third] = gaps(slowing) as [number, number, number];
  const [first] = gaps(slowing) as [number, number, number];
  assert.ok(third > first * 1.5, `느려진 구간의 간격이 안 늘었다 (${first} → ${third})`);
});

test('tempo 가 없으면 규격 기본값 120BPM 으로 본다', () => {
  const melody = midiToMelody(buildMidi([[[0, 60], [480, 62]]]), 'x');
  // 4분음표 2개 = 1초
  assert.ok(Math.abs(melody.seconds! - 1) < 0.01, `${melody.seconds}초`);
});

test('MIDI 가 아니면 조용히 넘어가지 않고 던진다', () => {
  assert.throws(() => midiToMelody(new Uint8Array([1, 2, 3]), 'x'), /MIDI 파일이 아닙니다/);
  assert.throws(
    () => midiToMelody(new Uint8Array(20), 'x'),
    /MIDI 파일이 아닙니다/,
  );
});

test('음이 하나도 없는 악보는 사유를 말한다', () => {
  assert.throws(() => midiToMelody(buildMidi([[]]), 'x'), /음이 하나도 없습니다/);
});

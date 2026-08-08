/**
 * 멜로디 — 표기를 음으로.
 *
 * 이걸 잘못 읽으면 부를 노래 자체가 달라진다. 사용자는 자기가 잘못 부른 줄 알고
 * 끝까지 원인을 못 찾는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MELODIES, noteAt, parseMelody } from './melody.js';

/** A4 = 440Hz 기준으로 음이름을 주파수로. 테스트가 스스로 아는 값이어야 한다. */
const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
const C4 = hz(60), D4 = hz(62), E4 = hz(64), A4 = 440;

test('계이름과 음이름을 같이 읽는다', () => {
  const korean = parseMelody('도 레 미');
  const english = parseMelody('C D E');
  assert.deepEqual(korean.notes.map((n) => n.hz), english.notes.map((n) => n.hz));
  assert.ok(Math.abs(korean.notes[0]!.hz - C4) < 1e-9, '옥타브를 안 적으면 4옥타브');
  assert.ok(Math.abs(korean.notes[1]!.hz - D4) < 1e-9);
  assert.ok(Math.abs(korean.notes[2]!.hz - E4) < 1e-9);
});

test('옥타브를 적을 수 있다', () => {
  assert.ok(Math.abs(parseMelody('A4').notes[0]!.hz - A4) < 1e-9);
  assert.ok(Math.abs(parseMelody('A5').notes[0]!.hz - A4 * 2) < 1e-9);
  assert.ok(Math.abs(parseMelody('A3').notes[0]!.hz - A4 / 2) < 1e-9);
});

test('올림과 내림', () => {
  const sharp = parseMelody('C#4').notes[0]!.hz;
  const flat = parseMelody('Db4').notes[0]!.hz;
  assert.ok(Math.abs(sharp - flat) < 1e-9, 'C# 과 Db 는 같은 음이다');
  assert.ok(Math.abs(1200 * Math.log2(sharp / C4) - 100) < 1e-9, '반음 위');
});

test('늘임표는 앞 음을 늘린다', () => {
  const melody = parseMelody('도 - - 레');
  assert.equal(melody.notes.length, 4, '늘임표도 박을 차지한다');
  assert.ok(Math.abs(melody.notes[1]!.hz - C4) < 1e-9);
  assert.ok(Math.abs(melody.notes[2]!.hz - C4) < 1e-9);
  assert.ok(Math.abs(melody.notes[3]!.hz - D4) < 1e-9);
});

test('시간 축은 0 에서 시작해 고르게 퍼진다', () => {
  const melody = parseMelody('도 레 미 파');
  assert.deepEqual(melody.notes.map((n) => n.t), [0, 0.25, 0.5, 0.75]);
});

test('진행도에서 지금 낼 음을 꺼낸다 — 미끄러지지 않고 건너뛴다', () => {
  const melody = parseMelody('도 레 미 파');
  assert.ok(Math.abs(noteAt(melody, 0) - C4) < 1e-9);
  assert.ok(Math.abs(noteAt(melody, 0.24) - C4) < 1e-9, '한 음 안에서는 값이 변하지 않는다');
  assert.ok(Math.abs(noteAt(melody, 0.26) - D4) < 1e-9, '경계를 넘으면 다음 음으로 건너뛴다');
  assert.ok(Math.abs(noteAt(melody, 1) - hz(65)) < 1e-9, '끝은 마지막 음');
  assert.ok(Math.abs(noteAt(melody, 5) - hz(65)) < 1e-9, '넘어가도 마지막 음');
  assert.ok(Math.abs(noteAt(melody, -3) - C4) < 1e-9, '음수도 안전하게');
});

test('읽을 수 없는 표기는 어느 토막이 문제인지 말해준다', () => {
  assert.throws(() => parseMelody('도 레 뷁'), /뷁/);
  assert.throws(() => parseMelody('도 레 H4'), /H4/);
  assert.throws(() => parseMelody('   '), /비어 있습니다/);
  assert.throws(() => parseMelody('- 도'), /늘임표/);
});

test('내장 멜로디는 전부 읽힌다', () => {
  assert.ok(MELODIES.length >= 3);
  for (const melody of MELODIES) {
    assert.ok(melody.notes.length > 0, `${melody.label} 이 비어 있다`);
    assert.ok(melody.label.length > 0);
    for (const note of melody.notes) {
      // 사람이 부를 수 있는 범위 안이어야 한다. 밖이면 아무도 못 맞춘다.
      assert.ok(note.hz > 100 && note.hz < 900, `${melody.label} 에 ${note.hz}Hz 가 있다`);
    }
  }
});

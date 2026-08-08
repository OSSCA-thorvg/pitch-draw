/**
 * 음 높이 추출 — 합성한 파형으로 확인한다. 마이크도 브라우저도 필요 없다.
 *
 * 여기가 틀리면 사용자가 정확히 불러도 펜이 엉뚱한 데로 간다. 그런데 실제 목소리로는
 * "틀린 건지 내가 못 부른 건지"를 구별할 수 없다. 그래서 아는 파형으로 재야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, hzToNoteName, hzToSolfegeName, MIN_HZ, MAX_HZ } from './pitch.js';

const RATE = 44100;

/** 배음을 섞은 톱니에 가까운 파형. 순수 사인파만 통과하는 검출기는 목소리를 못 잡는다. */
function tone(hz: number, { harmonics = 1, amplitude = 0.5, size = 2048 } = {}): Float32Array {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += Math.sin((2 * Math.PI * hz * h * i) / RATE) / h;
    buf[i] = v * amplitude;
  }
  return buf;
}

test('사인파의 음을 잡아낸다', () => {
  for (const hz of [110, 220, 440, 523.25]) {
    const found = detectPitch(tone(hz), RATE);
    assert.ok(found, `${hz}Hz 를 못 잡았다`);
    const cents = Math.abs(1200 * Math.log2(found.hz / hz));
    assert.ok(cents < 20, `${hz}Hz → ${found.hz.toFixed(2)}Hz (${cents.toFixed(1)}센트 어긋남)`);
  }
});

test('배음이 섞여도 기음을 잡는다 — 한 옥타브 위로 튀지 않는다', () => {
  // 목소리와 악기는 배음을 갖는다. 자기상관이 배음에 걸리면 음이 옥타브씩 튄다.
  for (const hz of [147, 196, 294]) {
    const found = detectPitch(tone(hz, { harmonics: 6 }), RATE);
    assert.ok(found, `${hz}Hz 를 못 잡았다`);
    const cents = Math.abs(1200 * Math.log2(found.hz / hz));
    assert.ok(cents < 30, `${hz}Hz → ${found.hz.toFixed(2)}Hz (${cents.toFixed(1)}센트 어긋남)`);
  }
});

test('조용하면 음정을 판단하지 않는다', () => {
  assert.equal(detectPitch(new Float32Array(2048), RATE), null, '완전한 침묵');
  assert.equal(detectPitch(tone(440, { amplitude: 0.001 }), RATE), null, '잡음 수준');
});

test('작게 들어온 신호도 게이트를 넘으면 음정을 잡아낸다', () => {
  const found = detectPitch(tone(220, { amplitude: 0.02 }), RATE);
  assert.ok(found, '작지만 충분한 신호를 못 잡았다');

  const cents = Math.abs(1200 * Math.log2(found.hz / 220));
  assert.ok(cents < 25, `220Hz → ${found.hz.toFixed(2)}Hz (${cents.toFixed(1)}센트 어긋남)`);
});

test('내놓는 음은 반드시 잡아볼 범위 안이다', () => {
  // 범위 밖의 소리를 넣으면 못 잡는 게 정상이다(주기가 분석 창에 안 들어간다).
  // 다만 **범위 밖의 값을 내놓아서는 안 된다** — 그 값이 그대로 펜을 화면 밖으로 끌고 간다.
  for (const hz of [MIN_HZ / 2, MIN_HZ / 4, MAX_HZ * 2, MAX_HZ * 4]) {
    const found = detectPitch(tone(hz), RATE);
    if (found) {
      assert.ok(
        found.hz >= MIN_HZ && found.hz <= MAX_HZ,
        `${hz}Hz 를 넣었더니 범위 밖인 ${found.hz}Hz 가 나왔다`,
      );
    }
  }
});

test('신뢰도는 0~1 이고, 맑은 소리일수록 높다', () => {
  const clean = detectPitch(tone(220), RATE)!;
  assert.ok(clean.clarity > 0 && clean.clarity <= 1, `신뢰도 ${clean.clarity}`);
  assert.ok(clean.clarity > 0.5, '순수한 사인파는 신뢰도가 높아야 한다');
});

test('음이름 — A4 는 440Hz 다', () => {
  assert.equal(hzToNoteName(440), 'A4');
  assert.equal(hzToNoteName(261.63), 'C4');
  assert.equal(hzToNoteName(130.81), 'C3');
  assert.equal(hzToNoteName(880), 'A5');
});

test('계이름도 같이 표시할 수 있다', () => {
  assert.equal(hzToSolfegeName(440), '라4');
  assert.equal(hzToSolfegeName(261.63), '도4');
  assert.equal(hzToSolfegeName(329.63), '미4');
});

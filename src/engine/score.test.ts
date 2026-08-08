/**
 * 목표선 위의 한 점 — 연주 중의 펜과 가이드 재생 중의 펜이 같은 자리를 짚어야 한다.
 * 둘이 어긋나면 "가이드에서 본 그 자리"가 연주에서 다른 곳이 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointOnScore, type Score } from './score.js';

const score: Score = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 20 },
    { x: 20, y: 0 },
  ],
  length: 100,
  shapeCount: 1,
};

test('양 끝은 악보의 양 끝이다', () => {
  assert.deepEqual(pointOnScore(score, 0), score.points[0]);
  assert.deepEqual(pointOnScore(score, 1), score.points[2]);
});

test('점 사이는 선형 보간한다', () => {
  assert.deepEqual(pointOnScore(score, 0.25), { x: 5, y: 10 });
  assert.deepEqual(pointOnScore(score, 0.5), { x: 10, y: 20 });
  assert.deepEqual(pointOnScore(score, 0.75), { x: 15, y: 10 });
});

test('0~1 을 벗어난 값도 안전하게 받는다', () => {
  // 진행도는 클램프되어 들어오지만, 여기서 죽으면 프레임 루프가 통째로 선다.
  assert.deepEqual(pointOnScore(score, -5), score.points[0]);
  assert.deepEqual(pointOnScore(score, 99), score.points[2]);
  assert.deepEqual(pointOnScore(score, Number.NEGATIVE_INFINITY), score.points[0]);
});

test('진행도가 늘면 앞으로만 간다', () => {
  let previous = -Infinity;
  for (let i = 0; i <= 50; i++) {
    const { x } = pointOnScore(score, i / 50);
    assert.ok(x >= previous, '뒤로 가지 않는다');
    previous = x;
  }
});

test('점이 모자라면 조용히 이상한 값을 주지 않고 던진다', () => {
  const broken: Score = { ...score, points: [{ x: 0, y: 0 }] };
  assert.throws(() => pointOnScore(broken, 0.5), /점이 모자랍니다/);
});

/**
 * 궤적 — 상한에 닿았을 때 무엇을 지키는가.
 *
 * 결과 화면은 "내가 그린 것"을 통째로 보여주는 자리다. 오래된 점을 버리면 그림의 처음이
 * 사라져 그 화면이 성립하지 않는다. 그래서 앞을 버리지 않는다는 것이 여기서 지킬 규칙이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrail } from './trail.js';

test('넣은 대로 쌓인다', () => {
  const trail = createTrail();
  trail.push({ x: 1, y: 2 });
  trail.push({ x: 3, y: 4 });
  assert.deepEqual([...trail.points], [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
});

test('상한을 넘겨 넣어도 그림의 처음은 절대 사라지지 않는다', () => {
  const trail = createTrail();
  const first = { x: 0, y: 0 };
  trail.push(first);
  for (let i = 1; i < 20000; i++) trail.push({ x: i, y: i });

  assert.equal(trail.points[0], first, '첫 점이 그대로 있다');
  assert.ok(trail.points.length > 100, '너무 많이 솎지는 않는다');
});

test('점 개수에 상한이 있다 — 오래 불러도 메모리가 늘지 않는다', () => {
  const trail = createTrail();
  for (let i = 0; i < 50000; i++) {
    trail.push({ x: i, y: i });
    assert.ok(trail.points.length <= 2000, `${i}번째에서 ${trail.points.length}개`);
  }
});

test('솎아내도 그린 구간 전체를 덮는다', () => {
  // 솎아내기는 해상도를 낮추는 것이지 뒷부분을 잘라내는 것이 아니다.
  const trail = createTrail();
  for (let i = 0; i < 20000; i++) trail.push({ x: i, y: i });

  const xs = trail.points.map((p) => p.x);
  assert.equal(xs[0], 0, '처음부터');
  assert.ok(xs[xs.length - 1]! > 19000, `끝까지 (마지막이 ${xs[xs.length - 1]})`);
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i]! > xs[i - 1]!, '순서가 뒤집히지 않는다');
  }
});

test('clear 하면 솎아낸 정도까지 처음으로 돌아간다', () => {
  const trail = createTrail();
  for (let i = 0; i < 20000; i++) trail.push({ x: i, y: i });
  trail.clear();
  assert.equal(trail.points.length, 0);

  // 솎아내기가 리셋되지 않으면 다시 시작한 연주의 앞부분이 듬성듬성해진다.
  trail.push({ x: 1, y: 1 });
  trail.push({ x: 2, y: 2 });
  assert.equal(trail.points.length, 2, '다시 시작하면 모든 점이 남는다');
});

test('렌더러가 들고 있는 배열이 갈아치워지지 않는다', () => {
  // 렌더러는 이 배열을 참조만 한다. 갈아치우면 매 프레임 다시 물어봐야 한다.
  const trail = createTrail();
  const held = trail.points;
  for (let i = 0; i < 20000; i++) trail.push({ x: i, y: i });
  trail.clear();
  trail.push({ x: 1, y: 1 });
  assert.equal(trail.points, held, '같은 배열이어야 한다');
});

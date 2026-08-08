/**
 * 벗어난 정도 — 이 앱의 성공 신호가 걸려 있는 곳.
 *
 * 첫 번째 테스트가 이 저장소에서 가장 중요한 테스트다. 정확히 부른 순간의 변위가
 * 정확히 0 이 아니면 "정확히 부르면 그림이 그대로 그려진다"가 거짓이 되고,
 * 그러면 이 게임에는 성공을 알리는 방법이 없어진다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsBetween, offsetYFromCents } from './deviation.js';
import { STAGE_PAD } from '../stage.js';

test('정확히 부르면 변위가 정확히 0 이다', () => {
  assert.equal(offsetYFromCents(0), 0);
  // 같은 음을 넣으면 오차도 정확히 0 이어야 한다 — 부동소수점으로도.
  for (const hz of [130, 220, 261.6255653, 440, 622]) {
    assert.equal(centsBetween(hz, hz), 0);
    assert.equal(offsetYFromCents(centsBetween(hz, hz)), 0);
  }
});

test('높게 부르면 위로, 낮게 부르면 아래로', () => {
  assert.ok(offsetYFromCents(50) < 0, '높으면 y 가 줄어야(위로) 한다');
  assert.ok(offsetYFromCents(-50) > 0, '낮으면 y 가 늘어야(아래로) 한다');
});

test('더 많이 틀리면 더 많이 밀려난다', () => {
  let previous = 0;
  for (let cents = 10; cents <= 2000; cents += 10) {
    const px = Math.abs(offsetYFromCents(cents));
    assert.ok(px > previous, `${cents}센트에서 되돌아갔다`);
    previous = px;
  }
});

test('아무리 틀려도 종이를 뚫지 않는다', () => {
  // 목표선은 여백 안쪽에 그려진다. 여백만큼 밀려나면 정확히 종이 끝이다.
  for (const cents of [1200, 4800, 100000, Infinity]) {
    assert.ok(Math.abs(offsetYFromCents(cents)) <= STAGE_PAD, `${cents}센트에서 넘쳤다`);
    assert.ok(Math.abs(offsetYFromCents(-cents)) <= STAGE_PAD, `${-cents}센트에서 넘쳤다`);
  }
});

test('음역 끝에서 달라붙지 않는다', () => {
  // 클램프면 아주 낮게 부른 구간이 바닥을 따라 기어가는 깔끔한 직선이 된다.
  // 그건 "재밌게 망함"이 아니라 "기능이 안 됨"으로 읽힌다.
  const a = Math.abs(offsetYFromCents(2400));
  const b = Math.abs(offsetYFromCents(3600));
  assert.ok(b > a, '더 벗어나면 조금이라도 더 밀려나야 한다');
});

test('판정폭 안에서는 변위가 눈에 띄지 않는다', () => {
  // 25센트가 "맞습니다" 판정폭이다. 그 안에서 선이 크게 흔들리면 맞춰도 틀려 보인다.
  assert.ok(Math.abs(offsetYFromCents(25)) < 8, '판정폭 안에서 너무 많이 흔들린다');
  assert.ok(Math.abs(offsetYFromCents(25)) > 2, '판정폭 끝에서 아예 안 움직이면 피드백이 없다');
});

test('센트 — 한 옥타브가 1200센트다', () => {
  assert.ok(Math.abs(centsBetween(880, 440) - 1200) < 1e-9);
  assert.ok(Math.abs(centsBetween(220, 440) + 1200) < 1e-9);
});

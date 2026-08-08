/**
 * 세션 엔진 — 이 게임의 규칙 둘이 실제로 지켜지는지.
 *
 *   - 정확히 부르면 펜이 목표선 위를 지난다. 틀린 만큼만 선에서 밀려난다.
 *   - 진행도는 음정이 잡히는 프레임에만 는다. 그래서 숨이 곧 시간이 된다.
 *
 * `createSessionFromScore` 가 `createSession` 과 따로 있는 이유가 여기 있다 —
 * SVG 를 읽는 일은 브라우저를 요구하지만, 진행 규칙은 이렇게 혼자 확인할 수 있다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionFromScore } from './session.js';
import { parseMelody, TARGET_SECONDS } from './melody.js';
import type { Point, Score } from './score.js';

const melody = parseMelody('도 레 미 파 솔 라 시 도5');

/** 오르내리는 목표선. 세로로 움직여야 "선 위를 지난다"가 의미를 갖는다. */
function wavyScore(count = 200): Score {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * Math.PI * 4;
    points.push({ x: 60 + (i / (count - 1)) * 840, y: 270 + 150 * Math.sin(t) });
  }
  return { points, length: 1000, shapeCount: 1 };
}

/** 매 프레임 목표 음을 정확히 내는 연주자. */
function singPerfectly(score: Score, fps = 60): Point[] {
  const session = createSessionFromScore(score, melody);
  const dt = 1 / fps;
  while (!session.state().done) {
    const ahead = Math.min(1, session.state().progress + dt / TARGET_SECONDS);
    session.advance({ hz: session.targetHzAt(ahead), dt });
  }
  return session.state().trail.map((p) => ({ x: p.x, y: p.y }));
}

test('정확히 부르면 궤적이 목표선 위에 정확히 얹힌다', () => {
  // 이 저장소에서 가장 중요한 테스트다. 이게 거짓이면 "그림이 제대로 그려진다"가 거짓이 된다.
  const score = wavyScore();
  const session = createSessionFromScore(score, melody);
  const dt = 1 / 60;

  while (!session.state().done) {
    const ahead = Math.min(1, session.state().progress + dt / TARGET_SECONDS);
    const view = session.advance({ hz: session.targetHzAt(ahead), dt });
    const onLine = session.pointAt(view.progress);
    assert.ok(Math.abs(view.pen.x - onLine.x) < 1e-9, '가로는 언제나 목표선 위다');
    assert.ok(
      Math.abs(view.pen.y - onLine.y) < 1e-9,
      `세로가 ${(view.pen.y - onLine.y).toFixed(6)}px 벗어났다 — 정확히 불렀는데도`,
    );
  }
  assert.equal(session.state().averageErrorCents, 0, '오차도 정확히 0 이다');
});

test('틀린 만큼만 선에서 밀려난다 — 가로는 영향받지 않는다', () => {
  const score = wavyScore();
  const session = createSessionFromScore(score, melody);
  const dt = 1 / 60;

  for (let i = 0; i < 200; i++) {
    const ahead = Math.min(1, session.state().progress + dt / TARGET_SECONDS);
    // 목표보다 반음 높게 부른다
    const view = session.advance({ hz: session.targetHzAt(ahead) * Math.pow(2, 1 / 12), dt });
    const onLine = session.pointAt(view.progress);
    assert.ok(Math.abs(view.pen.x - onLine.x) < 1e-9, '가로는 음정과 무관하다');
    if (i > 5) assert.ok(view.pen.y < onLine.y, '높게 불렀으면 선 위로 올라가 있어야 한다');
  }
});

test('소리가 없으면 아무 일도 일어나지 않는다', () => {
  const session = createSessionFromScore(wavyScore(), melody);
  for (let i = 0; i < 200; i++) session.advance({ hz: null, dt: 1 / 60 });
  const view = session.state();
  assert.equal(view.progress, 0, '진행도가 늘지 않는다');
  assert.equal(view.trail.length, 0, '궤적이 남지 않는다');
  assert.equal(view.errorCents, null);
  assert.equal(view.done, false);
});

test('진행도는 낸 시간에 비례한다 — 경로 길이가 아니라', () => {
  const session = createSessionFromScore(wavyScore(), melody);
  const view = session.advance({ hz: 300, dt: TARGET_SECONDS / 4 });
  assert.ok(Math.abs(view.progress - 0.25) < 1e-9);

  // 경로가 열 배 길어도 완주 시간은 같아야 한다 — 30초짜리 곡은 아무도 끝까지 안 한다.
  const longer = createSessionFromScore({ ...wavyScore(), length: 10000 }, melody);
  const other = longer.advance({ hz: 300, dt: TARGET_SECONDS / 4 });
  assert.ok(Math.abs(other.progress - view.progress) < 1e-9);
});

test('목표 음은 노래에서 나온다 — 그림에서가 아니다', () => {
  // 같은 그림에 다른 노래를 얹으면 목표가 달라져야 한다.
  const score = wavyScore();
  const a = createSessionFromScore(score, parseMelody('도 도 도 도'));
  const b = createSessionFromScore(score, parseMelody('솔 솔 솔 솔'));
  assert.notEqual(a.targetHzAt(0.5), b.targetHzAt(0.5));
  assert.equal(a.targetHzAt(0.1), a.targetHzAt(0.9), '한 음짜리 노래는 내내 같은 음');

  // 그림이 달라도 노래가 같으면 목표 음은 같다.
  const c = createSessionFromScore(wavyScore(37), parseMelody('도 도 도 도'));
  assert.equal(a.targetHzAt(0.5), c.targetHzAt(0.5));
});

test('프레임률이 달라도 같은 그림이 나온다', () => {
  const score = wavyScore();
  const slow = singPerfectly(score, 24);
  const fast = singPerfectly(score, 144);
  for (const point of slow) {
    const nearest = fast.reduce((best, p) =>
      Math.abs(p.x - point.x) < Math.abs(best.x - point.x) ? p : best);
    assert.ok(Math.abs(nearest.y - point.y) < 1, `x=${point.x.toFixed(0)} 에서 갈렸다`);
  }
});

test('평균 오차는 소리를 낸 프레임만 센다', () => {
  const flat = parseMelody('라4');
  const session = createSessionFromScore(wavyScore(), flat);
  assert.equal(session.state().averageErrorCents, null, '한 번도 안 냈으면 null');

  const target = session.targetHzAt(0);
  for (let i = 0; i < 30; i++) {
    session.advance({ hz: null, dt: 1 / 60 });                             // 침묵은 안 세어야 한다
    session.advance({ hz: target * Math.pow(2, 100 / 1200), dt: 1 / 60 }); // 정확히 +100센트
  }
  const avg = session.state().averageErrorCents!;
  assert.ok(Math.abs(avg - 100) < 1e-6, `평균이 ${avg} 센트`);
});

test('악보가 자기 길이를 알면 그만큼 걸린다 — 다만 소리가 날 때만 흐른다', () => {
  const short = { label: '짧은 곡', seconds: 10, notes: [{ t: 0, hz: 440 }] };
  const long = { label: '긴 곡', seconds: 40, notes: [{ t: 0, hz: 440 }] };

  const a = createSessionFromScore(wavyScore(), short);
  const b = createSessionFromScore(wavyScore(), long);
  assert.ok(Math.abs(a.advance({ hz: 440, dt: 5 }).progress - 0.5) < 1e-9, '10초짜리는 5초에 절반');
  assert.ok(Math.abs(b.advance({ hz: 440, dt: 5 }).progress - 0.125) < 1e-9, '40초짜리는 5초에 1/8');

  // 그래도 침묵은 시간을 먹지 않는다.
  const before = a.state().progress;
  for (let i = 0; i < 300; i++) a.advance({ hz: null, dt: 1 / 60 });
  assert.equal(a.state().progress, before, '벽시계가 아니라 숨이 시간이다');
});

test('아주 짧거나 아주 긴 악보는 부를 만한 길이로 민다', () => {
  const blink = { label: '4초', seconds: 4, notes: [{ t: 0, hz: 440 }] };
  const epic = { label: '3분', seconds: 180, notes: [{ t: 0, hz: 440 }] };

  const a = createSessionFromScore(wavyScore(), blink);
  const b = createSessionFromScore(wavyScore(), epic);
  assert.ok(a.advance({ hz: 440, dt: 4 }).progress < 1, '4초짜리가 4초에 끝나버리지 않는다');
  assert.ok(b.advance({ hz: 440, dt: 45 }).progress >= 1, '3분짜리도 45초면 끝난다');
});

test('완주하면 멈추고, 그 뒤에는 무엇이 들어와도 변하지 않는다', () => {
  const session = createSessionFromScore(wavyScore(), melody);
  const done = session.advance({ hz: 300, dt: TARGET_SECONDS });
  assert.equal(done.done, true);
  assert.equal(done.progress, 1);

  const trailLength = done.trail.length;
  const after = session.advance({ hz: 500, dt: 5 });
  assert.equal(after.progress, 1, '진행도가 1을 넘지 않는다');
  assert.equal(after.trail.length, trailLength, '완주 뒤에는 궤적도 안 는다');
});

test('reset 하면 처음 상태로 돌아간다', () => {
  const session = createSessionFromScore(wavyScore(), melody);
  for (let i = 0; i < 60; i++) session.advance({ hz: 300, dt: 1 / 60 });
  assert.ok(session.state().trail.length > 0);

  const view = session.reset();
  assert.equal(view.progress, 0);
  assert.equal(view.trail.length, 0);
  assert.equal(view.errorCents, null);
  assert.equal(view.averageErrorCents, null);
  assert.equal(view.done, false);
});

test('점이 하나도 없는 그림은 세션이 되지 않는다', () => {
  assert.throws(
    () => createSessionFromScore({ points: [], length: 0, shapeCount: 0 }, melody),
    /점이 하나도 없습니다/,
  );
});

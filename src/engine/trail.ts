/**
 * 궤적 — 펜이 지나온 자리를 들고 있는다.
 *
 * 상한에 닿으면 오래된 점을 버리는 게 아니라 점 사이를 솎아낸다. 앞부분을 버리면
 * 그린 그림의 처음이 사라져 결과 화면이 성립하지 않는다 — 결과 화면은 "내가 그린 것"을
 * 통째로 보여주는 자리다.
 *
 * 부르는 쪽은 솎아내기를 알 필요가 없다. 매 프레임 "펜이 여기 있었다"고만 말한다.
 */

import type { Point } from './score.js';

/** 궤적으로 남길 최대 점 개수. */
const MAX_POINTS = 2000;

export interface Trail {
  /**
   * 렌더러가 이 배열을 참조만 하므로 갈아치우지 않고 제자리에서 고친다.
   * 읽는 쪽에서 길이가 줄어드는 것을 볼 수 있다 — 솎아낸 것이지 잃은 것이 아니다.
   */
  readonly points: readonly Point[];
  /** 펜이 지난 자리. 상한에 닿으면 알아서 솎아낸다. */
  push(point: Point): void;
  clear(): void;
}

export function createTrail(): Trail {
  const points: Point[] = [];

  /** 솎아낸 정도. 상한에 닿을 때마다 두 배가 된다. */
  let stride = 1;
  let seen = 0;

  function push(point: Point): void {
    if (seen++ % stride !== 0) return;
    points.push(point);
    if (points.length > MAX_POINTS) thin();
  }

  function thin(): void {
    const kept: Point[] = [];
    for (let i = 0; i < points.length; i += 2) kept.push(points[i]!);
    const last = points[points.length - 1]!;
    if (kept[kept.length - 1] !== last) kept.push(last);
    points.length = 0;
    for (const p of kept) points.push(p);
    stride *= 2;
  }

  function clear(): void {
    points.length = 0;
    stride = 1;
    seen = 0;
  }

  return { points, push, clear };
}

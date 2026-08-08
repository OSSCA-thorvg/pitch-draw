/**
 * 세션 엔진 — 한 그림을 한 번 그리는 단위. 이 기능의 유일한 seam 이다.
 *
 * 들어오는 것은 SVG 텍스트·멜로디와 `{hz, dt}` 표본뿐이고, 나가는 것은 펜·궤적·진행도뿐이다.
 * ThorVG 도 마이크도 이 경계 안으로 들어오지 않는다 — 나중에 테스트를 붙일 때
 * 손댈 곳이 여기 한 군데로 끝나게 하기 위한 제약이다.
 *
 * 그림과 멜로디가 만나는 유일한 자리이기도 하다. 그림은 **어디에** 그려지는지를,
 * 멜로디는 **무슨 음을 내야** 하는지를 정하고, 둘의 어긋남이 선을 밀어낸다.
 *
 * 이 안에 사는 규칙 둘이 이 게임의 전부다.
 *   - 정확히 부르면 펜이 목표선 위를 지난다. 틀린 만큼만 선에서 밀려난다.
 *   - 진행도는 음정이 잡히는 프레임에만 는다. 그래서 숨이 곧 시간이 된다.
 */

import { svgToScore, pointOnScore, type Score, type Point } from './score.js';
import { centsBetween, offsetYFromCents } from './deviation.js';
import { noteAt, playSeconds, type Melody } from './melody.js';
import { createTrail } from './trail.js';
import { createAccuracy } from './accuracy.js';
import { clamp01, lerp } from '../math.js';

/**
 * **벗어난 정도**에 거는 지수 스무딩. 이게 없으면 목소리의 미세한 떨림이 선을 잘게 흔든다.
 * 60fps 한 프레임에 목표까지 남은 거리 중 이만큼을 따라간다는 뜻이다.
 *
 * 펜의 절대 위치가 아니라 변위에만 건다. 절대 위치에 걸면 목표선이 움직이는 것까지
 * 떨림으로 보고 늦게 따라가서, 정확히 불러도 펜이 선 위에 얹히지 않는다.
 * 목표선의 움직임은 떨림이 아니라 악보다.
 */
const SMOOTHING = 0.35;

/** 위 상수가 기준으로 삼는 프레임률. */
const SMOOTHING_FPS = 60;

/** 한 프레임의 결과. 렌더러와 계기판이 읽기만 한다. */
export interface SessionView {
  readonly pen: Point;
  /** 0~1 */
  readonly progress: number;
  readonly trail: readonly Point[];
  /** 지금 내야 할 음 */
  readonly targetHz: number;
  /** 목표 대비 오차(센트). 소리가 안 잡히는 프레임에는 null 이다. */
  readonly errorCents: number | null;
  /**
   * 지금까지 낸 소리의 평균 절대 오차(센트). 소리를 한 번도 안 냈으면 null.
   * 결과 화면이 "얼마나 비슷했는가"를 말할 수 있게 하려고 세션이 들고 있는다.
   */
  readonly averageErrorCents: number | null;
  readonly done: boolean;
}

/** `hz` 가 null 이면 펜이 그 자리에 선다. */
export interface PlaySample {
  readonly hz: number | null;
  readonly dt: number;
}

export interface Session {
  readonly score: Score;
  readonly melody: Melody;
  advance(sample: PlaySample): SessionView;
  /** 진행도에 해당하는 목표선 위의 점. 가이드 재생 중 펜을 놓을 때 쓴다. */
  pointAt(t: number): Point;
  /** 진행도에 해당하는 목표 음. */
  targetHzAt(t: number): number;
  reset(): SessionView;
  state(): SessionView;
}

/**
 * SVG 와 멜로디로 세션을 연다. 이 기능이 바깥에 내놓는 유일한 입구다.
 *
 * @param svgText 그릴 그림. 신뢰하지 않고 파싱한다.
 * @param melody 부를 노래. 그림과는 무관하다.
 * @throws {Error} 그림으로 쓸 수 없는 SVG 면 사유를 담아 던진다.
 */
export function createSession(svgText: string, melody: Melody): Session {
  return createSessionFromScore(svgToScore(svgText), melody);
}

/**
 * `dt` 동안 목표까지 따라갈 비율. 60fps 에서는 정확히 `SMOOTHING` 이다.
 *
 * 프레임 수가 아니라 **흐른 시간**으로 재는 이유: 프레임 단위로 따라가면 느린 기기에서
 * 펜이 더 굼떠, 같은 노래를 같은 음정으로 불러도 다른 그림이 나온다. 그리는 것이
 * 이 앱의 산출물인 이상 기기가 그림을 바꾸면 안 된다.
 */
function followRate(dt: number): number {
  return 1 - Math.pow(1 - SMOOTHING, dt * SMOOTHING_FPS);
}

/**
 * 이미 만들어진 악보로 세션을 연다.
 * SVG 를 읽는 일과 연주를 진행하는 일을 갈라두면, 진행 규칙만 따로 확인할 수 있다
 * (그림 추출은 getTotalLength() 가 필요해서 실제 브라우저를 요구한다).
 */
export function createSessionFromScore(score: Score, melody: Melody): Session {
  const first = score.points[0];
  if (!first) throw new Error('악보에 점이 하나도 없습니다.');

  /** 시작점. reset() 이 매번 여기로 되돌린다. */
  const { x: startX, y: startY } = first;

  const trail = createTrail();
  const accuracy = createAccuracy();
  const seconds = playSeconds(melody);

  let progress = 0;
  let penX = 0;
  let penY = 0;
  let targetHz = 0;
  let errorCents: number | null = null;
  let done = false;

  /** 목표선에서 밀려난 정도(px). 스무딩은 오직 여기에만 걸린다. */
  let offsetY = 0;

  /** 소리가 한 번이라도 잡혔는가. 첫 소리는 스무딩 없이 제자리로 간다. */
  let seeded = false;

  function snapshot(): SessionView {
    return {
      pen: { x: penX, y: penY },
      progress,
      trail: trail.points,
      targetHz,
      errorCents,
      averageErrorCents: accuracy.average,
      done,
    };
  }

  function reset(): SessionView {
    progress = 0;
    penX = startX;
    // 연주 전 "펜이 시작점에 서 있다"를 보여주기 위한 표시용 값이다.
    // 첫 소리가 나는 순간 오차만큼 밀린 값으로 덮인다 — 궤적에는 쓰이지 않는다.
    penY = startY;
    targetHz = noteAt(melody, 0);
    errorCents = null;
    done = false;
    trail.clear();
    offsetY = 0;
    seeded = false;
    accuracy.clear();
    return snapshot();
  }

  function advance({ hz, dt }: PlaySample): SessionView {
    // 완주 뒤에는 무엇이 들어와도 상태가 바뀌지 않는다.
    if (done) return snapshot();

    if (hz == null || !Number.isFinite(hz)) {
      errorCents = null;
      return snapshot();
    }

    progress = clamp01(progress + dt / seconds);

    const target = pointOnScore(score, progress);
    targetHz = noteAt(melody, progress);
    errorCents = centsBetween(hz, targetHz);
    accuracy.add(errorCents);

    // 여기가 이 게임의 전부다 — 정확히 부르면 변위가 0 이라 펜이 목표선 위를 그대로 지난다.
    // 첫 소리는 스무딩 없이 제자리로 간다. 0 에서 이어 받으면 가장 틀리기 쉬운
    // 첫 몇 프레임이 실제보다 정확해 보인다.
    const rawOffset = offsetYFromCents(errorCents);
    offsetY = seeded ? lerp(offsetY, rawOffset, followRate(dt)) : rawOffset;
    seeded = true;

    penX = target.x;
    penY = target.y + offsetY;

    trail.push({ x: penX, y: penY });

    if (progress >= 1) done = true;

    return snapshot();
  }

  reset();

  return {
    score,
    melody,
    advance,
    reset,
    state: snapshot,
    pointAt: (t) => pointOnScore(score, t),
    targetHzAt: (t) => noteAt(melody, t),
  };
}

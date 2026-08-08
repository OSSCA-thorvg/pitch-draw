/**
 * 프레임 루프 — 매 프레임 무엇을 그릴지 정해 렌더러에 넘긴다.
 *
 * 화면 상태를 읽기만 하고 바꾸지 않는다. 예외는 리빌 하나인데, 그건 순전히 연출이라
 * 여기서 소유한다 — app.ts 는 "새 악보가 들어왔다"고만 말한다.
 *
 * 상태마다 그릴 것이 다르지만 그리는 호출은 이 파일에 딱 하나뿐이다.
 */

import { clamp01 } from './math.js';
import { els } from './ui/screen.js';
import type { AudioInput } from './audio/input.js';
import type { Renderer, RendererView } from './draw/renderer.js';
import type { Session } from './engine/session.js';
import type { Readout } from './ui/readout.js';
import type { ScreenState } from './ui/screen.js';

/**
 * 악보가 그려져 들어오는 시간(초).
 * 이 프로젝트에서 가장 값싸고 가장 강한 인상 장치는 "아무 SVG나 던져보세요"이고,
 * 그 절정은 던진 그림이 악보로 바뀌는 순간이다. 전에는 목표선이 그냥 나타났다.
 */
const REVEAL_SECONDS = 0.8;

/** 탭이 뒤로 갔다 돌아오면 dt 가 크게 튄다. 진행도가 한 번에 건너뛰지 않게 막는다. */
const MAX_DT = 0.1;

/** 루프가 매 프레임 물어보는 것. app.ts 가 답한다. */
export interface Moment {
  readonly session: Session | null;
  readonly screen: ScreenState;
  readonly guiding: boolean;
  readonly guideProgress: number;
  /** 완주. 이 프레임에 그릴 것을 정한 뒤에 부른다. */
  finish(message: string): void;
}

export interface LoopParts {
  readonly input: AudioInput;
  readonly readout: Readout;
}

export interface Loop {
  /** 렌더러가 뜨면 건다. 한 번만. */
  start(renderer: Renderer): void;
  /** 새 악보 — 목표선이 앞에서부터 그려져 들어온다. */
  beginReveal(): void;
  /** 리빌 건너뛰기. 발표에서 0.8초가 길게 느껴질 수 있다. */
  skipReveal(): void;
}

export function createLoop(moment: Moment, { input, readout }: LoopParts): Loop {
  /** ?debug 일 때만 계측을 찍는다. 발표 URL 에는 안 붙인다. */
  const debugging = new URLSearchParams(location.search).has('debug');
  if (debugging) document.body.classList.add('debug');

  let renderer: Renderer | null = null;
  let lastFrame = 0;
  let frameGap = 0;

  /** 리빌 진행도(0~1). 1 이면 다 그려졌다. */
  let reveal = 1;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    const raw = lastFrame ? (now - lastFrame) / 1000 : 0;
    frameGap = raw;
    lastFrame = now;

    if (!renderer) return;
    renderer.draw(step(now, Math.min(MAX_DT, raw)));
    paintDebug();
  }

  /** 한 프레임 나아가고, 무엇을 그릴지 돌려준다. */
  function step(now: number, dt: number): RendererView {
    const session = moment.session;
    if (!session) return {}; // 빈 종이
    const score = session.score;

    // 악보가 그려져 들어오는 중. 다 그려지면 정확히 0 비용으로 돌아간다.
    if (reveal < 1) reveal = clamp01(reveal + dt / REVEAL_SECONDS);

    if (moment.screen === 'playing') {
      const sample = input.read();
      const view = session.advance({ hz: sample?.hz ?? null, dt });
      readout.accumulate(sample, view.errorCents, input.rms);
      readout.paint(now, view.targetHz, view.progress);

      const drawn = { score, progress: view.progress, pen: view.pen, trail: view.trail };
      // 완주는 이 프레임에 그릴 것을 정한 뒤에 알린다 — 마지막 한 점까지 그려진 그림이
      // 곧 결과 화면의 출발점이다.
      if (view.done) moment.finish('완주했습니다.');
      return drawn;
    }

    if (moment.guiding) {
      // 미리보기이지 연주가 아니다 — 궤적은 남기지 않는다.
      // 가이드는 완벽한 연주다 — 펜이 목표선 위를 정확히 지난다.
      const pen = session.pointAt(moment.guideProgress);
      readout.accumulate(null, null, input.rms);
      readout.paint(now, session.targetHzAt(moment.guideProgress), moment.guideProgress);
      return { score, progress: moment.guideProgress, pen, trail: null };
    }

    if (moment.screen === 'result') {
      const view = session.state();
      // 실제 진행도를 그대로 쓴다. 30%에서 그만뒀는데 목표선 전체가 '지나온' 색이면
      // 완주와 구별되지 않는다.
      return { score, progress: view.progress, pen: null, trail: view.trail, finished: true };
    }

    if (moment.screen === 'ready') {
      const view = session.state();
      readout.accumulate(null, null, input.rms);
      readout.paint(now, view.targetHz, 0);
      return {
        score,
        progress: 0,
        // 리빌 중에는 펜을 아직 내려놓지 않는다 — 그려지는 중인 악보 위에 펜이 서 있으면
        // '악보가 되는 중'이 아니라 '연주 중'으로 읽힌다.
        pen: reveal >= 1 ? view.pen : null,
        trail: null,
        reveal: easeOut(reveal),
      };
    }

    return { score };
  }

  function paintDebug(): void {
    if (!debugging || !renderer) return;
    const trail = moment.session?.state().trail.length ?? 0;
    els.debug.textContent =
      `draw ${renderer.lastDrawMs.toFixed(2)}ms · frame ${(frameGap * 1000).toFixed(1)}ms · trail ${trail}`;
  }

  return {
    start(next) {
      renderer = next;
      requestAnimationFrame(frame);
    },
    beginReveal() {
      reveal = 0;
    },
    skipReveal() {
      if (reveal < 1) reveal = 1;
    },
  };
}

/** 리빌 이징 — 끝에서 부드럽게 멎는다. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

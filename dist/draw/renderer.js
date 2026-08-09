/**
 * 렌더러 — 세션의 상태를 ThorVG WebCanvas 로 그린다.
 *
 * 상태를 읽기만 하고 바꾸지 않는다. 그림에 관한 결정(무엇을 어떤 색으로)만 여기 있고,
 * 게임 규칙은 하나도 들어오지 않는다.
 *
 * 질감에 관해 확인된 것 둘 — 나중에 다시 밟지 않도록 적어둔다.
 *   - ThorVG 의 stroke 굵기는 Shape 단위 스칼라다. 도형 하나로는 위치별 굵기가
 *     원리적으로 안 나온다. 가변폭 붓을 원하면 리본 폴리곤을 직접 계산해야 한다.
 *   - 궤적에 **위치 지터를 넣으면 안 된다.** 음역 2710센트가 밴드 높이에 걸리므로
 *     1px 이 대략 6센트고, "맞음" 판정폭(25센트)이 4px 밖에 안 된다. 궤적은 대체로
 *     가로로 흐르니 법선이 세로고, 위치 지터는 정확히 음정 오차와 같은 축에 얹힌다.
 *     손맛은 굵기·겹·색에서만 뽑는다.
 */
import { init } from '../../vendor/webcanvas.esm.js';
import { STAGE_W, STAGE_H } from '../stage.js';
import { INK } from './palette.js';
import { clamp } from '../math.js';
/** 목표선 점선의 칸과 사이(px). 실선이면 궤적의 '얇은 형제'로 보인다. */
const GUIDE_DASH = [7, 6];
export async function createRenderer(selector, { onStatus } = {}) {
    const locateFile = (p) => new URL(`../../vendor/${p.split('/').pop() ?? p}`, import.meta.url).href;
    let TVG;
    try {
        TVG = await init({ renderer: 'gl', locateFile });
    }
    catch {
        onStatus?.('WebGL 초기화 실패 — 소프트웨어 렌더러로 전환합니다.');
        TVG = await init({ renderer: 'sw', locateFile });
    }
    const canvas = new TVG.Canvas(selector, { width: STAGE_W, height: STAGE_H });
    // 그리는 순서가 곧 쌓이는 순서다. 종이가 맨 아래, 펜이 맨 위.
    const shapes = {
        paper: new TVG.Shape(),
        guidePathPast: new TVG.Shape(),
        guidePathAhead: new TVG.Shape(),
        start: new TVG.Shape(),
        trailBleed: new TVG.Shape(),
        trail: new TVG.Shape(),
        pen: new TVG.Shape(),
    };
    for (const shape of Object.values(shapes))
        canvas.add(shape);
    // 종이는 한 번만 깐다. 매 프레임 다시 만들 이유가 없다.
    shapes.paper.appendRect(0, 0, STAGE_W, STAGE_H);
    shapes.paper.fill(...INK.paper);
    let lastDrawMs = 0;
    function polyline(shape, points, width, color, dash) {
        const head = points[0];
        if (!head || points.length < 2)
            return;
        shape.moveTo(head.x, head.y);
        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            shape.lineTo(p.x, p.y);
        }
        shape.stroke({
            width,
            color,
            cap: TVG.StrokeCap.Round,
            join: TVG.StrokeJoin.Round,
            ...(dash ? { dash: [...dash] } : {}),
        });
    }
    /** 진행도를 점 인덱스로. 0~1 을 벗어난 값도 안전하게 받는다. */
    function cutAt(count, t) {
        return clamp(Math.round(t * (count - 1)), 0, count - 1);
    }
    function draw({ score = null, progress = 0, pen = null, trail = null, reveal = 1, finished = false, } = {}) {
        const startedAt = performance.now();
        // 종이는 건드리지 않는다 — reset 하면 매 프레임 다시 쌓아야 한다.
        shapes.guidePathPast.reset();
        shapes.guidePathAhead.reset();
        shapes.start.reset();
        shapes.trailBleed.reset();
        shapes.trail.reset();
        shapes.pen.reset();
        if (score) {
            const points = score.points;
            // 악보가 그려져 들어오는 중이면 앞에서부터 그만큼만 보여준다.
            const drawn = reveal >= 1 ? points : points.slice(0, cutAt(points.length, reveal) + 1);
            if (finished) {
                // 결과 화면 — 목표선은 비교 대상이다. 가르지 않고 한 색으로 또렷하게.
                polyline(shapes.guidePathAhead, drawn, 1.5, INK.guidePathResult, GUIDE_DASH);
            }
            else {
                const cut = cutAt(drawn.length, progress);
                polyline(shapes.guidePathPast, drawn.slice(0, cut + 1), 1.5, INK.guidePathPast, GUIDE_DASH);
                polyline(shapes.guidePathAhead, drawn.slice(cut), 1.5, INK.guidePathAhead, GUIDE_DASH);
            }
            // 시작점 — 원처럼 시작과 끝이 붙어 있는 그림은 어디서 출발하는지 알 수 없다.
            // 결과 화면에서는 끈다. 다 끝난 그림에 출발선이 남아 있을 이유가 없다.
            const head = points[0];
            if (head && !finished) {
                shapes.start.appendCircle(head.x, head.y, 9);
                shapes.start.stroke({ width: 2, color: INK.start });
            }
        }
        if (trail && trail.length) {
            // 궤적의 마지막 점과 펜 사이를 이어 붙인다. 솎아내기로 끝이 뒤처져도 선이 끊기지 않는다.
            const line = pen ? [...trail, pen] : trail;
            // 굵고 옅은 겹을 아래에 깔아 잉크가 스민 것처럼 보이게 한다.
            polyline(shapes.trailBleed, line, 10, INK.trailBleed);
            polyline(shapes.trail, line, 4, INK.trail);
        }
        if (pen) {
            shapes.pen.appendCircle(pen.x, pen.y, 6);
            shapes.pen.fill(...INK.pen);
        }
        canvas.update();
        canvas.render();
        lastDrawMs = performance.now() - startedAt;
    }
    return {
        draw,
        get lastDrawMs() {
            return lastDrawMs;
        },
    };
}
//# sourceMappingURL=renderer.js.map
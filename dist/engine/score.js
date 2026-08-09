/**
 * 악보 — 펜이 지나야 할 길. 세션 엔진 안쪽이라 바깥에서 직접 부르지 않는다.
 *
 * **음높이가 들어 있지 않다.** 그림은 어디에 그려지는가만 정하고, 무슨 음을 내야 하는지는
 * melody.ts 가 따로 정한다. 전에는 여기서 그림의 y 를 목표 음으로 바꿨는데, 그러면
 * 그릴 수 있는 그림이 곧 부를 수 있는 노래여서 세로로 납작한 그림은 1px 에 2옥타브가
 * 얹혔고 아는 노래를 부를 방법도 없었다.
 *
 * SVG 를 읽는 일은 svg.ts 가 끝내고 여기로는 숫자만 넘어온다.
 */
import { STAGE_W, STAGE_H, STAGE_PAD } from '../stage.js';
import { samplePath } from './svg.js';
import { clamp, lerp } from '../math.js';
/**
 * @throws {Error} 악보로 쓸 수 없는 파일이면 사유를 담아 던진다. 조용히 실패하지 않는다.
 */
export function svgToScore(svgText) {
    return toScore(samplePath(svgText));
}
/** 뽑은 점들을 스테이지 좌표로 옮긴다. */
function toScore({ points: raw, length, shapeCount }) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of raw) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
            continue;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX))
        throw new Error('도형의 좌표를 읽을 수 없습니다.');
    // 가로세로 비율을 유지한 채(uniform scale) 여백을 두고 스테이지 중앙에 맞춘다.
    // 찌그러진 목표선은 원래 그림이 무엇이었는지 알아볼 수 없게 만든다.
    // 여백은 장식이 아니다 — 펜이 선 밖으로 밀려날 자리다(deviation.ts).
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const scale = Math.min((STAGE_W - STAGE_PAD * 2) / (spanX || 1), (STAGE_H - STAGE_PAD * 2) / (spanY || 1));
    const offX = (STAGE_W - spanX * scale) / 2 - minX * scale;
    const offY = (STAGE_H - spanY * scale) / 2 - minY * scale;
    const points = raw.map((p) => ({ x: p.x * scale + offX, y: p.y * scale + offY }));
    return { points, length, shapeCount };
}
/**
 * 진행도(0~1)에 해당하는 목표선 위의 점. 점 사이는 선형 보간한다.
 * 연주 중의 펜과 가이드 재생 중의 펜이 같은 자리를 짚어야 하므로 한 군데서만 계산한다.
 */
export function pointOnScore(score, t) {
    const points = score.points;
    const last = points.length - 1;
    const f = clamp(t * last, 0, last);
    const i = Math.min(last - 1, Math.floor(f));
    const k = f - i;
    // 악보는 항상 등간격 표본만큼의 점을 갖지만, 타입만 보면 빈 배열일 수도 있다.
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b)
        throw new Error('악보에 점이 모자랍니다.');
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}
//# sourceMappingURL=score.js.map
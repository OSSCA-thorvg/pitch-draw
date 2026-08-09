/**
 * 궤적 — 펜이 지나온 자리를 들고 있는다.
 *
 * 상한에 닿으면 오래된 점을 버리는 게 아니라 점 사이를 솎아낸다. 앞부분을 버리면
 * 그린 그림의 처음이 사라져 결과 화면이 성립하지 않는다 — 결과 화면은 "내가 그린 것"을
 * 통째로 보여주는 자리다.
 *
 * 부르는 쪽은 솎아내기를 알 필요가 없다. 매 프레임 "펜이 여기 있었다"고만 말한다.
 */
/** 궤적으로 남길 최대 점 개수. */
const MAX_POINTS = 2000;
export function createTrail() {
    const points = [];
    /** 솎아낸 정도. 상한에 닿을 때마다 두 배가 된다. */
    let stride = 1;
    let seen = 0;
    function push(point) {
        if (seen++ % stride !== 0)
            return;
        points.push(point);
        if (points.length > MAX_POINTS)
            thin();
    }
    function thin() {
        const kept = [];
        for (let i = 0; i < points.length; i += 2)
            kept.push(points[i]);
        const last = points[points.length - 1];
        if (kept[kept.length - 1] !== last)
            kept.push(last);
        points.length = 0;
        for (const p of kept)
            points.push(p);
        stride *= 2;
    }
    function clear() {
        points.length = 0;
        stride = 1;
        seen = 0;
    }
    return { points, push, clear };
}
//# sourceMappingURL=trail.js.map
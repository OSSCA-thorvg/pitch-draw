/**
 * 작은 수 계산 — 여러 모듈이 똑같이 쓰던 것을 한 군데로 모았다.
 * 도메인 지식은 하나도 들어 있지 않다. 음역도 악보도 여기서는 모른다.
 */
/** 값을 구간 안으로 밀어 넣는다. */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/** 0~1 로 자른다. */
export function clamp01(value) {
    return clamp(value, 0, 1);
}
/** 선형 보간. `t` 를 0~1 로 자르지 않는다 — 지수 스무딩에도 그대로 쓴다. */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
//# sourceMappingURL=math.js.map
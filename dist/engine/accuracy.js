/**
 * 정확도 누적 — 얼마나 비슷하게 불렀는가.
 *
 * 결과 화면이 "아주 잘 맞췄습니다"를 말할 수 있는 근거다. 소리가 잡힌 프레임만 센다 —
 * 침묵을 0센트로 세면 아무 소리도 안 낸 사람이 만점을 받는다.
 */
export function createAccuracy() {
    let sum = 0;
    let count = 0;
    return {
        get average() {
            return count ? sum / count : null;
        },
        add(cents) {
            sum += Math.abs(cents);
            count++;
        },
        clear() {
            sum = 0;
            count = 0;
        },
    };
}
//# sourceMappingURL=accuracy.js.map
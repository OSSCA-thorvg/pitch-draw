/**
 * AudioContext 를 여는 단 한 가지 방법.
 *
 * 입력(마이크)과 출력(가이드 음)은 서로를 모르는 채 각자 자기 것을 연다.
 * 둘이 똑같이 쓰던 접두사 처리를 여기 모았다 — Safari 는 아직 `webkitAudioContext`
 * 로만 내준다.
 */
const AudioContextCtor = window.AudioContext ??
    window.webkitAudioContext;
export function createAudioContext() {
    return new AudioContextCtor();
}
//# sourceMappingURL=context.js.map
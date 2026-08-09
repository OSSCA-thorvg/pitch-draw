/**
 * 가이드 음 제어 — 멜로디를 들려주고, 그동안 펜이 어디쯤 있는지 알려준다.
 *
 * 연주와 배타적이어야 한다는 판단은 app.ts 가 한다. 여기서는 켜고 끄는 일과,
 * 재생 위치를 내주는 일만 한다.
 */
import { createGuideTone } from './audio/guide-tone.js';
import { playSeconds } from './engine/melody.js';
import { status } from './ui/screen.js';
/** @param onChange 켜지거나 꺼졌다 — 조작부를 다시 맞추라고 부른다. */
export function createGuideControl(onChange) {
    const tone = createGuideTone();
    let playing = false;
    let progress = 0;
    function stop() {
        tone.stop();
        playing = false;
        progress = 0;
        onChange();
    }
    async function play(session) {
        playing = true;
        progress = 0;
        onChange();
        status('가이드 음 재생 중 — 펜이 도는 길과 소리를 같이 익혀보세요.');
        await tone.play(session.melody.notes, {
            durationSeconds: playSeconds(session.melody),
            onProgress: (t) => { progress = t; },
            onEnd: () => {
                stop();
                status('시작을 누르고 방금 들은 멜로디를 따라 불러보세요.');
            },
        });
    }
    return {
        get playing() {
            return playing;
        },
        get progress() {
            return progress;
        },
        play,
        stop,
    };
}
//# sourceMappingURL=guide-control.js.map
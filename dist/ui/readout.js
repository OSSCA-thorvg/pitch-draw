/**
 * 계기판 — 매 프레임 쏟아지는 값을 사람이 읽을 수 있는 속도와 형태로 옮긴다.
 *
 * 여기의 스무딩은 **읽히게 하려는 것이지 판정에 쓰이지 않는다.** 판정은 세션 엔진이
 * 원본 표본으로 한다. 두 값을 섞으면 화면에 '맞습니다'라고 적히는 순간과 선이 목표선에
 * 닿는 순간이 어긋난다.
 */
import { hzToNoteName, hzToSolfegeName } from '../audio/pitch.js';
import { lerp } from '../math.js';
import { els } from './screen.js';
import { createTabScore } from './tab-score.js';
/** 계기판을 다시 그리는 간격(ms). 매 프레임 갱신하면 숫자가 널뛰어 읽을 수 없다. */
const PAINT_INTERVAL = 100;
/** 계기판 숫자의 지수 스무딩. */
const SMOOTHING = 0.25;
/** 이보다 벗어나면 올려라/내려라를 말해준다(센트). **잠정값 — 실제로 불러보고 맞춰야 한다.** */
const IN_TUNE_CENTS = 25;
export function createReadout() {
    const tabScore = createTabScore(els.tabScore);
    let currentMelody = null;
    // 계기판에 실제로 찍히는 값. 표본 그대로가 아니라 부드럽게 따라온다.
    let hz = null;
    let cents = null;
    let clarity = 0;
    let level = 0;
    let lastPaint = 0;
    function reset() {
        hz = null;
        cents = null;
        clarity = 0;
        lastPaint = 0;
        if (currentMelody)
            showSong(currentMelody);
    }
    function accumulate(sample, errorCents, rms) {
        if (sample) {
            hz = hz == null ? sample.hz : ease(hz, sample.hz);
            clarity = ease(clarity, sample.clarity);
            cents = errorCents == null ? null
                : cents == null ? errorCents : ease(cents, errorCents);
        }
        else {
            // 소리가 잡히지 않을 때 숫자가 엉뚱한 값으로 튀지 않게 아예 비운다.
            hz = null;
            cents = null;
            clarity = ease(clarity, 0);
        }
        level = ease(level, rms);
    }
    function paint(now, targetHz, progress) {
        // 신호 막대만은 매 프레임 움직인다 — 소리에 반응하는지 보여주는 유일한 곳이다.
        els.level.style.width = `${Math.min(100, level * 400)}%`;
        if (now - lastPaint < PAINT_INTERVAL)
            return;
        lastPaint = now;
        showNote(els.curNote, els.curHz, hz);
        showTarget(targetHz);
        tabScore.mark(progress);
        if (cents == null) {
            els.errorCents.textContent = '—';
            els.errorHint.textContent = '';
        }
        else {
            const rounded = Math.round(cents);
            els.errorCents.textContent = `${rounded > 0 ? '+' : ''}${rounded} ¢`;
            els.errorHint.textContent =
                rounded > IN_TUNE_CENTS ? '↓ 조금 낮게'
                    : rounded < -IN_TUNE_CENTS ? '↑ 조금 높게'
                        : '맞습니다';
        }
        els.progress.textContent = percent(progress);
        els.clarity.textContent = hz == null ? '—' : percent(clarity);
    }
    function summarize(progress, averageErrorCents) {
        // 계기판이 마지막 프레임 값에 얼어붙으면, 아무 소리도 안 나는데 'A4 · 441.2 Hz'라고
        // 계속 말한다. 결과 화면에서는 세션 전체의 평균 오차로 갈아끼운다.
        showNote(els.curNote, els.curHz, null);
        showTarget(currentMelody == null ? null : noteHzAt(currentMelody, progress));
        tabScore.mark(progress);
        els.clarity.textContent = '—';
        els.progress.textContent = percent(progress);
        if (averageErrorCents == null) {
            els.errorCents.textContent = '—';
            els.errorHint.textContent = '소리가 잡히지 않았습니다';
            return;
        }
        els.errorCents.textContent = `평균 ${Math.round(averageErrorCents)} ¢`;
        els.errorHint.textContent =
            averageErrorCents <= IN_TUNE_CENTS ? '아주 잘 맞췄습니다'
                : averageErrorCents <= IN_TUNE_CENTS * 3 ? '꽤 비슷합니다'
                    : '많이 벗어났습니다';
    }
    function showSong(melody) {
        currentMelody = melody;
        els.scoreMeta.textContent = `${melody.label} · ${melody.notes.length}음`;
        showTarget(melody.notes[0]?.hz ?? null);
        tabScore.show(melody);
    }
    return { reset, accumulate, paint, summarize, showSong };
}
function ease(current, target) {
    return lerp(current, target, SMOOTHING);
}
function percent(unit) {
    return `${Math.round(unit * 100)}%`;
}
/** 음이름과 주파수를 한 칸에 적는다. 값이 없으면 비운다 — 옛 값이 남으면 지금 값인 줄 안다. */
function showNote(noteEl, hzEl, hz) {
    noteEl.textContent = hz == null ? '—' : hzToNoteName(hz);
    hzEl.textContent = hz == null ? '' : `${hzToSolfegeName(hz)} · ${hz.toFixed(1)} Hz`;
}
function showTarget(hz) {
    showNote(els.targetNote, els.targetHz, hz);
    showNote(els.tabTargetNote, els.tabTargetHz, hz);
}
function noteHzAt(melody, progress) {
    let found = melody.notes[0];
    if (!found)
        return null;
    for (const note of melody.notes) {
        if (note.t > progress)
            break;
        found = note;
    }
    return found.hz;
}
//# sourceMappingURL=readout.js.map
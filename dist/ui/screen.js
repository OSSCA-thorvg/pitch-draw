/**
 * 화면 껍데기 — DOM 핸들과, 화면이 말을 거는 법.
 *
 * 여기에는 게임 규칙도 상태 기계도 없다. **무엇을 언제** 말할지는 app.ts 가 정하고,
 * 이 파일은 **어디에 어떻게** 말하는지만 안다.
 *
 * 화면이 말하는 자리는 셋이고 목소리 크기가 다르다.
 *   status  — 페이지 맨 아래 한 줄. 늘 켜져 있는 자막
 *   banner  — 종이 위에 잠깐 떴다 지는 알림
 *   overlay — 종이 한가운데. 지금 할 일이 없거나 일이 잘못됐을 때
 */
function el(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`화면 요소를 찾지 못했습니다: #${id}`);
    return found;
}
/** 조작부와 계기판. 바깥에서 직접 만지는 것은 이것뿐이다. */
export const els = {
    // 조작부
    samples: el('samples'),
    file: el('file'),
    melodies: el('melodies'),
    melodyText: el('melody-text'),
    mmlPart: el('mml-part'),
    applyMelody: el('apply-melody'),
    songFile: el('song-file'),
    recordSong: el('record-song'),
    guide: el('guide'),
    start: el('start'),
    restart: el('restart'),
    stop: el('stop'),
    again: el('again'),
    device: el('device'),
    refresh: el('refresh'),
    // 계기판
    curNote: el('cur-note'),
    curHz: el('cur-hz'),
    targetNote: el('target-note'),
    targetHz: el('target-hz'),
    tabTargetNote: el('tab-target-note'),
    tabTargetHz: el('tab-target-hz'),
    tabScore: el('tab-score'),
    errorCents: el('error-cents'),
    errorHint: el('error-hint'),
    progress: el('progress'),
    clarity: el('clarity'),
    scoreMeta: el('score-meta'),
    level: el('level'),
    debug: el('debug'),
};
// 아래는 이 파일의 함수로만 만진다.
const stageWrap = el('stage-wrap');
const statusLine = el('status');
const bannerBox = el('banner');
const bannerText = el('banner-text');
const overlayBox = el('overlay');
const overlayTitle = el('overlay-title');
const overlaySub = el('overlay-sub');
/** 상태는 body 에 적어둔다 — 무엇이 보이고 무엇이 숨는지는 CSS 가 정한다. */
export function showState(state) {
    document.body.dataset['state'] = state;
}
export function status(message) {
    statusLine.textContent = message;
}
let bannerTimer = 0;
/**
 * 스테이지 위에 한 줄 띄운다. 시선은 캔버스에 있지 페이지 맨 아래에 있지 않다 —
 * 전에는 로딩·파싱 실패·권한 거부·완주가 전부 아래쪽 회색 한 줄로 나갔다.
 *
 * @param holdMs 0 이면 지울 때까지 남는다(완주 알림).
 */
export function banner(message, holdMs = 0) {
    clearTimeout(bannerTimer);
    bannerText.textContent = message ?? '';
    bannerBox.classList.toggle('show', Boolean(message));
    if (message && holdMs) {
        bannerTimer = window.setTimeout(() => { bannerBox.classList.remove('show'); }, holdMs);
    }
}
/** 오버레이 문구만 바꾼다. 언제 보이는지는 상태가 정한다(대기·로딩). */
export function overlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
}
/** 상태와 무관하게 오버레이를 띄운다(주로 오류). `null` 이면 내린다. */
export function speak(title, sub = '', bad = false) {
    overlayBox.classList.toggle('speak', Boolean(title));
    overlayBox.classList.toggle('bad', bad);
    if (title)
        overlay(title, sub);
}
/**
 * 드롭은 어느 상태에서든 받는다.
 *
 * dragenter/dragleave 를 세는 이유: window 에 걸면 자식 요소를 지날 때마다 leave 가 떠서
 * 드래그하는 내내 테두리가 깜빡인다. 발표에서 되돌릴 수 없는 장면 직전에 화면이 떨면 안 된다.
 */
export function onFileDrop(handler) {
    let depth = 0;
    const mark = (on) => { stageWrap.classList.toggle('over', on); };
    window.addEventListener('dragenter', (event) => {
        event.preventDefault();
        depth++;
        mark(true);
    });
    window.addEventListener('dragover', (event) => { event.preventDefault(); });
    window.addEventListener('dragleave', (event) => {
        event.preventDefault();
        depth = Math.max(0, depth - 1);
        if (!depth)
            mark(false);
    });
    window.addEventListener('drop', (event) => {
        event.preventDefault();
        depth = 0;
        mark(false);
        handler(event.dataTransfer?.files?.[0]);
    });
}
//# sourceMappingURL=screen.js.map
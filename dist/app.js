/**
 * 앱 — 화면 상태 기계. 세션 엔진·렌더러·가이드 음·오디오 입력·계기판이 만나는 유일한 자리다.
 *
 * 여기서 정하는 것은 **언제 무엇으로 넘어가는가**뿐이다. 매 프레임 무엇을 그릴지는
 * loop.ts 가, 어느 버튼이 언제 눌리는지는 ui/controls.ts 가, 화면에 뭐라고 적을지는
 * ui/screen.ts 와 ui/readout.ts 가 안다.
 *
 * 그림과 노래는 따로 고른다. 그림은 **어디에** 그려지는지를, 노래는 **무슨 음을 내야**
 * 하는지를 정한다. 새 SVG 드롭은 어느 상태에서든 받고, 받으면 준비 상태로 돌아간다.
 * 가이드 음과 연주는 배타적이다 — 스피커로 나간 가이드 음이 마이크로 되돌아오면
 * 사용자가 아무 소리를 내지 않아도 펜이 진행한다.
 */
import { createAudioInput } from './audio/input.js';
import { createGuideControl } from './guide-control.js';
import { createLoop } from './loop.js';
import { createScoreLoader } from './score-loader.js';
import { createControls } from './ui/controls.js';
import { createDevices, micErrorMessage } from './ui/devices.js';
import { createReadout } from './ui/readout.js';
import { createSongPicker } from './ui/song-picker.js';
import { banner, overlay, showState, status } from './ui/screen.js';
import { createSessionFromScore } from './engine/session.js';
/** 배선까지 끝난 앱을 만든다. 화면은 로딩 상태로 서 있고, 렌더러가 붙으면 움직인다. */
export function createApp() {
    const input = createAudioInput();
    const devices = createDevices(input);
    const readout = createReadout();
    const guide = createGuideControl(() => { syncControls(); });
    let renderer = null;
    let session = null;
    let state = 'loading';
    /** 마이크 권한을 기다리는 중인가. 이 사이에 가이드가 끼어들면 둘이 동시에 돌 수 있다. */
    let starting = false;
    // 루프는 상태를 읽기만 한다. 그래서 넘기는 것도 읽는 창구뿐이다.
    const loop = createLoop({
        get session() { return session; },
        get screen() { return state; },
        get guiding() { return guide.playing; },
        get guideProgress() { return guide.progress; },
        finish,
    }, { input, readout });
    // 노래는 그림과 따로 고른다. 이미 그림이 서 있으면 목표만 갈아끼운다 —
    // 그림을 다시 던지게 하면 "아무 그림에 아무 노래" 라는 구조가 손에 안 잡힌다.
    const songs = createSongPicker((next) => {
        readout.showSong(next);
        if (!session)
            return;
        guide.stop();
        session = createSessionFromScore(session.score, next);
        readout.reset();
        setState('ready');
        status(`부를 노래를 "${next.label}" 로 바꿨습니다.`);
    });
    // 그림이 새로 섰다. 여기가 이 앱에서 가장 강한 순간이다 — 던진 그림이 목표선이 되는 자리.
    const loader = createScoreLoader({
        melody: () => songs.current,
        onLoaded(next, label) {
            guide.stop();
            session = next;
            setState('ready');
            loop.beginReveal();
            readout.showSong(songs.current);
            readout.reset();
            banner(`${label} — 이제 이걸 그립니다`, 2600);
            status(`"${songs.current.label}" 을 부르면 그려집니다. 가이드 음을 눌러 들어보세요.`);
        },
    });
    const controls = createControls({
        loadScore: loader.fromText,
        // 드롭 영역은 하나다. 확장자로 갈라 받는다 — 악보면 노래가, SVG 면 그림이 바뀐다.
        loadFile: (file) => { if (!songs.fromFile(file))
            loader.fromFile(file); },
        toggleGuide: () => { void toggleGuide(); },
        play: () => { void beginPlay(); },
        restart,
        stop: () => { finish('여기까지 그렸습니다.'); },
        skipReveal: () => { loop.skipReveal(); },
    });
    // -------------------------------------------------------------------- 상태
    function setState(next) {
        state = next;
        showState(next);
        syncControls();
    }
    function syncControls() {
        // 연주 중에 노래를 바꾸면 목표가 발밑에서 갈린다.
        songs.setEnabled(Boolean(renderer) && state !== 'playing' && !starting);
        controls.sync({
            armed: Boolean(renderer),
            hasScore: Boolean(session),
            playing: state === 'playing',
            guiding: guide.playing,
            starting,
        });
    }
    // --------------------------------------------------------------- 가이드 음
    async function toggleGuide() {
        if (!session || state === 'playing' || starting)
            return;
        if (guide.playing) {
            guide.stop();
            status('가이드 음을 멈췄습니다.');
            return;
        }
        // 결과 화면에서 눌렀다면 준비 상태로 돌아간다 — 듣고 나서 다시 하려는 것이다.
        // 세션은 리셋하지 않는다. 가이드는 궤적을 그리지 않으므로(trail: null) 비울 이유가 없고,
        // 비우면 방금 완주한 그림이 되돌릴 수 없이 사라진다.
        setState('ready');
        await guide.play(session);
    }
    // -------------------------------------------------------------------- 연주
    async function beginPlay() {
        if (!session || guide.playing || starting)
            return;
        const active = session;
        // 권한 대화상자가 떠 있는 동안 가이드가 시작되면, 스피커로 나간 가이드 음이
        // 마이크로 되돌아와 사용자가 침묵해도 펜이 진행한다. 그 사이를 막는다.
        starting = true;
        syncControls();
        try {
            if (!input.running) {
                status('마이크 권한을 요청합니다…');
                await input.start(devices.selected);
                // 권한이 승인되면 장치 이름이 채워지므로 목록을 다시 그린다.
                await devices.refresh();
            }
            active.reset();
            readout.showSong(songs.current);
            readout.reset();
            banner(null);
            setState('playing');
            status('소리를 내면 펜이 나아갑니다. 멈추면 펜도 섭니다.');
        }
        catch (err) {
            status(micErrorMessage(err));
            console.error(err);
        }
        finally {
            starting = false;
            syncControls();
        }
    }
    function restart() {
        if (!session)
            return;
        session.reset();
        readout.reset();
        status('처음부터 다시 시작합니다.');
    }
    function finish(message) {
        setState('result');
        status(message);
        const view = session?.state();
        readout.summarize(view?.progress ?? 0, view?.averageErrorCents ?? null);
        banner(message);
    }
    // ----------------------------------------------------------------- 시작·좌초
    function begin(next) {
        renderer = next;
        overlay('예제를 눌러보세요', '또는 SVG 파일을 여기에 떨어뜨리세요');
        // 로딩 중에 그림이 들어왔을 수도 있다. 그걸 idle 로 덮으면 세션은 살아 있는데
        // 프레임 루프의 어느 분기에도 안 걸려 빈 화면에 갇힌다.
        setState(session ? 'ready' : 'idle');
        status('그림을 고르고 노래를 고르세요. 노래를 부르면 그림이 그려집니다.');
        loop.start(next);
    }
    function failToStart(err) {
        // 로딩 상태 그대로 둔다 — 오버레이가 떠 있는 유일한 상태다.
        overlay('그래픽을 시작하지 못했습니다', err.message);
        status(`ThorVG 초기화 실패 — ${err.message}`);
        console.error(err);
    }
    return { begin, failToStart };
}
//# sourceMappingURL=app.js.map
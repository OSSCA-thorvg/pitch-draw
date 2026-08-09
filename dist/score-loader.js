/**
 * 그림 받아들이기 — SVG 텍스트나 파일을 세션으로 바꾼다.
 *
 * 실패를 조용히 삼키지 않는 것이 이 파일 일의 절반이다. 발표 자리에서 남의 파일을
 * 받는 것이 이 앱의 핵심 장치인데, 안 되는 파일을 던졌을 때 아무 일도 안 일어나면
 * 앱이 고장 난 줄 안다. 되든 안 되든 화면이 무언가 말한다.
 *
 * 무슨 노래를 부를지는 모른다 — 그건 부르는 쪽이 정해서 넘긴다.
 */
import { createSession } from './engine/session.js';
import { speak, status } from './ui/screen.js';
export function createScoreLoader({ melody, onLoaded }) {
    function fromText(svgText, label) {
        let session;
        try {
            session = createSession(svgText, melody());
        }
        catch (err) {
            const why = err.message;
            status(`그림으로 쓸 수 없습니다 — ${why}`);
            speak('그림으로 쓸 수 없습니다', why, true);
            return;
        }
        // 앞서 띄운 오류가 남아 있으면 내린다.
        speak(null);
        onLoaded(session, label);
    }
    function fromFile(file) {
        if (!file)
            return;
        const looksLikeSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
        if (!looksLikeSvg) {
            status(`그림으로 쓸 수 없습니다 — SVG 파일이 아닙니다 (${file.name})`);
            return;
        }
        void file.text().then((text) => { fromText(text, file.name); }, () => { status(`파일을 읽지 못했습니다 — ${file.name}`); });
    }
    return { fromText, fromFile };
}
//# sourceMappingURL=score-loader.js.map
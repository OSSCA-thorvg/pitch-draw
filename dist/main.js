/**
 * 진입점 — 화면을 배선하고 ThorVG 를 띄운다. 그게 전부다.
 *
 * 앱은 렌더러보다 먼저 선다. ThorVG 를 기다리는 동안에도 SVG 를 떨어뜨릴 수 있고,
 * 그렇게 들어온 그림은 렌더러가 붙는 순간 그려진다.
 */
import { createApp } from './app.js';
import { createRenderer } from './draw/renderer.js';
import { status } from './ui/screen.js';
const app = createApp();
try {
    app.begin(await createRenderer('#stage', { onStatus: status }));
}
catch (err) {
    app.failToStart(err);
}
//# sourceMappingURL=main.js.map
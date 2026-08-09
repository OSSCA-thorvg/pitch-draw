/**
 * SVG 에서 점 뽑아내기 — 악보가 되기 전 단계. 세션 엔진 안쪽이다.
 *
 * 핵심은 하나다. SVG 안의 도형(path·circle·ellipse·rect·line·polyline·polygon)은 전부
 * SVGGeometryElement 라서 getTotalLength()/getPointAtLength() 를 공통으로 갖는다.
 * 그래서 **도형 종류를 가리지 않고** 경로 위의 점을 등간격으로 뽑을 수 있고,
 * 그 덕에 "아무 SVG나 던져보세요"가 성립한다.
 *
 * 이 파일만 DOM 을 만진다 — 길이 계산이 실제 브라우저를 요구하기 때문이다.
 * 여기서 나가는 것은 숫자뿐이라, score.ts 부터는 문서 없이 확인할 수 있다.
 */
/** 경로를 몇 개의 점으로 쪼갤 것인가. 등간격이어야 진행 속도가 일정해진다. */
const SAMPLE_COUNT = 400;
const GEOMETRY_SELECTOR = 'path, circle, ellipse, rect, line, polyline, polygon';
/** 스크립트·외부 참조를 물고 들어올 수 있는 것들. 길이 계산에는 하나도 필요 없다. */
const UNSAFE_SELECTOR = [
    'script', 'style', 'foreignObject', 'image', 'use', 'iframe', 'embed', 'object',
    'link', 'filter', 'animate', 'animateMotion', 'animateTransform', 'set',
].join(', ');
const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * @throws {Error} 점을 뽑을 수 없는 파일이면 사유를 담아 던진다. 조용히 실패하지 않는다.
 */
export function samplePath(svgText) {
    const svg = parseSafely(svgText);
    // 길이 계산은 요소가 실제로 문서에 붙어 있어야 된다. 떼어낸 문서에서는 0이 나온다.
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden';
    host.appendChild(document.importNode(svg, true));
    document.body.appendChild(host);
    try {
        const geoms = [...host.querySelectorAll(GEOMETRY_SELECTOR)]
            .filter((el) => typeof el.getTotalLength === 'function');
        if (!geoms.length)
            throw new Error('그릴 수 있는 도형이 없습니다.');
        // 도형이 여럿이면 가장 긴 것 하나만 쓴다. 여러 서브패스를 잇는 것은 이 스펙 밖이다.
        const longest = geoms
            .map((el) => ({ el, len: measure(el) }))
            .filter((m) => m.len > 0)
            .sort((a, b) => b.len - a.len)[0];
        if (!longest)
            throw new Error('도형의 길이가 0이라 악보로 쓸 수 없습니다.');
        const points = [];
        for (let i = 0; i < SAMPLE_COUNT; i++) {
            const p = longest.el.getPointAtLength((i / (SAMPLE_COUNT - 1)) * longest.len);
            points.push({ x: p.x, y: p.y });
        }
        return { points, length: longest.len, shapeCount: geoms.length };
    }
    finally {
        // 실패한 경로에서도 반드시 떼어낸다.
        host.remove();
    }
}
/**
 * 들어온 SVG는 신뢰하지 않는다.
 *
 * 정적 웹 앱이라 훔칠 세션은 없지만, 발표 자리에서 남의 파일을 받는 것이 이 앱의 핵심
 * 장치인 이상 열어두지 않는다. DOMParser 로 판 문서는 그 자체로는 아무것도 실행하지
 * 않으므로, 위험한 것을 떼어낸 뒤에야 살아 있는 문서로 옮긴다.
 */
function parseSafely(svgText, retried = false) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('SVG 형식이 깨져 있어 읽을 수 없습니다.');
    }
    const svg = doc.documentElement;
    if (!svg || svg.localName.toLowerCase() !== 'svg') {
        throw new Error('SVG 파일이 아닙니다.');
    }
    // xmlns 선언을 빠뜨린 SVG 가 드물지 않다. 이름공간은 파싱할 때 정해지므로,
    // 선언을 붙여 한 번 더 판다. 이걸 안 하면 도형이 SVGGeometryElement 가 되지 못해
    // getTotalLength() 를 갖지 않고, 멀쩡한 그림이 "도형이 없다"로 튕겨 나간다.
    if (svg.namespaceURI !== SVG_NS) {
        if (retried)
            throw new Error('SVG 이름공간을 알아볼 수 없습니다.');
        svg.setAttribute('xmlns', SVG_NS);
        return parseSafely(new XMLSerializer().serializeToString(svg), true);
    }
    svg.querySelectorAll(UNSAFE_SELECTOR).forEach((el) => { el.remove(); });
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
        for (const attr of [...el.attributes]) {
            const name = attr.name.toLowerCase();
            const value = attr.value.toLowerCase();
            const external = name.startsWith('on') ||
                name === 'href' ||
                name.endsWith(':href') ||
                name === 'style' ||
                value.includes('url(') ||
                value.includes('javascript:');
            if (external)
                el.removeAttribute(attr.name);
        }
    }
    return svg;
}
/** 길이가 재지지 않는 도형(빈 path 등)이 하나 섞였다고 전체가 죽으면 안 된다. */
function measure(el) {
    try {
        const len = el.getTotalLength();
        return Number.isFinite(len) && len > 0 ? len : 0;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=svg.js.map
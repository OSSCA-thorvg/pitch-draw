/**
 * CDP 드라이버 — 의존성 없이 헤드리스 Chrome 을 몬다. node 22+ 의 전역 WebSocket 을 쓴다.
 *
 * 스크린샷만 찍지 않는다. 이 앱에서 실제로 터진 버그들은 그림으로는 안 보였다 —
 * 캔버스가 버튼을 덮어 클릭을 먹던 것은 좌표 클릭으로만 드러났고, 음정이 옥타브씩
 * 떨어지던 것은 계기판 숫자로만 드러났다.
 *
 * 쓰는 법:
 *   node scripts/drive.mjs <출력디렉터리> [url] [디버그포트]
 */
import { writeFileSync } from 'node:fs';

const outDir = process.argv[2] ?? '.';
const url = process.argv[3] ?? 'http://localhost:8123/';
const port = Number(process.argv[4] ?? 9222);

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === 'page');
if (!target) throw new Error('페이지 타깃이 없다 — Chrome 이 떠 있는가');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });

let seq = 0;
const pending = new Map();
export const errors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id != null) {
    const slot = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? slot?.no(new Error(JSON.stringify(msg.error))) : slot?.ok(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    errors.push(msg.params.entry.text);
  }
};

const send = (method, params = {}) =>
  new Promise((ok, no) => {
    const id = ++seq;
    pending.set(id, { ok, no });
    ws.send(JSON.stringify({ id, method, params }));
  });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval 실패');
  return r.result.value;
};

/**
 * **진짜 마우스 클릭.** `element.click()` 은 히트테스트를 건너뛰므로 무엇이 무엇을
 * 덮고 있는지 절대 못 잡는다. 실제로 그 버그를 놓친 적이 있다.
 */
export const click = async (selector) => {
  const box = await evaluate(`(() => {
    const el = document.querySelector('${selector}');
    if (!el) throw new Error('없는 요소: ${selector}');
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  })()`);
  const { x, y } = JSON.parse(box);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
};

/** 그 요소가 정말 그 자리에서 잡히는가. 덮여 있으면 false. */
export const clickable = (selector) => evaluate(`(() => {
  const el = document.querySelector('${selector}');
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
})()`);

export const screenshot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${outDir}/${name}.png`;
  writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
};

export const viewport = (width, height) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

export const goto = async (to = url) => {
  await send('Page.navigate', { url: to });
  await wait(3500); // ThorVG wasm 이 뜰 때까지
};

export const grantMic = () =>
  send('Browser.grantPermissions', { origin: new URL(url).origin, permissions: ['audioCapture'] });

export const close = () => ws.close();

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

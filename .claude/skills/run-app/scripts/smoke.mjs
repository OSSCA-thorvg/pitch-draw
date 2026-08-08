/**
 * 기본 훑기 — 이 앱이 실제로 도는지 한 번에 확인한다.
 * 여기 있는 항목은 전부 **한 번씩 실제로 터졌던 것들**이다.
 *
 *   node scripts/smoke.mjs <출력디렉터리>
 */
import {
  click, clickable, close, errors, evaluate, goto, grantMic, screenshot, viewport, wait,
} from './drive.mjs';

const fail = [];
const check = (ok, what) => { console.log(`  ${ok ? '✓' : '✗'} ${what}`); if (!ok) fail.push(what); };

await grantMic();

// 1. 뜨는가 ------------------------------------------------------------------
await viewport(1280, 900);
await goto();
const boot = JSON.parse(await evaluate(`JSON.stringify({
  state: document.body.dataset.state,
  status: document.getElementById('status').textContent,
  samples: document.querySelectorAll('button.sample').length,
  locked: [...document.querySelectorAll('button.sample')].some(b => b.disabled),
})`));
console.log('부팅');
check(boot.state === 'idle', `대기 상태로 선다 (${boot.state})`);
check(!boot.status.includes('실패'), `ThorVG 가 떴다 — "${boot.status}"`);
check(boot.samples === 3 && !boot.locked, '예제 버튼이 열려 있다');

// 2. 레이아웃 — 캔버스가 조작부를 덮지 않는가 ---------------------------------
// ThorVG 가 style.width/height 를 인라인으로 박기 때문에 한 번 크게 깨진 적이 있다.
console.log('레이아웃');
for (const h of [800, 900, 1080]) {
  await viewport(1280, h);
  await wait(200);
  const geom = JSON.parse(await evaluate(`(() => {
    const w = document.getElementById('stage-wrap').getBoundingClientRect();
    const c = document.getElementById('stage').getBoundingClientRect();
    return JSON.stringify({ fits: Math.abs(w.height - c.height) < 1 && Math.abs(w.width - c.width) < 1,
                            ratio: (c.width / c.height).toFixed(2) });
  })()`));
  check(geom.fits, `1280x${h}: 캔버스가 래퍼 안에 들어온다`);
  check(geom.ratio === '1.78', `1280x${h}: 비율 유지 (${geom.ratio})`);
}

// 3. 그림과 노래 -------------------------------------------------------------
await viewport(1280, 900);
console.log('그림');
await click('button.sample');
await wait(1400);
const loaded = JSON.parse(await evaluate(`JSON.stringify({
  state: document.body.dataset.state,
  song: document.getElementById('score-meta').textContent,
  target: document.getElementById('target-note').textContent,
})`));
check(loaded.state === 'ready', `준비 상태로 간다 (${loaded.state})`);
check(/·\s*\d+음/.test(loaded.song), `부를 노래가 정해져 있다 — ${loaded.song}`);
check(loaded.target !== '—', `목표 음이 나온다 — ${loaded.target}`);

// 노래는 그림과 따로 고른다. 바꾸면 목표 음도 같이 바뀌어야 한다.
console.log('노래');
const songs = JSON.parse(await evaluate(
  `JSON.stringify([...document.querySelectorAll('button.song')].map(b => b.textContent))`));
check(songs.length >= 3, `노래를 고를 수 있다 — ${songs.join(', ')}`);
await click('button.song:last-of-type');
await wait(400);
const swapped = JSON.parse(await evaluate(`JSON.stringify({
  song: document.getElementById('score-meta').textContent,
  target: document.getElementById('target-note').textContent,
  state: document.body.dataset.state,
})`));
check(swapped.song !== loaded.song, `노래를 바꿀 수 있다 — ${swapped.song}`);
check(swapped.state === 'ready', '노래를 바꿔도 그림은 그대로 서 있다');

// 표기를 직접 넣을 수 있다.
await evaluate(`(() => {
  const input = document.getElementById('melody-text');
  input.value = '라4 라4 라4 라4';
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await wait(400);
const typed = JSON.parse(await evaluate(`JSON.stringify({
  song: document.getElementById('score-meta').textContent,
  target: document.getElementById('target-note').textContent,
})`));
check(/직접 입력/.test(typed.song), `표기를 직접 넣을 수 있다 — ${typed.song}`);
check(typed.target === 'A4', `직접 넣은 음이 목표가 된다 (${typed.target})`);

// 4. 진짜 클릭이 먹히는가 ----------------------------------------------------
// element.click() 으로는 절대 안 잡히는 항목이다.
console.log('조작부');
check(await clickable('#start'), '시작 버튼이 덮여 있지 않다');
check(await clickable('#guide'), '가이드 버튼이 덮여 있지 않다');

// 5. 안 되는 SVG 를 조용히 삼키지 않는가 --------------------------------------
console.log('오류 처리');
await evaluate(`(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'empty.svg', { type: 'image/svg+xml' }));
  window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
})()`);
await wait(500);
const bad = JSON.parse(await evaluate(`JSON.stringify({
  speaking: document.getElementById('overlay').classList.contains('speak'),
  state: document.body.dataset.state,
  target: document.getElementById('target-note').textContent,
})`));
check(bad.speaking, '못 쓰는 SVG 는 화면이 말해준다');
check(bad.state === 'ready' && bad.target !== '—', '실패해도 이전 그림은 살아 있다');

// 6. 마이크 → 펜 전 구간 -----------------------------------------------------
// Chrome 을 --use-fake-device-for-media-stream 으로 띄웠을 때만 의미가 있다.
console.log('연주');
await click('button.sample');
await wait(1300);
await click('#start');
await wait(4500);
const playing = JSON.parse(await evaluate(`JSON.stringify({
  state: document.body.dataset.state,
  progress: document.getElementById('progress').textContent,
})`));
check(playing.state === 'playing', `연주 상태로 간다 (${playing.state})`);
check(parseInt(playing.progress) > 0, `소리에 진행도가 반응한다 (${playing.progress})`);
await screenshot('smoke-playing');

await click('#stop');
await wait(500);
const result = JSON.parse(await evaluate(`JSON.stringify({
  state: document.body.dataset.state,
  progress: document.getElementById('progress').textContent,
  hint: document.getElementById('error-hint').textContent,
})`));
check(result.state === 'result', '결과 화면으로 간다');
check(parseInt(result.progress) < 100, `그만둔 지점을 정직하게 적는다 (${result.progress})`);
check(result.hint.length > 0, `결과를 말해준다 — "${result.hint}"`);
await screenshot('smoke-result');

// -----------------------------------------------------------------------------
console.log('콘솔');
check(errors.length === 0, `오류 없음 ${errors.length ? JSON.stringify(errors) : ''}`);

console.log(fail.length ? `\n실패 ${fail.length}건:\n  - ${fail.join('\n  - ')}` : '\n전부 통과');
close();
process.exit(fail.length ? 1 : 0);

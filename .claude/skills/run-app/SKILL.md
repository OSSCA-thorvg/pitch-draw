---
name: run-app
description: 이 앱(음정으로 그리는 그림)을 정적 서버에 올리고 헤드리스 Chrome 으로 몰아 실제로 도는지 확인한다. 화면을 띄워보라거나, 스크린샷을 찍어달라거나, 바꾼 것이 진짜 브라우저에서 되는지 확인하라고 할 때 쓴다.
---

# 앱 띄워서 확인하기

ES 모듈이라 `file://` 로는 안 열린다. 정적 서버가 반드시 필요하다.
마이크와 ThorVG(wasm) 가 붙는 경로는 타입 검사나 `pnpm test` 로는 절대 안 잡힌다.

## 1. 빌드

```bash
pnpm build            # index.html 은 dist/main.js 를 부른다. 안 하면 빈 화면이다.
```

## 2. 서버와 브라우저 띄우기

```bash
node .claude/skills/run-app/scripts/serve.mjs . 8123 &

"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --remote-debugging-port=9222 --disable-gpu --use-gl=swiftshader \
  --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run --no-default-browser-check --user-data-dir=/tmp/pd-profile \
  about:blank &

# CDP 가 뜰 때까지
for i in $(seq 1 40); do curl -s http://127.0.0.1:9222/json/version >/dev/null && break; done
```

`serve.mjs` 를 쓰는 이유는 MIME 때문이다. ESM 은 JS 타입을 요구하고 ThorVG 의 streaming
instantiate 는 `application/wasm` 을 요구한다. 아무 정적 서버나 되는 게 아니다.

`--use-fake-device-for-media-stream` 은 440Hz 비프를 내는 가짜 마이크를 물려준다.
이게 있어야 **마이크 → 음정 검출 → 세션 → 펜** 전 구간을 확인할 수 있다.

## 3. 훑기

```bash
node .claude/skills/run-app/scripts/smoke.mjs <출력디렉터리>
```

부팅 · 레이아웃(3개 뷰포트) · 악보 만들기 · 조작부 클릭 가능 여부 · 못 쓰는 SVG 처리 ·
마이크로 연주 · 결과 화면을 확인하고, 실패가 있으면 0이 아닌 코드로 끝난다.
스크린샷도 남기니 **반드시 열어봐라.**

직접 몰고 싶으면 `scripts/drive.mjs` 가 `click` · `clickable` · `evaluate` ·
`screenshot` · `viewport` · `goto` 를 내보낸다.

## 4. 정리

```bash
taskkill //F //IM chrome.exe //T
pid=$(netstat -ano | grep ':8123' | grep LISTENING | awk '{print $NF}' | head -1)
[ -n "$pid" ] && taskkill //F //PID "$pid"
```

## 이 앱에서 실제로 터졌던 것들 — 확인할 때 반드시 본다

**`element.click()` 을 쓰지 마라.** 히트테스트를 건너뛴다. 캔버스가 `시작`·`가이드 음 듣기`
버튼을 통째로 덮어 클릭을 먹고 있었는데, JS 클릭으로는 멀쩡히 통과했다. 실제 좌표를 누르는
`click()`(drive.mjs) 이나 `clickable()` 을 써라. ThorVG 의 `Canvas` 생성자가 `style.width`/
`style.height` 를 인라인으로 박기 때문에 캔버스 크기는 CSS 로 순순히 제어되지 않는다 —
레이아웃은 반드시 여러 뷰포트 높이에서 본다.

**스크린샷만 믿지 마라.** 음정 검출이 옥타브씩 틀리던 버그는 그림으로는 전혀 안 보였다.
계기판 텍스트(`#cur-note`, `#error-cents`, `#progress`)를 읽어라.

**캔버스 픽셀을 읽으려 하지 마라.** WebGL 컨텍스트라 `preserveDrawingBuffer` 없이는
`drawImage`/`getImageData` 가 전부 0으로 나온다. 그려졌는지는 스크린샷으로 본다.

**헤드리스에서 프레임 비용은 못 잰다.** 가상 시간이 `performance.now()` 를 얼려서
`?debug` 의 draw 시간이 0.00ms 로 나온다. 그건 실제 브라우저에서 재야 한다.

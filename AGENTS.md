# 음정으로 그리는 그림 (가칭)

그림(SVG)과 악보(MIDI)를 각각 넣는다. 그 악보를 부르면 그림이 그려지고, 음이 틀린 만큼 선이 삐뚤어진다.
악보는 어느 악기로 적혀 있든 목소리 음역으로 옥타브만 옮겨 쓴다 — 곡은 한 음도 안 바뀐다.
ThorVG WebCanvas 기반 정적 웹 앱.

## 빌드

TypeScript 로 쓰고 `tsc` 로만 컴파일한다. 번들러는 쓰지 않는다 — 산출물이 ESM 그대로라
`dist/` 를 정적으로 얹기만 하면 돌아간다. `vendor/` 는 손대지 않고 그 자리에서 불린다.

패키지 매니저는 **pnpm** 이다. `package.json` 의 `packageManager` 에 버전을 박아뒀으니
corepack 이 켜져 있으면 알아서 맞춰 쓴다.

```
pnpm install
pnpm build     # src/*.ts → dist/*.js
pnpm watch     # 고치면서 작업할 때
pnpm check     # 타입 검사 (본 설정 + 테스트 설정)
pnpm test      # node 내장 러너. dist-test/ 로 따로 빌드해 돌린다
```

테스트는 `src/**/*.test.ts` 에 소스와 나란히 둔다. 러너는 node 내장 `node:test` 이고
의존성을 늘리지 않는다. 배포물(`dist/`)에는 안 들어간다 — 검사·실행은 `tsconfig.test.json`
쪽이 맡고 산출물은 `dist-test/` 로 뺀다. 테스트끼리 나눠 쓰는 도구는 `*.fixture.ts` 로
두면 마찬가지로 배포물에서 빠진다.

**DOM 이 필요한 것은 테스트하지 않는다.** `engine/`(`svg.ts` 제외)·`audio/pitch`·`math`
까지가 대상이고, 그 바깥은 `.claude/skills/run-app/` 으로 실제 브라우저에서 확인한다.

가장 중요한 테스트는 `engine/deviation.test.ts` 의 첫 항목과 `engine/session.test.ts` 의
"정확히 부르면 궤적이 목표선 위에 정확히 얹힌다" 다. 이게 거짓이면 이 게임에는 성공을
알리는 방법이 없어진다.

`index.html` 은 `dist/main.js` 를 부른다. **먼저 빌드해야 화면이 뜬다.**
ES 모듈이라 `file://` 로는 열리지 않는다 — 정적 서버로 띄운다
(`python -m http.server` 등).

`dist/` 와 `node_modules/` 는 저장소에 넣지 않는다.

ThorVG 번들에는 `.d.ts` 가 딸려 오지 않아 `vendor/webcanvas.esm.d.ts` 를 손으로 썼다.
**이 앱이 실제로 쓰는 API 만** 들어 있다. 새 API 를 쓰려면 거기 먼저 추가한다.

## 구조

폴더가 곧 층이다. 바깥(브라우저·마이크·ThorVG)에서 안쪽(게임 규칙)으로 간다.

**그림과 노래는 따로 들어온다.** 그림(SVG)은 **어디에** 그려지는지를, 노래(MIDI 악보·표기)는
**무슨 음을 내야** 하는지를 정한다. 드롭 영역은 하나이고 확장자로 갈라 받는다. 둘이 만나는 곳은 `engine/session.ts` 하나뿐이고,
거기서 나오는 규칙이 이 게임의 전부다 — 정확히 부르면 펜이 목표선 위를 지나고,
틀린 만큼만 선에서 밀려난다.

```
src/                 뼈대 — 층에 속하지 않고 층들을 붙인다
  main.ts        진입점. 앱을 세우고 ThorVG 를 띄우는 것까지
  app.ts         화면 상태 기계. 언제 무엇으로 넘어가는가만 정한다
  loop.ts        프레임 루프. 매 프레임 무엇을 그릴지 정해 렌더러에 넘긴다
  score-loader.ts  SVG 텍스트·파일 → 세션. 실패를 조용히 삼키지 않는다
  guide-control.ts 가이드 음을 켜고 끄고, 재생 위치를 내준다
  stage.ts       판 크기. engine 과 draw 가 같은 좌표를 쓰기 위한 계약
  math.ts        clamp·lerp. 도메인 지식 없음

  ui/            화면. DOM 을 만지는 것은 여기까지다
    screen.ts      DOM 핸들과, 화면이 말을 거는 법(status·banner·overlay)
    readout.ts     계기판. 매 프레임 값을 읽을 수 있는 속도로 옮긴다
    controls.ts    버튼·파일 입력. 무엇이 언제 눌리는지의 유일한 규칙
    song-picker.ts 노래 고르기. 내장 멜로디와 직접 입력
    devices.ts     입력 장치 목록과 전환
    samples.ts     내장 예제 그림(SVG)

  draw/          그리기. 무엇을 어떤 색으로만 알고 규칙은 모른다
    renderer.ts    세션 상태를 ThorVG 로 그린다
    palette.ts     종이와 잉크

  engine/        게임 규칙. DOM 도 ThorVG 도 마이크도 여기 안으로 안 들어온다
    session.ts     **세션 엔진 — 이 기능의 유일한 seam.** 그림·노래와 `{hz, dt}` 만 받는다
    melody.ts      무엇을 부를 것인가. 표기 파싱·내장 멜로디·목소리 음역으로 옮기기
    midi.ts        MIDI 악보 읽기. 의존성 없이 직접 판다
    midi-clock.ts  tempo 를 읽어 tick 을 초로. 곡 도중 빨라지고 느려지는 것까지
    deviation.ts   **오차 → 변위.** 성공 신호가 걸린 곳: 정확히 부르면 변위가 0 이다
    svg.ts         신뢰하지 않는 SVG 에서 등간격 점 뽑기. **DOM 을 만지는 유일한 안쪽**
    score.ts       뽑은 점을 스테이지 좌표로. 여기부터는 순수한 계산이다
    trail.ts       궤적. 상한에 닿으면 앞을 버리지 않고 사이를 솎아낸다
    accuracy.ts    평균 오차 누적. 소리가 잡힌 프레임만 센다

  audio/         소리. 그리기도 화면도 모른다
    input.ts       마이크를 열고 프레임마다 음을 내놓는다
    pitch.ts       음 높이 추출(자기상관)
    guide-tone.ts  멜로디 재생
    context.ts     AudioContext 를 여는 단 한 가지 방법
```

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### 앱 띄워서 확인하기

`.claude/skills/run-app/` — 정적 서버 + 헤드리스 Chrome 훑기.
마이크와 ThorVG 가 붙는 경로는 `pnpm check`·`pnpm test` 로는 안 잡힌다.

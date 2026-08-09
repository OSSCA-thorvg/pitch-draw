# 음정으로 그리는 그림

SVG 그림과 악보를 각각 넣고, 그 악보를 노래하면 그림이 그려지는 정적 웹 앱입니다. 정확히 부르면 펜이 목표선 위를 지나가고, 음정이 틀린 만큼 선이 위아래로 밀려납니다.

## 지원 입력

- 그림: SVG
- 악보: MIDI, MML, 간단한 음이름 표기, TXT
- 오디오: MP3, WAV, M4A, AAC, OGG, FLAC
- 마이크: 브라우저 `getUserMedia` 입력 장치

간단한 음이름 표기는 공백으로 음을 나눕니다.

```text
도 레 미 파 솔
C4 D4 E4 F4 G4
솔 솔 라 라 솔 솔 미
```

## 기술 구조

- TypeScript ESM
- ThorVG WebCanvas와 WebAssembly 렌더링
- Web Audio API 기반 마이크 입력과 가이드 음
- 의존성 없는 MIDI/MML 파서
- Node 내장 테스트 러너

주요 폴더는 역할별로 나뉩니다.

- `src/engine`: SVG 점 추출, 멜로디, MIDI/MML, 음정 오차, 세션 규칙
- `src/audio`: 마이크 입력, 음높이 추출, 가이드 톤
- `src/draw`: ThorVG 렌더러와 팔레트
- `src/ui`: DOM 화면, 컨트롤, 계기판, 파일 입력

## 로컬 실행

```bash
pnpm install
pnpm build
pnpm start
```

브라우저에서 `http://127.0.0.1:8123/`을 엽니다. ES 모듈과 WebAssembly를 사용하므로 `file://`로 직접 열면 동작하지 않습니다.

## 검사

```bash
pnpm check
pnpm test
```

DOM, 마이크, ThorVG가 직접 붙는 경로는 실제 브라우저에서 확인합니다. 순수 로직은 `src/**/*.test.ts`의 `node:test` 테스트로 검증합니다.

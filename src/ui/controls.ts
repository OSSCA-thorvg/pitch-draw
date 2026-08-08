/**
 * 조작부 — 버튼과 파일 입력을 만들고, 무엇이 언제 눌릴 수 있는지 정한다.
 *
 * 눌렸을 때 무슨 일이 일어나는지는 하나도 모른다. 눌렸다는 사실만 넘긴다.
 * 그 덕에 "언제 눌리는가"의 규칙이 sync() 한 함수로 모인다 — 전에는 이 규칙이
 * 시작·정지·로딩 완료 세 군데에 흩어져 있었다.
 */

import { els, onFileDrop } from './screen.js';
import { SAMPLES } from './samples.js';

/** 눌렸다는 소식. 받는 쪽이 무엇을 할지 정한다. */
export interface ControlHandlers {
  loadScore(svgText: string, label: string): void;
  /** 그림이든 악보든. 무엇인지는 받는 쪽이 확장자로 가른다. */
  loadFile(file: File | undefined): void;
  toggleGuide(): void;
  play(): void;
  restart(): void;
  stop(): void;
  skipReveal(): void;
}

/** 어느 조작부가 눌릴 수 있는지 정하는 데 필요한 전부. */
export interface ControlState {
  /** 렌더러가 떴는가. 뜨기 전에 그림을 받으면 세션만 서고 화면에는 아무것도 안 그려진다. */
  readonly armed: boolean;
  readonly hasScore: boolean;
  readonly playing: boolean;
  readonly guiding: boolean;
  /** 마이크 권한을 기다리는 중인가. */
  readonly starting: boolean;
}

export interface Controls {
  /** 어느 조작부가 눌리는지는 여기 한 곳에서만 정한다. */
  sync(state: ControlState): void;
}

/** 만드는 즉시 화면에 붙고, 전부 잠긴 채로 선다. */
export function createControls(on: ControlHandlers): Controls {
  /** 그림이 들어오는 문. 렌더러가 뜰 때까지 잠가둔다. */
  const scoreControls: (HTMLButtonElement | HTMLInputElement)[] = [els.file];

  for (const sample of SAMPLES) {
    const button = document.createElement('button');
    button.className = 'sample';
    button.textContent = sample.label;
    button.addEventListener('click', () => { on.loadScore(sample.svg, sample.label); });
    els.samples.appendChild(button);
    scoreControls.push(button);
  }

  els.file.addEventListener('change', () => {
    const file = els.file.files?.[0];
    // 같은 파일을 다시 골라도 change 가 뜨도록 비운다. File 은 이미 손에 있어 지워도 된다.
    els.file.value = '';
    on.loadFile(file);
  });
  onFileDrop((file) => { on.loadFile(file); });

  els.guide.addEventListener('click', () => { on.toggleGuide(); });
  els.start.addEventListener('click', () => { on.play(); });
  els.again.addEventListener('click', () => { on.play(); });
  els.restart.addEventListener('click', () => { on.restart(); });
  els.stop.addEventListener('click', () => { on.stop(); });

  // 리빌은 아무 데나 눌러서 건너뛸 수 있어야 한다.
  window.addEventListener('pointerdown', () => { on.skipReveal(); });
  window.addEventListener('keydown', () => { on.skipReveal(); });

  function sync({ armed, hasScore, playing, guiding, starting }: ControlState): void {
    for (const control of scoreControls) control.disabled = !armed;
    els.start.disabled = !hasScore || guiding || starting;
    els.guide.disabled = !hasScore || playing || starting;
    els.guide.textContent = guiding ? '가이드 음 멈추기' : '가이드 음 듣기';
    els.again.disabled = starting;
  }

  sync({ armed: false, hasScore: false, playing: false, guiding: false, starting: false });

  return { sync };
}

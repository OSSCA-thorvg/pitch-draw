/**
 * 입력 장치 고르기 — 목록을 채우고, 바꾸면 마이크를 다시 연다.
 *
 * 연주 루프와는 상관이 없다. 여기서 하는 일은 "어느 마이크로 들을 것인가"까지고,
 * 거기서 무엇이 들리는지는 audio-input.ts 가 안다.
 */

import { els, status } from './screen.js';
import type { AudioInput } from '../audio/input.js';

export interface Devices {
  /** 지금 고른 장치. 비어 있으면 브라우저 기본 장치가 열린다. */
  readonly selected: string;
  /** 목록을 다시 그린다. 권한이 승인된 직후에 부르면 이름이 채워진다. */
  refresh(): Promise<void>;
}

/** 만드는 즉시 목록을 채우고 조작부에 붙는다. */
export function createDevices(input: AudioInput): Devices {
  async function refresh(): Promise<void> {
    const keep = els.device.value;
    const devices = await input.listDevices();

    els.device.innerHTML = '';
    for (const device of devices) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label;
      els.device.appendChild(option);
    }
    if (keep) els.device.value = keep;
  }

  els.refresh.addEventListener('click', () => { void refresh(); });
  els.device.addEventListener('change', () => {
    // 아직 마이크를 연 적이 없으면 다음 '시작'에서 고른 장치로 열린다.
    if (!input.running) return;
    void input.start(els.device.value).then(
      () => {
        status(`입력 장치를 바꿨습니다 — ${els.device.selectedOptions[0]?.textContent ?? ''}`);
      },
      (err: unknown) => { status(micErrorMessage(err as Error)); },
    );
  });

  // 장치 목록은 권한 전에도 개수는 보인다(이름만 비어 있음).
  void refresh().catch(() => { /* 권한 전에는 실패해도 그만이다 */ });

  return {
    get selected() {
      return els.device.value;
    },
    refresh,
  };
}

/** 마이크를 못 열었을 때 할 말. 브라우저가 주는 이름은 사람이 읽으라고 있는 게 아니다. */
export function micErrorMessage(err: Error): string {
  if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
    return '마이크 권한이 거부되었습니다 — 브라우저 주소창의 권한 설정에서 허용해 주세요.';
  }
  if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
    return '입력 장치를 찾지 못했습니다 — 마이크나 오디오 인터페이스를 연결하고 장치 새로고침을 눌러주세요.';
  }
  return `마이크를 열지 못했습니다 — ${err.message}`;
}

/**
 * 오디오 입력 — 장치를 고르고, 마이크를 열고, 프레임마다 음 높이를 내놓는다.
 *
 * 이 모듈은 그리기도 화면 상태도 알지 못한다. 소리를 숫자로 바꾸는 데까지가 전부다.
 * 음 높이 추출 알고리즘 자체는 pitch.ts 에 있고 여기서 건드리지 않는다.
 */

import { detectPitch, type Pitch } from './pitch.js';
import { createAudioContext } from './context.js';

/** 브라우저 입력이 작게 들어오는 장치까지 앱 안에서 끌어올리는 프리앰프. */
const INPUT_GAIN = 8;

export interface AudioDevice {
  readonly deviceId: string;
  readonly label: string;
}

export interface AudioInput {
  listDevices(): Promise<AudioDevice[]>;
  start(deviceId?: string): Promise<void>;
  stop(): void;
  /** 이번 프레임의 음. 음정을 못 잡으면 null 이다. */
  read(): Pitch | null;
  /**
   * 마지막으로 잰 입력 신호의 세기. 음정과 따로 내는 이유는 read() 가 null 을 준
   * 프레임에도 "소리가 마이크에 들어가고는 있는지"를 보여줘야 하기 때문이다.
   */
  readonly rms: number;
  readonly running: boolean;
}

export function createAudioInput(): AudioInput {
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let preamp: GainNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  // AnalyserNode 는 공유 버퍼가 아닌 것만 받는다.
  let buffer = new Float32Array(new ArrayBuffer(0));

  /** 마지막으로 잰 입력 신호의 세기(0~1 근처). */
  let rms = 0;

  async function listDevices(): Promise<AudioDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // 권한 승인 전에는 label 이 비어 있다. 승인 직후 다시 부르면 이름이 채워진다.
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `입력 장치 ${i + 1}` }));
  }

  async function start(deviceId?: string): Promise<void> {
    if (!audioCtx) {
      audioCtx = createAudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      preamp = audioCtx.createGain();
      preamp.gain.value = INPUT_GAIN;
      preamp.connect(analyser);
      buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT));
    }

    if (source) source.disconnect();
    if (stream) stream.getTracks().forEach((t) => { t.stop(); });

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        // 신호를 가공하면 음정이 뭉개진다. 전부 끈다.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(preamp!);
    // 출력에는 연결하지 않는다 — 하울링 방지.

    await audioCtx.resume();
  }

  function read(): Pitch | null {
    if (!analyser || !audioCtx) return null;

    analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i]! * buffer[i]!;
    rms = Math.sqrt(sum / buffer.length);

    return detectPitch(buffer, audioCtx.sampleRate);
  }

  function stop(): void {
    if (source) source.disconnect();
    if (stream) stream.getTracks().forEach((t) => { t.stop(); });
    source = null;
    stream = null;
    rms = 0;
  }

  return {
    listDevices,
    start,
    stop,
    read,
    get rms() {
      return rms;
    },
    get running() {
      return Boolean(stream);
    },
  };
}

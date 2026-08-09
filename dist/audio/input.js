/**
 * 오디오 입력 — 장치를 고르고, 마이크를 열고, 프레임마다 음 높이를 내놓는다.
 *
 * 이 모듈은 그리기도 화면 상태도 알지 못한다. 소리를 숫자로 바꾸는 데까지가 전부다.
 * 음 높이 추출 알고리즘 자체는 pitch.ts 에 있고 여기서 건드리지 않는다.
 */
import { detectPitch } from './pitch.js';
import { createAudioContext } from './context.js';
/** 브라우저 입력이 작게 들어오는 장치까지 앱 안에서 끌어올리는 프리앰프. */
const INPUT_GAIN = 8;
export function createAudioInput() {
    let audioCtx = null;
    let analyser = null;
    let preamp = null;
    let source = null;
    let stream = null;
    // AnalyserNode 는 공유 버퍼가 아닌 것만 받는다.
    let buffer = new Float32Array(new ArrayBuffer(0));
    /** 마지막으로 잰 입력 신호의 세기(0~1 근처). */
    let rms = 0;
    async function listDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        // 권한 승인 전에는 label 이 비어 있다. 승인 직후 다시 부르면 이름이 채워진다.
        return devices
            .filter((d) => d.kind === 'audioinput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `입력 장치 ${i + 1}` }));
    }
    async function start(deviceId) {
        if (!audioCtx) {
            audioCtx = createAudioContext();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            preamp = audioCtx.createGain();
            preamp.gain.value = INPUT_GAIN;
            preamp.connect(analyser);
            buffer = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT));
        }
        if (source)
            source.disconnect();
        if (stream)
            stream.getTracks().forEach((t) => { t.stop(); });
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
        source.connect(preamp);
        // 출력에는 연결하지 않는다 — 하울링 방지.
        await audioCtx.resume();
    }
    function read() {
        if (!analyser || !audioCtx)
            return null;
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++)
            sum += buffer[i] * buffer[i];
        rms = Math.sqrt(sum / buffer.length);
        return detectPitch(buffer, audioCtx.sampleRate);
    }
    function stop() {
        if (source)
            source.disconnect();
        if (stream)
            stream.getTracks().forEach((t) => { t.stop(); });
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
//# sourceMappingURL=input.js.map
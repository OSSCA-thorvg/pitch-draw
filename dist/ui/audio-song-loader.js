import { createAudioContext } from '../audio/context.js';
import { detectPitch } from '../audio/pitch.js';
import { recordedSamplesToMelody } from '../engine/recorded-melody.js';
import { SING_HIGH_HZ, SING_LOW_HZ } from '../engine/melody.js';
const FRAME_SIZE = 2048;
const STEP_SECONDS = 0.08;
const MAX_SECONDS = 60;
const TARGET_PEAK = 0.7;
const MAX_GAIN = 16;
export function isAudioFile(file) {
    return /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name) || file.type.startsWith('audio/');
}
export async function audioFileToMelody(file, label) {
    const ctx = createAudioContext();
    try {
        const audio = await ctx.decodeAudioData(await file.arrayBuffer());
        const samples = samplesFromAudio(audio);
        return recordedSamplesToMelody(samples, label);
    }
    finally {
        void ctx.close();
    }
}
function samplesFromAudio(audio) {
    const duration = Math.min(audio.duration, MAX_SECONDS);
    const step = Math.max(1, Math.floor(audio.sampleRate * STEP_SECONDS));
    const frame = new Float32Array(FRAME_SIZE);
    const out = [];
    for (let start = 0; start + FRAME_SIZE <= duration * audio.sampleRate; start += step) {
        fillFrame(audio, start, frame);
        const pitch = detectPitch(frame, audio.sampleRate);
        if (pitch)
            out.push({ t: start / audio.sampleRate, hz: intoVoiceRange(pitch.hz) });
    }
    return out;
}
function intoVoiceRange(hz) {
    let out = hz;
    while (out > SING_HIGH_HZ)
        out /= 2;
    while (out < SING_LOW_HZ)
        out *= 2;
    return out;
}
function fillFrame(audio, start, frame) {
    frame.fill(0);
    let peak = 0;
    for (let i = 0; i < frame.length; i++) {
        let mixed = 0;
        for (let channel = 0; channel < audio.numberOfChannels; channel++) {
            mixed += audio.getChannelData(channel)[start + i] ?? 0;
        }
        const value = mixed / audio.numberOfChannels;
        frame[i] = value;
        peak = Math.max(peak, Math.abs(value));
    }
    if (peak <= 0 || peak >= TARGET_PEAK)
        return;
    const gain = Math.min(MAX_GAIN, TARGET_PEAK / peak);
    for (let i = 0; i < frame.length; i++)
        frame[i] = frame[i] * gain;
}
//# sourceMappingURL=audio-song-loader.js.map
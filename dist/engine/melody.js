/**
 * 멜로디 — 무엇을 부를 것인가.
 *
 * 그림과 분리되어 있다. 그림은 **어디에 그려지는가**를 정하고, 멜로디는 **무슨 음을
 * 내야 하는가**를 정한다. 둘이 만나는 곳은 세션 하나뿐이다.
 *
 * 전에는 그림의 y 좌표에서 목표 음을 뽑았다. 그러면 그릴 수 있는 그림이 곧 부를 수 있는
 * 멜로디여서, 세로로 납작한 그림은 부를 수 없는 노래가 됐고 아는 노래를 부를 방법도 없었다.
 */
import { clamp, clamp01 } from '../math.js';
/** 표기에서 음이름을 반음 번호로. 사이(`-`)는 앞 음을 늘린다. */
const SEMITONE = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
    도: 0, 레: 2, 미: 4, 파: 5, 솔: 7, 라: 9, 시: 11,
};
const NOTE_PATTERN = /^([a-gA-G]|[도레미파솔라시])([#b]?)(-?\d)?$/;
/** 기본 옥타브. 4 면 가운데 도(C4) 근처다. */
const DEFAULT_OCTAVE = 4;
/**
 * 표기를 멜로디로 판다. 공백으로 음을 나눈다.
 *
 *   `도 레 미 파 솔` · `C4 D4 E4 F4 G4` · `솔 솔 라 라 솔 솔 미`
 *
 * 옥타브를 안 적으면 4옥타브로 본다. `-` 하나는 앞 음을 한 박 늘린다.
 * `#`·`b` 로 올리고 내린다.
 *
 * @throws {Error} 읽을 수 없는 표기면 어느 토막이 문제인지 담아 던진다.
 */
export function parseMelody(text, label = '직접 입력') {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length)
        throw new Error('멜로디가 비어 있습니다.');
    /** 박 단위로 음을 편다. `-` 는 앞 음을 한 칸 더 차지하게 한다. */
    const beats = [];
    for (const token of tokens) {
        if (token === '-') {
            const last = beats[beats.length - 1];
            if (last == null)
                throw new Error('멜로디가 늘임표(-)로 시작할 수 없습니다.');
            beats.push(last);
            continue;
        }
        beats.push(midiOf(token));
    }
    // 마지막 음도 한 박을 차지한다. 그래서 t 는 박 수가 아니라 박 수로 나눈다.
    const total = beats.length;
    const notes = beats.map((midi, i) => ({ t: i / total, hz: hzOfMidi(midi) }));
    return { label, notes, seconds: null };
}
function midiOf(token) {
    const match = NOTE_PATTERN.exec(token);
    if (!match)
        throw new Error(`읽을 수 없는 음입니다 — "${token}"`);
    const [, name, accidental, octave] = match;
    const semitone = SEMITONE[name.toLowerCase()];
    if (semitone == null)
        throw new Error(`읽을 수 없는 음입니다 — "${token}"`);
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    const oct = octave ? Number(octave) : DEFAULT_OCTAVE;
    return (oct + 1) * 12 + semitone + shift;
}
/** MIDI 번호 → 주파수 (A4 = 440Hz). */
function hzOfMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
/**
 * 진행도에 해당하는 목표 음. 음과 음 사이는 **보간하지 않는다** —
 * 노래는 음에서 음으로 건너뛰지 미끄러지지 않는다. 미끄러지게 하면 어느 순간에도
 * "지금 이 음"이 없어서 맞췄는지 판단할 수 없다.
 *
 * 시작 시각으로 찾는다. 그래서 음마다 길이가 달라도 된다 — 표기로 넣은 멜로디는
 * 길이가 고르지만, 악보 파일에서 온 것은 그렇지 않다.
 */
export function noteAt(melody, t) {
    const notes = melody.notes;
    let found = notes[0];
    if (!found)
        throw new Error('멜로디에 음이 하나도 없습니다.');
    const clamped = clamp01(t);
    for (const note of notes) {
        if (note.t > clamped)
            break;
        found = note;
    }
    return found.hz;
}
/**
 * 부를 수 있는 음역. 여기 밖은 아무도 못 맞추므로 악보가 어디에 적혀 있든 이 안으로 옮긴다.
 * (pitch.ts 의 MIN_HZ/MAX_HZ 는 "음정을 잡아볼 범위"라서 뜻이 다르다.)
 */
export const SING_LOW_HZ = 150; // D3 근처
export const SING_HIGH_HZ = 520; // C5 근처
const BOOM_LOW_HZ = 100;
const COMFORTABLE_MEDIAN_HIGH_HZ = 650;
/**
 * 멜로디를 통째로 옥타브 단위로 옮겨 목소리 음역 한가운데에 놓는다.
 *
 * **옥타브만 옮기므로 곡은 한 음도 안 바뀐다** — 음 사이 간격이 전부 그대로다.
 * 이 게임은 절대 음높이가 아니라 목표에서 몇 센트 벗어났는지만 보므로, 첼로 악보든
 * 플루트 악보든 이렇게 옮겨놓으면 그대로 부를 수 있다. 악기마다 음역이 다른 문제가
 * 여기서 끝난다.
 */
export function transposeIntoVoice(melody) {
    const notes = melody.notes;
    if (!notes.length)
        return melody;
    const middle = Math.sqrt(SING_LOW_HZ * SING_HIGH_HZ); // 로그 축의 한가운데
    const sorted = [...notes].map((n) => n.hz).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const lowest = sorted[0];
    let octaves = Math.round(Math.log2(middle / median));
    while (lowest * Math.pow(2, octaves) < BOOM_LOW_HZ
        && median * Math.pow(2, octaves + 1) <= COMFORTABLE_MEDIAN_HIGH_HZ) {
        octaves++;
    }
    if (octaves === 0)
        return melody;
    const factor = Math.pow(2, octaves);
    const shifted = {
        label: melody.label,
        seconds: melody.seconds,
        notes: notes.map((n) => n.endT == null
            ? { t: n.t, hz: n.hz * factor }
            : { t: n.t, hz: n.hz * factor, endT: n.endT }),
    };
    return melody.preserveSeconds ? { ...shifted, preserveSeconds: true } : shifted;
}
/** 곡이 자기 길이를 모를 때의 완주 시간(초). 표기로 넣은 멜로디가 그렇다. */
export const TARGET_SECONDS = 20;
/**
 * 악보가 자기 길이를 알아도 이 구간 밖으로는 안 나간다.
 * 4초짜리 짧은 곡은 손도 못 대고 끝나고, 3분짜리는 아무도 끝까지 하지 않는다.
 */
const MIN_SECONDS = 8;
const MAX_SECONDS = 45;
/**
 * 이 노래를 몇 초에 완주시킬 것인가.
 * **소리가 나는 동안만 흐르는 시간이다** — 벽시계가 아니다.
 */
export function playSeconds(melody) {
    if (melody.seconds == null)
        return TARGET_SECONDS;
    return melody.preserveSeconds
        ? Math.max(0.1, melody.seconds)
        : clamp(melody.seconds, MIN_SECONDS, MAX_SECONDS);
}
/**
 * 내장 멜로디 — 아무것도 안 고르고도 시작할 수 있어야 한다.
 * 아는 노래여야 목표 음을 눈이 아니라 귀로 안다.
 */
export const MELODIES = [
    parseMelody('라 도5 시 라 솔 미 솔 라 - 도5 시 라 솔 미 레 미 -', '인디 후렴'),
    parseMelody('미 솔 라 도5 시 라 솔 미 - 솔 라 도5 라 솔 미 레 -', '레트로 밴드'),
    parseMelody('도 미 솔 라 솔 미 레 도 - 미 솔 라 도5 라 솔 미 -', '밤 드라이브'),
    parseMelody('솔 라 도5 시 라 솔 미 레 - 미 솔 라 솔 미 레 도 -', '몽환 팝'),
    parseMelody('라 라 도5 시 라 솔 미 - 레 미 솔 미 레 도 - -', '엔딩 크레딧'),
];
//# sourceMappingURL=melody.js.map
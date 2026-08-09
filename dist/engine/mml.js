import { transposeIntoVoice } from './melody.js';
import { mmlParts } from './mml-source.js';
const STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export function mmlToMelody(source, label = 'MML', partIndex = 0) {
    const sourcePart = mmlParts(source)[partIndex] ?? mmlParts(source)[0];
    const part = sourcePart?.source ?? '';
    if (!part.trim())
        throw new Error('MML 멜로디 파트가 비어 있습니다.');
    const timing = readPart(part);
    const notes = timing.notes;
    if (!notes.length)
        throw new Error('MML에서 부를 음을 찾지 못했습니다.');
    const start = notes[0].seconds;
    const seconds = Math.max(1e-6, timing.seconds - start);
    const melodyNotes = notes.map((note) => {
        const t = (note.seconds - start) / seconds;
        const endT = (note.seconds + note.duration - start) / seconds;
        return { t, hz: hzOfMidi(note.midi), endT: Math.max(t, Math.min(1, endT)) };
    });
    return transposeIntoVoice({ label, notes: melodyNotes, seconds, preserveSeconds: true });
}
export function isMml(text) {
    return /\bMML@/i.test(text);
}
export function looksLikeMml(text) {
    return isMml(text)
        || /[<>&;,]/.test(text)
        || /\b[tlov]\d/i.test(text)
        || /\bn\d/i.test(text);
}
export function mmlPartCount(source) {
    return mmlParts(source).length;
}
export function mmlPartLabels(source) {
    return mmlParts(source).map((part) => part.label);
}
function readPart(part) {
    const notes = [];
    let at = 0;
    let tempo = 120;
    let defaultLength = 4;
    let defaultDots = 0;
    let octave = 4;
    let cursor = 0;
    let tieNext = false;
    let lastMidi = null;
    while (at < part.length) {
        const char = part[at].toLowerCase();
        if (/\s/.test(char)) {
            at++;
            continue;
        }
        if (char === '&') {
            tieNext = true;
            at++;
            continue;
        }
        if (char === '<' || char === '>') {
            octave += char === '>' ? 1 : -1;
            at++;
            continue;
        }
        if (char === 't') {
            const read = readNumber(part, at + 1);
            if (read) {
                tempo = read.value;
                at = read.at;
            }
            else
                at++;
            continue;
        }
        if (char === 'l') {
            const read = readNumber(part, at + 1);
            if (read) {
                const dots = readDots(part, read.at);
                defaultLength = read.value;
                defaultDots = dots.count;
                at = dots.at;
            }
            else
                at++;
            continue;
        }
        if (char === 'o') {
            const read = readNumber(part, at + 1);
            if (read) {
                octave = read.value;
                at = read.at;
            }
            else
                at++;
            continue;
        }
        if (char === 'v') {
            const read = readNumber(part, at + 1);
            at = read?.at ?? at + 1;
            continue;
        }
        if (char === 'r') {
            const duration = readDuration(part, at + 1, defaultLength, defaultDots, tempo);
            cursor += duration.seconds;
            tieNext = false;
            at = duration.at;
            continue;
        }
        const parsed = char === 'n'
            ? readAbsoluteNote(part, at, defaultLength, defaultDots, tempo)
            : readNamedNote(part, at, octave, defaultLength, defaultDots, tempo);
        if (!parsed) {
            at++;
            continue;
        }
        if (tieNext && lastMidi === parsed.midi && notes.length) {
            notes[notes.length - 1].duration += parsed.seconds;
        }
        else {
            notes.push({ seconds: cursor, duration: parsed.seconds, midi: parsed.midi });
        }
        cursor += parsed.seconds;
        lastMidi = parsed.midi;
        tieNext = false;
        at = parsed.at;
    }
    return { notes, seconds: cursor };
}
function readNamedNote(part, at, octave, defaultLength, defaultDots, tempo) {
    const step = STEP[part[at].toLowerCase()];
    if (step == null)
        return null;
    let next = at + 1;
    let accidental = 0;
    if (part[next] === '+' || part[next] === '#') {
        accidental = 1;
        next++;
    }
    else if (part[next] === '-') {
        accidental = -1;
        next++;
    }
    const duration = readDuration(part, next, defaultLength, defaultDots, tempo);
    return {
        midi: (octave + 1) * 12 + step + accidental,
        seconds: duration.seconds,
        at: duration.at,
    };
}
function readAbsoluteNote(part, at, defaultLength, defaultDots, tempo) {
    const midi = readNumber(part, at + 1);
    if (!midi)
        return null;
    const duration = readDuration(part, midi.at, defaultLength, defaultDots, tempo);
    return { midi: midi.value + 12, seconds: duration.seconds, at: duration.at };
}
function readDuration(part, at, defaultLength, defaultDots, tempo) {
    const length = readNumber(part, at);
    const read = readDots(part, length?.at ?? at);
    const dots = read.count + (length ? 0 : defaultDots);
    const next = read.at;
    let dotFactor = 1;
    let add = 0.5;
    for (let i = 0; i < dots; i++) {
        dotFactor += add;
        add /= 2;
    }
    const denominator = Math.max(1, length?.value ?? defaultLength);
    const beats = (4 / denominator) * dotFactor;
    return { seconds: beats * (60 / Math.max(1, tempo)), at: next };
}
function readNumber(text, at) {
    let next = at;
    while (/\d/.test(text[next] ?? ''))
        next++;
    if (next === at)
        return null;
    return { value: Number(text.slice(at, next)), at: next };
}
function readDots(text, at) {
    let next = at;
    while (text[next] === '.')
        next++;
    return { count: next - at, at: next };
}
function hzOfMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
//# sourceMappingURL=mml.js.map
/**
 * MIDI 악보 읽기 — 사보 프로그램이 내보낸 파일을 부를 노래로.
 *
 * MIDI 를 고른 이유가 있다. 악보에 적힌 음이 아니라 **실제로 울리는 음**(concert pitch)을
 * 담기 때문에, Bb 클라리넷처럼 적힌 음과 나는 음이 다른 이조악기 문제가 여기서 이미
 * 풀려 있다. 남는 건 악기마다 음역이 다르다는 것뿐인데, 그건 옥타브로 옮기면 된다
 * (melody.ts 의 `transposeIntoVoice`).
 *
 * 이 앱이 필요한 것만 읽는다 — 음높이와 시각, 그리고 tempo. 셈여림·음색·페달은 버린다.
 */

import { transposeIntoVoice, type Melody, type Note } from './melody.js';
import { createMidiClock, type TempoChange } from './midi-clock.js';

/** 한 트랙에서 걷어낸 것. tick 은 파일 안의 시간 단위다. */
interface Track {
  readonly notes: readonly { readonly tick: number; readonly midi: number }[];
  readonly tempos: readonly TempoChange[];
  /** 마지막 소리가 끝나는 자리. 곡 전체 길이를 여기서 잰다. */
  readonly endTick: number;
}

/**
 * @throws {Error} 읽을 수 없는 파일이면 사유를 담아 던진다.
 */
export function midiToMelody(bytes: Uint8Array, label: string): Melody {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || text(bytes, 0, 4) !== 'MThd') {
    throw new Error('MIDI 파일이 아닙니다.');
  }

  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  let at = 8 + view.getUint32(4);

  const tracks: Track[] = [];
  for (let i = 0; i < trackCount && at + 8 <= bytes.length; i++) {
    const length = view.getUint32(at + 4);
    if (text(bytes, at, 4) === 'MTrk') {
      tracks.push(readTrack(bytes, at + 8, Math.min(bytes.length, at + 8 + length)));
    }
    at += 8 + length;
  }

  // tempo 는 대개 첫 트랙에만 적히지만 규격상 어디에나 올 수 있다. 전부 모은다.
  const clock = createMidiClock(division, tracks.flatMap((t) => t.tempos));

  const tune = pickMelody(tracks);
  if (!tune.length) throw new Error('악보에 음이 하나도 없습니다.');

  const endTick = Math.max(...tracks.map((t) => t.endTick), tune[tune.length - 1]!.tick);
  const startedAt = clock(tune[0]!.tick);
  const seconds = clock(endTick) - startedAt;

  const notes: Note[] = tune.map((n) => ({
    t: seconds > 0 ? (clock(n.tick) - startedAt) / seconds : 0,
    hz: 440 * Math.pow(2, (n.midi - 69) / 12),
  }));

  return transposeIntoVoice({ label, notes, seconds: seconds > 0 ? seconds : null });
}

/**
 * 성부가 여럿이면 **음이 가장 많은 트랙**을 멜로디로 본다. 반주는 대개 화음이라
 * 음 수가 많아 보이지만, 같은 시각의 화음은 아래에서 한 음으로 줄이므로 결과적으로
 * 선율선이 이긴다.
 */
function pickMelody(tracks: readonly Track[]): { tick: number; midi: number }[] {
  let best: { tick: number; midi: number }[] = [];
  for (const track of tracks) {
    const voice = topVoice(track.notes);
    if (voice.length > best.length) best = voice;
  }
  return best;
}

/** 같은 시각에 울리는 화음은 맨 위 음만 남긴다 — 노래하는 사람이 따라가는 선이다. */
function topVoice(
  notes: readonly { readonly tick: number; readonly midi: number }[],
): { tick: number; midi: number }[] {
  const byTick = new Map<number, number>();
  for (const note of notes) {
    const current = byTick.get(note.tick);
    if (current == null || note.midi > current) byTick.set(note.tick, note.midi);
  }
  return [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, midi]) => ({ tick, midi }));
}

/** 트랙 하나에서 note-on 과 tempo 를 걷는다. */
function readTrack(bytes: Uint8Array, from: number, to: number): Track {
  const notes: { tick: number; midi: number }[] = [];
  const tempos: TempoChange[] = [];
  let at = from;
  let tick = 0;
  let status = 0;

  while (at < to) {
    const delta = readVarInt(bytes, at);
    at = delta.at;
    tick += delta.value;
    if (at >= to) break;

    let byte = bytes[at]!;
    if (byte & 0x80) {
      status = byte;
      at++;
    } // 그렇지 않으면 러닝 스테이터스 — 앞 이벤트의 상태를 그대로 쓴다
    byte = status;

    if (byte === 0xff) {
      const kind = bytes[at++]!;
      const size = readVarInt(bytes, at);
      // 0x51 = set tempo. 3바이트 빅엔디언, 4분음표 하나의 마이크로초.
      if (kind === 0x51 && size.value === 3) {
        tempos.push({
          tick,
          usPerQuarter: (bytes[size.at]! << 16) | (bytes[size.at + 1]! << 8) | bytes[size.at + 2]!,
        });
      }
      at = size.at + size.value;
      continue;
    }
    if (byte === 0xf0 || byte === 0xf7) {
      const size = readVarInt(bytes, at);
      at = size.at + size.value;
      continue;
    }

    const kind = byte & 0xf0;
    const dataBytes = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    if (kind === 0x90 && bytes[at + 1]! > 0) {
      // 세기 0 인 note-on 은 사실 note-off 다. 쉼표를 음으로 세면 안 된다.
      notes.push({ tick, midi: bytes[at]! });
    }
    at += dataBytes;
  }
  return { notes, tempos, endTick: tick };
}

/** MIDI 의 가변 길이 정수 — 한 바이트에 7비트씩, 최상위 비트가 "더 있다"는 뜻이다. */
function readVarInt(bytes: Uint8Array, from: number): { value: number; at: number } {
  let value = 0;
  let at = from;
  for (let i = 0; i < 4 && at < bytes.length; i++) {
    const byte = bytes[at++]!;
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  return { value, at };
}

function text(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

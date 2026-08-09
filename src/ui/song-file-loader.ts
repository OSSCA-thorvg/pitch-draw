import { mmlToMelody } from '../engine/mml.js';
import { midiToMelody } from '../engine/midi.js';
import { status } from './screen.js';
import { audioFileToMelody, isAudioFile } from './audio-song-loader.js';
import type { Melody } from '../engine/melody.js';

export function loadSongFile(file: File | undefined, onLoaded: (melody: Melody) => void): boolean {
  if (!file) return false;
  if (/\.(mml|txt)$/i.test(file.name) || file.type === 'text/plain') {
    loadTextFile(file, (text) => mmlToMelody(text, labelOf(file.name)), onLoaded);
    return true;
  }
  if (/\.(mid|midi)$/i.test(file.name) || file.type === 'audio/midi' || file.type === 'audio/x-midi') {
    loadBinaryFile(file, (bytes) => midiToMelody(bytes, labelOf(file.name)), onLoaded);
    return true;
  }
  if (isAudioFile(file)) {
    loadAudioFile(file, onLoaded);
    return true;
  }
  return false;
}

function loadTextFile(file: File, read: (text: string) => Melody, onLoaded: (melody: Melody) => void): void {
  status(`악보를 읽는 중입니다 — ${file.name}`);
  void file.text().then(
    (text) => load(() => read(text), onLoaded),
    () => { status(`파일을 읽지 못했습니다 — ${file.name}`); },
  );
}

function loadBinaryFile(file: File, read: (bytes: Uint8Array) => Melody, onLoaded: (melody: Melody) => void): void {
  status(`악보를 읽는 중입니다 — ${file.name}`);
  void file.arrayBuffer().then(
    (buffer) => load(() => read(new Uint8Array(buffer)), onLoaded),
    () => { status(`파일을 읽지 못했습니다 — ${file.name}`); },
  );
}

function load(read: () => Melody, onLoaded: (melody: Melody) => void): void {
  try {
    onLoaded(read());
  } catch (err) {
    status(`악보로 쓸 수 없습니다 — ${(err as Error).message}`);
  }
}

function loadAudioFile(file: File, onLoaded: (melody: Melody) => void): void {
  status(`오디오에서 멜로디를 찾는 중입니다 — ${file.name}`);
  void audioFileToMelody(file, labelOf(file.name)).then(
    onLoaded,
    (err: unknown) => { status(`오디오를 악보로 만들지 못했습니다 — ${(err as Error).message}`); },
  );
}

function labelOf(fileName: string): string {
  return fileName.replace(/\.(mid|midi|mml|txt|mp3|wav|m4a|aac|ogg|flac)$/i, '');
}

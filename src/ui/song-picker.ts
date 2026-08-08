import { createAudioInput } from '../audio/input.js';
import { MELODIES, parseMelody, type Melody } from '../engine/melody.js';
import { looksLikeMml, mmlPartCount, mmlPartLabels, mmlToMelody } from '../engine/mml.js';
import { recordedSamplesToMelody, type RecordedPitchSample } from '../engine/recorded-melody.js';
import { els, status } from './screen.js';
import { loadSongFile } from './song-file-loader.js';

const MAX_RECORD_SECONDS = 45;

export interface SongPicker {
  readonly current: Melody;
  fromFile(file: File | undefined): boolean;
  setEnabled(on: boolean): void;
}

export function createSongPicker(onChange: (melody: Melody) => void): SongPicker {
  let current: Melody = MELODIES[0]!;
  const buttons: HTMLButtonElement[] = [];
  const recorder = createAudioInput();
  let recording = false;
  let samples: RecordedPitchSample[] = [];
  let startedAt = 0;
  let frame = 0;

  function choose(melody: Melody): void {
    current = melody;
    for (const button of buttons) {
      button.classList.toggle('on', button.dataset['label'] === melody.label);
    }
    onChange(melody);
  }

  function chooseLoaded(melody: Melody): void {
    choose(melody);
    status(`악보를 읽었습니다 — ${melody.label} · ${melody.notes.length}음`);
  }

  function setChoiceEnabled(on: boolean): void {
    for (const button of buttons) button.disabled = !on;
    els.melodyText.disabled = !on;
    els.mmlPart.disabled = !on;
    els.applyMelody.disabled = !on;
    els.songFile.disabled = !on;
  }

  function syncMmlPartChoices(text: string): number {
    if (!looksLikeMml(text)) {
      els.mmlPart.hidden = true;
      els.mmlPart.replaceChildren();
      return 0;
    }

    const labels = mmlPartLabels(text);
    const count = labels.length;
    const previous = Number(els.mmlPart.value || 0);
    if (els.mmlPart.options.length !== count) {
      const options = Array.from({ length: count }, (_, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = labels[i] ?? `파트 ${i + 1}`;
        return option;
      });
      els.mmlPart.replaceChildren(...options);
    }

    const selected = Math.min(previous, Math.max(0, count - 1));
    els.mmlPart.value = String(selected);
    els.mmlPart.hidden = count <= 1;
    return selected;
  }

  for (const melody of MELODIES) {
    const button = document.createElement('button');
    button.className = 'song';
    button.textContent = melody.label;
    button.dataset['label'] = melody.label;
    button.addEventListener('click', () => { choose(melody); });
    els.melodies.appendChild(button);
    buttons.push(button);
  }

  function readTyped(): void {
    const text = els.melodyText.value.trim();
    if (!text) return;
    try {
      const isMmlInput = looksLikeMml(text);
      const partIndex = isMmlInput ? syncMmlPartChoices(text) : 0;
      const labels = isMmlInput ? mmlPartLabels(text) : [];
      const label = labels[partIndex] ?? 'MML';
      const melody = isMmlInput ? mmlToMelody(text, label, partIndex) : parseMelody(text);
      chooseLoaded(melody);
    } catch (err) {
      status((err as Error).message);
    }
  }

  function toggleRecording(): void {
    if (recording) finishRecording();
    else void startRecording();
  }

  async function startRecording(): Promise<void> {
    recording = true;
    samples = [];
    setChoiceEnabled(false);
    els.recordSong.disabled = false;
    els.recordSong.textContent = '녹음 끝내기';
    status('기준 멜로디 녹음 중입니다. 첫 음부터 한 번 불러주세요.');
    try {
      await recorder.start();
      startedAt = performance.now();
      frame = requestAnimationFrame(captureFrame);
    } catch (err) {
      recording = false;
      recorder.stop();
      setChoiceEnabled(true);
      els.recordSong.textContent = '노래로 악보 만들기';
      status(`마이크를 열지 못했습니다 — ${(err as Error).message}`);
    }
  }

  function captureFrame(now: number): void {
    if (!recording) return;
    const elapsed = (now - startedAt) / 1000;
    const pitch = recorder.read();
    if (pitch) samples.push({ t: elapsed, hz: pitch.hz });
    els.recordSong.textContent = `녹음 끝내기 ${Math.floor(elapsed)}s`;
    if (elapsed >= MAX_RECORD_SECONDS) finishRecording();
    else frame = requestAnimationFrame(captureFrame);
  }

  function finishRecording(): void {
    recording = false;
    cancelAnimationFrame(frame);
    recorder.stop();
    setChoiceEnabled(true);
    els.recordSong.textContent = '노래로 악보 만들기';
    try {
      chooseLoaded(recordedSamplesToMelody(samples));
    } catch (err) {
      status(`녹음으로 악보를 만들지 못했습니다 — ${(err as Error).message}`);
    }
  }

  els.songFile.addEventListener('change', () => {
    const file = els.songFile.files?.[0];
    els.songFile.value = '';
    loadSongFile(file, chooseLoaded);
  });
  els.melodyText.addEventListener('change', readTyped);
  els.melodyText.addEventListener('input', () => { syncMmlPartChoices(els.melodyText.value.trim()); });
  els.melodyText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) readTyped();
  });
  els.mmlPart.addEventListener('change', readTyped);
  els.applyMelody.addEventListener('click', readTyped);
  els.recordSong.addEventListener('click', toggleRecording);

  choose(current);

  return {
    get current() {
      return current;
    },
    fromFile(file) {
      return loadSongFile(file, chooseLoaded);
    },
    setEnabled(on) {
      setChoiceEnabled(on);
      els.recordSong.disabled = !on && !recording;
    },
  };
}

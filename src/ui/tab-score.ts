import type { Melody, Note } from '../engine/melody.js';

const MAX_FRET = 20;

const STRINGS = [
  { label: 'e', midi: 64 },
  { label: 'B', midi: 59 },
  { label: 'G', midi: 55 },
  { label: 'D', midi: 50 },
  { label: 'A', midi: 45 },
  { label: 'E', midi: 40 },
] as const;

interface TabCell {
  readonly note: Note;
  readonly cells: HTMLElement[];
}

interface Placement {
  readonly string: number;
  readonly fret: number;
}

export interface TabScore {
  show(melody: Melody): void;
  mark(progress: number): void;
}

export function createTabScore(root: HTMLElement): TabScore {
  let melody: Melody | null = null;
  let tabCells: TabCell[] = [];
  let active = -1;

  function show(next: Melody): void {
    melody = next;
    active = -1;
    tabCells = [];
    root.replaceChildren(...rowsFor(next));
    mark(0);
  }

  function mark(progress: number): void {
    if (!melody || !tabCells.length) return;
    const next = noteIndexAt(melody, progress);
    if (next === active) return;

    for (const cell of tabCells[active]?.cells ?? []) cell.classList.remove('now');
    for (const cell of tabCells[next]?.cells ?? []) cell.classList.add('now');
    active = next;

    const current = tabCells[next]?.cells[0];
    current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function rowsFor(next: Melody): HTMLElement[] {
    const placements = placeAll(next.notes);
    return STRINGS.map((string, stringIndex) => {
      const row = document.createElement('div');
      row.className = 'tab-row';

      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = string.label;
      row.appendChild(label);

      for (let noteIndex = 0; noteIndex < next.notes.length; noteIndex++) {
        const note = next.notes[noteIndex]!;
        const placement = placements[noteIndex];
        const cell = document.createElement('span');
        cell.className = 'tab-fret';
        cell.textContent = placement?.string === stringIndex ? String(placement.fret) : '·';
        cell.title = `${noteName(note.hz)} · ${note.hz.toFixed(1)} Hz`;
        row.appendChild(cell);

        const bucket = tabCells[noteIndex] ?? { note, cells: [] };
        bucket.cells.push(cell);
        tabCells[noteIndex] = bucket;
      }

      return row;
    });
  }

  return { show, mark };
}

function placeAll(notes: readonly Note[]): (Placement | null)[] {
  const placed: (Placement | null)[] = [];
  let previous: Placement | null = null;

  for (const note of notes) {
    const next = place(note.hz, previous);
    placed.push(next);
    previous = next ?? previous;
  }

  return placed;
}

function noteIndexAt(melody: Melody, progress: number): number {
  let found = 0;
  for (let i = 0; i < melody.notes.length; i++) {
    if (melody.notes[i]!.t > progress) break;
    found = i;
  }
  return found;
}

function place(hz: number, previous: Placement | null): Placement | null {
  const midi = midiFromHz(hz);
  const candidates = STRINGS
    .map((string, index) => ({ string: index, fret: midi - string.midi }))
    .filter((candidate) => candidate.fret >= 0 && candidate.fret <= MAX_FRET);

  if (!candidates.length) return null;

  return candidates.reduce((best, candidate) =>
    score(candidate, previous) < score(best, previous) ? candidate : best);
}

function score(candidate: Placement, previous: Placement | null): number {
  if (!previous) return candidate.fret;
  return (
    candidate.fret * 0.45
    + Math.abs(candidate.fret - previous.fret)
    + Math.abs(candidate.string - previous.string) * 1.8
  );
}

function midiFromHz(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

function noteName(hz: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = midiFromHz(hz);
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

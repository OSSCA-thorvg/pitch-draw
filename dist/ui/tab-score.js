const MAX_FRET = 20;
const STRINGS = [
    { label: 'e', midi: 64 },
    { label: 'B', midi: 59 },
    { label: 'G', midi: 55 },
    { label: 'D', midi: 50 },
    { label: 'A', midi: 45 },
    { label: 'E', midi: 40 },
];
export function createTabScore(root) {
    let melody = null;
    let tabCells = [];
    let active = -1;
    function show(next) {
        melody = next;
        active = -1;
        tabCells = [];
        root.replaceChildren(...rowsFor(next));
        mark(0);
    }
    function mark(progress) {
        if (!melody || !tabCells.length)
            return;
        const next = noteIndexAt(melody, progress);
        if (next === active)
            return;
        for (const cell of tabCells[active]?.cells ?? [])
            cell.classList.remove('now');
        for (const cell of tabCells[next]?.cells ?? [])
            cell.classList.add('now');
        active = next;
        const current = tabCells[next]?.cells[0];
        current?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function rowsFor(next) {
        const placements = placeAll(next.notes);
        return STRINGS.map((string, stringIndex) => {
            const row = document.createElement('div');
            row.className = 'tab-row';
            const label = document.createElement('span');
            label.className = 'tab-label';
            label.textContent = string.label;
            row.appendChild(label);
            for (let noteIndex = 0; noteIndex < next.notes.length; noteIndex++) {
                const note = next.notes[noteIndex];
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
function placeAll(notes) {
    const placed = [];
    let previous = null;
    for (const note of notes) {
        const next = place(note.hz, previous);
        placed.push(next);
        previous = next ?? previous;
    }
    return placed;
}
function noteIndexAt(melody, progress) {
    let found = 0;
    for (let i = 0; i < melody.notes.length; i++) {
        if (melody.notes[i].t > progress)
            break;
        found = i;
    }
    return found;
}
function place(hz, previous) {
    const midi = midiFromHz(hz);
    const candidates = STRINGS
        .map((string, index) => ({ string: index, fret: midi - string.midi }))
        .filter((candidate) => candidate.fret >= 0 && candidate.fret <= MAX_FRET);
    if (!candidates.length)
        return null;
    return candidates.reduce((best, candidate) => score(candidate, previous) < score(best, previous) ? candidate : best);
}
function score(candidate, previous) {
    if (!previous)
        return candidate.fret;
    return (candidate.fret * 0.45
        + Math.abs(candidate.fret - previous.fret)
        + Math.abs(candidate.string - previous.string) * 1.8);
}
function midiFromHz(hz) {
    return Math.round(69 + 12 * Math.log2(hz / 440));
}
function noteName(hz) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const midi = midiFromHz(hz);
    return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
//# sourceMappingURL=tab-score.js.map
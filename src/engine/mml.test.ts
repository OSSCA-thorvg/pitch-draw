import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playSeconds } from './melody.js';
import { isMml, looksLikeMml, mmlPartCount, mmlPartLabels, mmlToMelody } from './mml.js';

test('reads a simple MML melody', () => {
  const melody = mmlToMelody('MML@t120l4cdefgab>c;', 'mml');

  assert.equal(melody.label, 'mml');
  assert.equal(melody.notes.length, 8);
  assert.ok(Math.abs(melody.notes[0]!.hz - 261.6255653005986) < 0.01);
});

test('keeps written MML duration for playback', () => {
  const melody = mmlToMelody('MML@t60l4cdef;');

  assert.equal(melody.seconds, 4);
  assert.equal(playSeconds(melody), 4);
});

test('moves high MML by octaves into singing range without changing timing', () => {
  const melody = mmlToMelody('MML@o7c;');

  assert.ok(Math.abs(melody.notes[0]!.hz - 261.6255653005986) < 0.01);
  assert.equal(melody.seconds, 0.5);
  assert.equal(playSeconds(melody), 0.5);
});

test('does not push wide MML melodies into boomy bass range', () => {
  const melody = mmlToMelody('MML@o6c<d<<c;');
  const lowest = Math.min(...melody.notes.map((note) => note.hz));

  assert.ok(lowest > 100, `${lowest}Hz is too boomy`);
});

test('rests, dotted lengths, and ties affect timing without adding tied notes', () => {
  const melody = mmlToMelody('MML@t80l16rv15>>e2.&e8.rc2.&c8.r<a+&a+4;');

  assert.equal(melody.notes.length, 3);
  assert.ok(melody.notes[1]!.t > melody.notes[0]!.t);
  assert.ok(melody.notes[2]!.t > melody.notes[1]!.t);
});

test('rests leave a silent gap in timed MML notes', () => {
  const melody = mmlToMelody('MML@t60l4crd;');

  assert.ok(melody.notes[0]!.endT! < melody.notes[1]!.t);
});

test('default dotted lengths apply to later notes and rests', () => {
  const melody = mmlToMelody('MML@t60l4.cdr;');

  assert.equal(melody.seconds, 4.5);
  assert.ok(Math.abs(melody.notes[0]!.endT! - (1.5 / 4.5)) < 1e-9);
});

test('ties extend the previous timed MML note', () => {
  const melody = mmlToMelody('MML@t60l4c&cd;');

  assert.equal(melody.notes.length, 2);
  assert.ok(Math.abs(melody.notes[0]!.endT! - melody.notes[1]!.t) < 1e-9);
});

test('uses only the first MML part', () => {
  const melody = mmlToMelody('MML@c,d,e;');

  assert.equal(melody.notes.length, 1);
  assert.ok(Math.abs(melody.notes[0]!.hz - 261.6255653005986) < 0.01);
});

test('can read a selected MML part', () => {
  const melody = mmlToMelody('MML@c,d,e;', 'mml', 1);

  assert.equal(mmlPartCount('MML@c,d,e;'), 3);
  assert.ok(Math.abs(melody.notes[0]!.hz - 293.6647679174076) < 0.01);
});

test('reads labelled MML blocks and defaults to the melody block', () => {
  const source = [
    'MML',
    '',
    'melody',
    't60l4cde,,;',
    '',
    '화음1',
    't60l4g,,;',
  ].join('\n');
  const melody = mmlToMelody(source);

  assert.deepEqual(mmlPartLabels(source), ['melody', '화음1']);
  assert.equal(mmlPartCount(source), 2);
  assert.equal(melody.notes.length, 3);
  assert.ok(Math.abs(melody.notes[0]!.hz - 261.6255653005986) < 0.01);
});

test('keeps visible MML text from markdown links', () => {
  const melody = mmlToMelody('MML\n\nmelody\n\nt60l4[g8.gf](https://x.test),,;');

  assert.equal(melody.notes.length, 3);
});

test('supports absolute n notes', () => {
  const melody = mmlToMelody('MML@n48n50;');

  assert.equal(melody.notes.length, 2);
  assert.ok(Math.abs(melody.notes[0]!.hz - 261.6255653005986) < 0.01);
  const cents = 1200 * Math.log2(melody.notes[1]!.hz / melody.notes[0]!.hz);
  assert.ok(Math.abs(cents - 200) < 1e-6);
});

test('detects MML text', () => {
  assert.equal(isMml('```txt\nMML@c;\n```'), true);
  assert.equal(isMml('도 레 미'), false);
  assert.equal(looksLikeMml('t80l16rv15>>e2'), true);
});

test('reads MML when pasted from a code block', () => {
  const melody = mmlToMelody('```txt\nMML@t80l16rv15>>e2.&e8;\n```');

  assert.equal(melody.notes.length, 1);
});

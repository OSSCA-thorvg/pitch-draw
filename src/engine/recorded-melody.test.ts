import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordedSamplesToMelody } from './recorded-melody.js';

test('recorded pitch samples become a melody', () => {
  const melody = recordedSamplesToMelody([
    { t: 0, hz: 440 },
    { t: 0.06, hz: 441 },
    { t: 0.12, hz: 440 },
    { t: 0.24, hz: 493.88 },
    { t: 0.31, hz: 494 },
    { t: 0.38, hz: 493.88 },
  ]);

  assert.equal(melody.notes.length, 2);
  assert.ok(Math.abs(melody.notes[0]!.hz - 440) < 0.01);
  assert.ok(Math.abs(melody.notes[1]!.hz - 493.8833012561241) < 0.01);
  assert.ok(melody.seconds !== null && melody.seconds >= 1);
});

test('short pitch glitches are ignored', () => {
  const melody = recordedSamplesToMelody([
    { t: 0, hz: 440 },
    { t: 0.05, hz: 440 },
    { t: 0.10, hz: 466.16 },
    { t: 0.13, hz: 440 },
    { t: 0.20, hz: 440 },
  ]);

  assert.equal(melody.notes.length, 1);
  assert.ok(Math.abs(melody.notes[0]!.hz - 440) < 0.01);
});

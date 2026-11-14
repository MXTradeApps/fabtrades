// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSilences, timingFromSilences} from './timing.mjs';

const log = `
[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 0.35 | silence_duration: 0.35
[silencedetect @ 0x1] silence_start: 3.5
[silencedetect @ 0x1] silence_end: 4.1 | silence_duration: 0.6
[silencedetect @ 0x1] silence_start: 6
[silencedetect @ 0x1] silence_end: 6.31 | silence_duration: 0.31
[silencedetect @ 0x1] silence_start: 8.6
[silencedetect @ 0x1] silence_end: 9.2 | silence_duration: 0.6
[silencedetect @ 0x1] silence_start: 13
[silencedetect @ 0x1] silence_end: 13.7 | silence_duration: 0.7
`;

test('parses ffmpeg silencedetect output', () => {
  const s = parseSilences(log);
  assert.equal(s.length, 5);
  assert.deepEqual(s[1], {start: 3.5, end: 4.1, dur: 0.6});
});

test('the longest pauses become scene starts, short mid-sentence pauses are ignored', () => {
  const t = timingFromSilences(parseSilences(log), 17, 2);
  assert.deepEqual(t.cards, [3.98, 9.08]); // just before the words resume
  assert.equal(t.end, 13.58);
  assert.equal(t.total, 17.8);
});

test('too few pauses is an error, not a bad sync', () => {
  assert.throws(() => timingFromSilences(parseSilences(log), 17, 5), /need 6/);
});

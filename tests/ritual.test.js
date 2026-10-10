import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ritual } from '../src/ritual.js';

const closed = { faceValid: true, eyes: 'closed', handsTogether: true, atChest: true };
const open = { ...closed, eyes: 'open' };
function hold(r, from, to, sample = closed) {
  for (let t = from; t <= to; t += 100) r.observe(sample, t);
}
function waiting() { const r = new Ritual(() => '一条答案'); r.start(0); return r; }
function lit() { const r = waiting(); hold(r, 0, 1500); return r; }

test('a stable pose triggers once after 1.5 seconds', () => {
  let selections = 0;
  const r = new Ritual(() => `答案 ${++selections}`); r.start(0);
  hold(r, 0, 1400); assert.equal(r.phase, 'waiting');
  hold(r, 1500, 2400); assert.equal(r.phase, 'lighting');
  assert.equal(selections, 1);
});

test('interruptions restart the hold rather than accumulate it', () => {
  const r = waiting(); hold(r, 0, 1000);
  r.observe({ ...closed, handsTogether: false }, 1100);
  hold(r, 1200, 2500); assert.equal(r.phase, 'waiting');
  hold(r, 2600, 2700); assert.equal(r.phase, 'lighting');
});

for (const [name, sample] of [
  ['a normal blink', open],
  ['a single hand', { ...closed, handsTogether: false }],
  ['hands above the head', { ...closed, atChest: false }],
  ['lost tracking', { ...closed, faceValid: false, eyes: 'unknown' }],
]) test(`${name} cannot trigger`, () => {
  const r = waiting(); hold(r, 0, 3000, sample); assert.equal(r.phase, 'waiting');
});

test('a long gap between observations breaks continuous pose time', () => {
  const r = waiting(); hold(r, 0, 1000); hold(r, 2000, 3000);
  assert.equal(r.phase, 'waiting');
});

test('stale observations do not leave accumulated light on the rim', () => {
  const r = waiting(); hold(r, 0, 1000); r.tick(1500);
  assert.equal(r.holdProgress, 0);
});

test('putting hands down does not cancel the lighting', () => {
  const r = lit(); hold(r, 1600, 3000, { ...closed, handsTogether: false, atChest: false });
  r.tick(3000); assert.equal(r.phase, 'awaiting-eyes');
});

test('opening eyes early is remembered but answer waits for lighting', () => {
  const r = lit(); hold(r, 1600, 2000, open);
  assert.equal(r.phase, 'lighting'); assert.equal(r.eyesOpened, true);
  r.tick(2999); assert.equal(r.phase, 'lighting');
  r.tick(3000); assert.equal(r.phase, 'revealing');
  r.tick(5000); assert.equal(r.phase, 'reading');
});

test('closed eyes keep the answer hidden indefinitely', () => {
  const r = lit(); hold(r, 1600, 20000); r.tick(20000);
  assert.equal(r.phase, 'awaiting-eyes'); assert.equal(r.eyesOpened, false);
});

test('lost face does not count as open and breaks eye timing', () => {
  const r = lit(); r.tick(3000);
  hold(r, 3100, 3300, open);
  r.observe({ ...open, faceValid: false, eyes: 'unknown' }, 3400);
  hold(r, 3500, 3800, open); assert.equal(r.phase, 'awaiting-eyes');
  r.observe(open, 3900); assert.equal(r.phase, 'revealing');
});

test('reset clears trigger and eye history while retaining previous answer', () => {
  const r = lit(); hold(r, 1600, 2000, open); r.tick(5000);
  r.reset(5100); assert.equal(r.phase, 'resetting'); assert.equal(r.eyesOpened, false);
  r.tick(6100); assert.equal(r.phase, 'waiting'); assert.equal(r.answer, null);
  assert.equal(r.previousAnswer, '一条答案');
  hold(r, 6200, 7700); assert.equal(r.phase, 'lighting');
});

test('reset ignores gestures until the visual reset finishes', () => {
  const r = lit(); hold(r, 1600, 2000, open); r.tick(5000); r.reset(5100);
  hold(r, 5100, 6000); assert.equal(r.phase, 'resetting');
  r.tick(6100); hold(r, 6200, 7600); assert.equal(r.phase, 'waiting');
});

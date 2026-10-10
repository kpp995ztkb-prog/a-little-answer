import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessObservation } from '../src/observation.js';

function frame() {
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99, presence: 0.99 }));
  pose[11] = { x: 0.35, y: 0.35, visibility: 0.99 };
  pose[12] = { x: 0.65, y: 0.35, visibility: 0.99 };
  pose[23] = { x: 0.4, y: 0.9, visibility: 0.1 };
  pose[24] = { x: 0.6, y: 0.9, visibility: 0.1 };
  for (const i of [15, 17, 19, 21]) pose[i] = { x: 0.47, y: 0.52, visibility: 0.99 };
  for (const i of [16, 18, 20, 22]) pose[i] = { x: 0.53, y: 0.52, visibility: 0.99 };
  return { faceValid: true, leftBlink: 0.9, rightBlink: 0.9, pose, hands: [], width: 1280, height: 720 };
}

test('a visible pair of wrists and palms at the chest accepts interlocked hands', () => {
  const result = assessObservation(frame());
  assert.equal(result.eyes, 'closed'); assert.equal(result.handsTogether, true); assert.equal(result.atChest, true);
});

test('an invisible second arm cannot be inferred from one hand', () => {
  const f = frame(); for (const i of [14, 16, 18, 20, 22]) f.pose[i].visibility = 0.1;
  assert.equal(assessObservation(f).handsTogether, false);
});

test('hands above the shoulders cannot count as chest placement', () => {
  const f = frame(); for (const i of [15,16,17,18,19,20,21,22]) f.pose[i].y = 0.1;
  assert.equal(assessObservation(f).atChest, false);
});

test('hand distance scales with body size at different camera distances', () => {
  const f = frame();
  const before = assessObservation(f);
  f.pose = f.pose.map(p => ({ ...p, x: 0.5 + (p.x - 0.5) * 0.5, y: 0.5 + (p.y - 0.5) * 0.5 }));
  const after = assessObservation(f);
  assert.equal(after.handsTogether, before.handsTogether); assert.equal(after.atChest, before.atChest);
});

test('both eyes are required and ambiguous blinks remain unknown', () => {
  const f = frame(); f.rightBlink = 0.2;
  assert.equal(assessObservation(f).eyes, 'unknown');
  f.leftBlink = 0.2; assert.equal(assessObservation(f).eyes, 'open');
  f.faceValid = false; assert.equal(assessObservation(f).eyes, 'unknown');
});

test('missing face or missing shoulders rejects the ritual', () => {
  const f = frame(); f.pose[11].visibility = 0.2;
  assert.equal(assessObservation(f).atChest, false);
  f.pose = []; assert.equal(assessObservation(f).handsTogether, false);
});

test('two separated hands cannot trigger', () => {
  const f = frame(); f.pose[15].x = 0.2; f.pose[16].x = 0.8;
  assert.equal(assessObservation(f).handsTogether, false);
});

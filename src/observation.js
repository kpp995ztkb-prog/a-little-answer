const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const visible = (p, minimum = 0.65) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= minimum && (p.presence ?? 1) >= minimum;

export function assessObservation(frame) {
  const result = { faceValid: !!frame.faceValid, eyes: 'unknown', handsTogether: false, atChest: false };
  if (result.faceValid && Number.isFinite(frame.leftBlink) && Number.isFinite(frame.rightBlink)) {
    if (Math.min(frame.leftBlink, frame.rightBlink) >= 0.28 && (frame.leftBlink + frame.rightBlink) / 2 >= 0.38) result.eyes = 'closed';
    else if (frame.leftBlink <= 0.22 && frame.rightBlink <= 0.22) result.eyes = 'open';
  }
  const p = frame.pose;
  if (!p?.length || !visible(p[11]) || !visible(p[12])) return result;
  // Normalized x and y use different dimensions. Convert to image-height units first.
  const aspect = frame.width / frame.height;
  const point = q => ({ x: q.x * aspect, y: q.y });
  const leftShoulder = point(p[11]), rightShoulder = point(p[12]);
  const shoulder = midpoint(leftShoulder, rightShoulder);
  const span = distance(leftShoulder, rightShoulder);
  if (span < 0.08) return result;
  const leftWrist = point(p[15]), rightWrist = point(p[16]);
  const hands = frame.hands ?? [];
  result.handsUncertain = hands.some(h => {
    const wrist = h[0] && point(h[0]);
    return wrist && Math.abs(wrist.x - shoulder.x) < span * 0.48 &&
      wrist.y > shoulder.y && wrist.y < shoulder.y + span * 1.15;
  }) && [15, 16].every(i => visible(p[i], 0.12));
  let twoHands = false;
  if (hands.length === 2) {
    const wrists = hands.map(h => point(h[0]));
    const matching = Math.min(
      distance(wrists[0], leftWrist) + distance(wrists[1], rightWrist),
      distance(wrists[1], leftWrist) + distance(wrists[0], rightWrist),
    );
    twoHands = matching < span * 0.7;
  }
  // Interlocked fingers may hide one hand from the hand model. Accept only strong
  // evidence for both wrists and palms. Elbows may sit below a laptop camera crop.
  const twoArms = [15, 16].every(i => visible(p[i], 0.65)) && [17, 18, 19, 20].every(i => visible(p[i], 0.6));
  // A detected hand corroborates the pose when interlocked fingers hide the
  // second hand. Both wrists and palms still need independent pose evidence.
  const occludedPair = hands.length >= 1 && [15, 16, 17, 18, 19, 20].every(i => visible(p[i], 0.18)) &&
    hands.some(h => Number.isFinite(h[0]?.x) && Number.isFinite(h[0]?.y) &&
      distance(point(h[0]), leftWrist) < span * 0.6 &&
      distance(point(h[0]), rightWrist) < span * 0.6);
  if (!twoHands && !twoArms && !occludedPair) return result;
  if (!occludedPair && (!visible(p[15], 0.6) || !visible(p[16], 0.6))) return result;
  result.handsTogether = distance(leftWrist, rightWrist) <= span * (occludedPair ? 0.65 : 0.55) &&
    distance(point(p[19]), point(p[20])) <= span * 0.5;

  let chestDepth = span * 0.82;
  if (visible(p[23]) && visible(p[24])) {
    const hips = midpoint(point(p[23]), point(p[24]));
    chestDepth = Math.min(span * 1.15, Math.max(span * 0.5, (hips.y - shoulder.y) * 0.68));
  }
  const inChest = wrist => Math.abs(wrist.x - shoulder.x) < span * 0.48 &&
    wrist.y > shoulder.y + span * 0.06 && wrist.y < shoulder.y + chestDepth;
  result.atChest = inChest(leftWrist) && inChest(rightWrist);
  return result;
}

export const TIMING = Object.freeze({ hold: 1500, lighting: 1500, open: 400, afterOpen: 3000, reveal: 2000, reset: 1000, stale: 350 });

export class Ritual {
  constructor(selectAnswer) {
    this.selectAnswer = selectAnswer;
    this.phase = 'idle';
    this.previousAnswer = null;
    this.answer = null;
    this.clearObservation();
  }

  clearObservation() {
    this.holdAt = null;
    this.lastValidHold = null;
    this.openAt = null;
    this.lastObservation = null;
    this.holdProgress = 0;
    this.eyesOpened = false;
    this.eyesOpenedAt = null;
  }

  start(now) {
    this.clearObservation();
    this.phase = 'waiting';
    this.phaseAt = now;
  }

  observe(sample, now) {
    if (!['waiting', 'lighting', 'awaiting-eyes'].includes(this.phase)) return;
    if (this.lastObservation !== null && now - this.lastObservation > TIMING.stale) {
      this.holdAt = null;
      this.openAt = null;
    }
    this.lastObservation = now;
    if (this.phase === 'waiting') {
      const valid = sample.faceValid && sample.eyes === 'closed' && sample.handsTogether && sample.atChest;
      if (valid) { this.holdAt ??= now; this.lastValidHold = now; }
      else {
        const briefOcclusion = sample.faceValid && sample.eyes === 'closed' && sample.handsUncertain &&
          this.lastValidHold !== null && now - this.lastValidHold <= 250;
        if (briefOcclusion && this.holdAt !== null) return;
        this.holdAt = null; this.lastValidHold = null;
      }
      this.holdProgress = this.holdAt === null ? 0 : Math.min(1, (now - this.holdAt) / TIMING.hold);
      if (this.holdProgress === 1) {
        this.answer = this.selectAnswer(this.previousAnswer);
        this.previousAnswer = this.answer;
        this.phase = 'lighting';
        this.phaseAt = now;
        this.holdProgress = 0;
      }
    } else if (!this.eyesOpened) {
      const open = sample.faceValid && sample.eyes === 'open';
      this.openAt = open ? (this.openAt ?? now) : null;
      if (this.openAt !== null && now - this.openAt >= TIMING.open) {
        this.eyesOpened = true; this.eyesOpenedAt = now;
      }
    }
    this.tick(now);
  }

  tick(now) {
    if (this.lastObservation !== null && now - this.lastObservation > TIMING.stale) {
      this.holdAt = null;
      this.openAt = null;
      this.holdProgress = 0;
    }
    if (this.phase === 'lighting' && now - this.phaseAt >= TIMING.lighting) {
      this.phaseAt += TIMING.lighting;
      this.phase = 'awaiting-eyes';
    }
    if (this.phase === 'awaiting-eyes' && this.eyesOpened && now - this.eyesOpenedAt >= TIMING.afterOpen) {
      this.phase = 'revealing';
      this.phaseAt = Math.max(this.phaseAt, this.eyesOpenedAt + TIMING.afterOpen);
    }
    if (this.phase === 'revealing' && now - this.phaseAt >= TIMING.reveal) {
      this.phase = 'reading';
      this.phaseAt += TIMING.reveal;
    }
    if (this.phase === 'resetting' && now - this.phaseAt >= TIMING.reset) {
      this.answer = null;
      this.start(now);
    }
  }

  reset(now) {
    if (this.phase !== 'reading') return;
    this.clearObservation();
    this.phase = 'resetting';
    this.phaseAt = now;
  }
}

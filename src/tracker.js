import { assessObservation } from './observation.js';

export class Tracker {
  constructor(onSample, onStatus) {
    this.onSample = onSample;
    this.onStatus = onStatus;
    this.ready = false;
    this.busy = false;
    this.lastCapture = -Infinity;
    this.lastVideoTime = -1;
    this.generation = 0;
    this.active = false;
    this.worker = null;
  }

  init() {
    this.destroy();
    this.onStatus('loading');
    const worker = new Worker(new URL(`${import.meta.env.BASE_URL}vision-worker.js`, location.origin));
    this.worker = worker;
    this.loadingTimer = setTimeout(() => this.fail('识别模型加载超时'), 45000);
    worker.onmessage = ({ data }) => {
      if (worker !== this.worker) return;
      if (data.type === 'ready') {
        clearTimeout(this.loadingTimer); this.ready = true; this.onStatus('ready');
      } else if (data.type === 'sample') {
        this.busy = false;
        if (this.active && data.generation === this.generation && performance.now() - data.at <= 350) {
          this.onSample(assessObservation(data.frame), data.at);
        }
      } else if (data.type === 'error') this.fail(data.message);
    };
    worker.onerror = event => { event.preventDefault(); this.fail(event.message); };
    worker.postMessage({ type: 'init', base: new URL(import.meta.env.BASE_URL, location.origin).href });
  }

  fail(message) {
    console.error('Local vision:', message);
    this.destroy(); this.onStatus('error');
  }

  async pump(video, now, phase) {
    const active = ['waiting', 'lighting', 'awaiting-eyes'].includes(phase) && !document.hidden;
    if (active !== this.active) { this.active = active; this.generation++; }
    if (!active || !this.ready || this.busy || video.readyState < 2 || now - this.lastCapture < 100 || video.currentTime === this.lastVideoTime) return;
    this.busy = true; this.lastCapture = now; this.lastVideoTime = video.currentTime;
    const worker = this.worker, generation = this.generation;
    try {
      const bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeHeight: Math.round(640 * video.videoHeight / video.videoWidth) });
      if (worker !== this.worker || generation !== this.generation) { bitmap.close(); this.busy = false; return; }
      worker.postMessage({ type: 'frame', bitmap, at: now, generation, handsRequired: phase === 'waiting' }, [bitmap]);
    } catch (error) { this.fail(error.message); }
  }

  destroy() {
    clearTimeout(this.loadingTimer);
    this.worker?.terminate(); this.worker = null;
    this.ready = false; this.busy = false; this.active = false;
    this.lastCapture = -Infinity; this.lastVideoTime = -1; this.generation++;
  }
}

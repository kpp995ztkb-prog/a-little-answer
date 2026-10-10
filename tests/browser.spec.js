import { test, expect } from '@playwright/test';

async function setup(page) {
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    setInterval(() => {
      const g = ctx.createLinearGradient(0, 0, 1280, 720);
      g.addColorStop(0, '#5c7770'); g.addColorStop(1, '#c4c2a2'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#eee3c5'; ctx.fillRect(100 + (Date.now() % 3000) / 10, 170, 120, 380);
      ctx.fillStyle = '#36594e'; ctx.fillRect(750, 150, 160, 440);
    }, 30);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => canvas.captureStream(30) });
    window.__CRYSTAL_TEST__ = { createTracker(onSample, onStatus) {
      window.sendSample = onSample;
      return { async init() { onStatus('ready'); }, pump() {}, destroy() {} };
    } };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '开启镜头' }).click();
  await expect(page.getByRole('textbox', { name: '你的昵称' })).toBeVisible();
}

async function submit(page, name = '小鹿') {
  await page.getByRole('textbox', { name: '你的昵称' }).fill(name);
  await page.getByRole('textbox', { name: '你的昵称' }).press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'waiting', { timeout: 6500 });
}

async function samples(page, eyes, milliseconds) {
  await page.evaluate(async ({ eyes, milliseconds }) => {
    const sample = { faceValid: true, eyes, handsTogether: true, atChest: true };
    const from = performance.now();
    do { window.sendSample(sample, performance.now()); await new Promise(r => setTimeout(r, 70)); }
    while (performance.now() - from <= milliseconds);
    window.sendSample(sample, performance.now());
  }, { eyes, milliseconds });
}

test('camera, Unicode nickname, continuous reveal and locked center', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#nickname-form button, #nickname-hint, .enter-hint')).toHaveCount(0);
  await page.getByRole('textbox').fill('   ');
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'naming');
  await page.getByRole('textbox').fill('ABCDEFGHIJKLM');
  await expect(page.getByRole('textbox')).toHaveValue('ABCDEFGHIJKL');
  await page.getByRole('textbox').fill('小鹿');
  await page.screenshot({ path: 'test-results/opening.png' });
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'pullback');
  const centerBefore = await page.locator('#sphere-name').boundingBox();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'waiting', { timeout: 6500 });
  const centerAfter = await page.locator('#sphere-name').boundingBox();
  expect(Math.abs(centerBefore.y + centerBefore.height / 2 - centerAfter.y - centerAfter.height / 2)).toBeLessThan(1);
  await expect(page.locator('#sphere-name')).toHaveText('小鹿');
  await page.screenshot({ path: 'test-results/waiting.png' });
});

test('answer stays hidden until open eyes, then reset retains name and changes answer', async ({ page }) => {
  await setup(page); await submit(page);
  await samples(page, 'closed', 1700);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'lighting');
  await samples(page, 'open', 500);
  await expect(page.locator('#answer')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'reading', { timeout: 5000 });
  const first = await page.locator('#answer').textContent();
  await page.screenshot({ path: 'test-results/answer.png' });
  await page.getByRole('button', { name: '再问一次' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'waiting', { timeout: 2500 });
  await expect(page.locator('#sphere-name')).toHaveText('小鹿');
  await expect(page.locator('#answer')).not.toBeVisible();
  await samples(page, 'closed', 1700);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'awaiting-eyes', { timeout: 2500 });
  await expect(page.locator('#answer')).not.toBeVisible();
  await samples(page, 'open', 500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'reading', { timeout: 3500 });
  expect(await page.locator('#answer').textContent()).not.toBe(first);
});

test('permission failure leaves a usable retry', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  });
  await page.goto('/'); await page.getByRole('button', { name: '开启镜头' }).click();
  await expect(page.locator('#camera-error')).toContainText('允许');
  await expect(page.getByRole('button', { name: '开启镜头' })).toBeEnabled();
});

test('the local worker loads all models and processes a real image frame', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = []; const external = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/');
  const sample = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('/vision-worker.js');
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Worker timed out')); }, 45000);
    worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
    worker.onmessage = async ({ data }) => {
      if (data.type === 'error') { clearTimeout(timeout); worker.terminate(); reject(new Error(data.message)); }
      if (data.type === 'ready') {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#9eb2a0'; ctx.fillRect(0,0,640,360);
        const bitmap = await createImageBitmap(canvas);
        worker.postMessage({ type: 'frame', bitmap, at: performance.now(), generation: 1, handsRequired: true }, [bitmap]);
      }
      if (data.type === 'sample') { clearTimeout(timeout); worker.terminate(); resolve(data.frame); }
    };
    worker.postMessage({ type: 'init', base: `${location.origin}/` });
  }));
  expect(sample.faceValid).toBe(false);
  expect(sample.pose).toEqual([]);
  expect(sample.hands).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(external).toEqual([]);
});

test('IME Enter does not submit and surrounding whitespace does not consume name length', async ({ page }) => {
  await setup(page);
  const input = page.getByRole('textbox');
  await input.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  await input.fill('小鹿');
  await input.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'naming');
  await input.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(await input.evaluate(el => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    el.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  await input.fill('  ABCDEFGHIJKL  ');
  await input.press('Enter');
  await expect(page.locator('#sphere-name')).toHaveText('ABCDEFGHIJKL');
});

test('nickname cutout contains clear live-camera pixels while the material covers its surroundings', async ({ page }) => {
  await setup(page);
  await page.getByRole('textbox').fill('小鹿');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const result = await page.evaluate(() => {
    const scene = document.getElementById('scene'), video = document.getElementById('camera');
    const expected = document.createElement('canvas'); expected.width = scene.width; expected.height = scene.height;
    const ctx = expected.getContext('2d');
    const scale = Math.max(innerWidth / video.videoWidth, innerHeight / video.videoHeight);
    const dpr = scene.width / innerWidth; ctx.scale(dpr, dpr); ctx.translate(innerWidth / 2, innerHeight / 2); ctx.scale(-1,1);
    ctx.drawImage(video, -video.videoWidth * scale / 2, -video.videoHeight * scale / 2, video.videoWidth * scale, video.videoHeight * scale);
    const x = Math.round((innerWidth / 2 - 90) * dpr), y = Math.round((innerHeight * .55 - 48) * dpr);
    const width = Math.round(180 * dpr), height = Math.round(96 * dpr);
    const actual = scene.getContext('2d').getImageData(x,y,width,height).data;
    const original = expected.getContext('2d').getImageData(x,y,width,height).data;
    let clear = 0, covered = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const difference = Math.abs(actual[i]-original[i]) + Math.abs(actual[i+1]-original[i+1]) + Math.abs(actual[i+2]-original[i+2]);
      if (difference < 5) clear++;
      if (difference > 40) covered++;
    }
    return { clear, covered };
  });
  expect(result.clear).toBeGreaterThan(400);
  expect(result.covered).toBeGreaterThan(4000);
});

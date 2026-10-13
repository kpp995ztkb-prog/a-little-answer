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

test('camera, Unicode nickname and opening text moves into the mirror', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#nickname-form button, #nickname-hint, .enter-hint')).toHaveCount(0);
  await page.getByRole('textbox').fill('   ');
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'naming');
  await page.getByRole('textbox').fill('ABCDEFGHIJKLM');
  await expect(page.getByRole('textbox')).toHaveValue('ABCDEFGHIJKL');
  await page.getByRole('textbox').fill('小鹿');
  const centerBefore = await page.locator('#sphere-name').boundingBox();
  await page.screenshot({ path: 'test-results/opening.png' });
  await page.getByRole('textbox').press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'pullback');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'waiting', { timeout: 6500 });
  const centerAfter = await page.locator('#sphere-name').boundingBox();
  const viewport = page.viewportSize();
  expect(centerBefore.x + centerBefore.width / 2).toBeCloseTo(viewport.width * .66, 0);
  expect(centerBefore.y + centerBefore.height / 2).toBeCloseTo(viewport.height * .72, 0);
  expect(centerAfter.x + centerAfter.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(centerAfter.y + centerAfter.height / 2).toBeLessThan(centerBefore.y + centerBefore.height / 2);
  await expect(page.locator('#sphere-name')).toHaveText('小鹿');
  await page.screenshot({ path: 'test-results/waiting.png' });
});

test('answer stays hidden until open eyes, then reset retains name and changes answer', async ({ page }) => {
  await setup(page); await submit(page);
  await samples(page, 'closed', 1700);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'lighting');
  await samples(page, 'open', 500);
  await expect(page.locator('#answer')).not.toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.locator('#answer')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'reading', { timeout: 8500 });
  await expect(page.locator('#answer')).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await page.locator('#answer').evaluate(el => getComputedStyle(el).textShadow)).not.toBe('none');
  const first = await page.locator('#answer').textContent();
  await page.screenshot({ path: 'test-results/answer.png' });
  await expect(page.locator('#keepsake')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'keepsake', { timeout: 4500 });
  await expect(page.locator('#wish-name')).toHaveText('小鹿');
  await expect(page.locator('#wish-answer')).toHaveText(first);
  await expect(page.locator('#wish-photo')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('#wish-time')).toContainText(/\d{4}\/\d{2}\/\d{2}/);
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'test-results/keepsake.png' });
  const frozenPhoto = await page.locator('#wish-photo').getAttribute('src');
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const surface = await page.locator('#keepsake').boundingBox();
    expect(surface).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    const card = await page.locator('.wish-card').boundingBox();
    expect(card.width / card.height).toBeCloseTo(viewport.width > viewport.height ? 16 / 9 : 736 / 917, 3);
    if (viewport.width > viewport.height) expect(card.width).toBeGreaterThanOrEqual(viewport.width * .9);
    for (const selector of ['.wish-photo-paper', '.wish-name-ticket', '.wish-time-stamp', '.wish-answer-lace']) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.locator('#wish-photo').getAttribute('src')).toBe(frozenPhoto);
    await page.screenshot({ path: `test-results/keepsake-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '再问一次' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'waiting', { timeout: 2500 });
  await expect(page.locator('#sphere-name')).toHaveText('小鹿');
  await expect(page.locator('#answer')).not.toBeVisible();
  await samples(page, 'closed', 1700);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'awaiting-eyes', { timeout: 2500 });
  await expect(page.locator('#answer')).not.toBeVisible();
  await samples(page, 'open', 500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'reading', { timeout: 7000 });
  expect(await page.locator('#answer').textContent()).not.toBe(first);
});

test('permission failure leaves a usable retry', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  });
  await page.goto('/');
  await expect(page.locator('#camera-error')).toContainText('允许');
  await expect(page.getByRole('button', { name: '重新开启镜头' })).toBeEnabled();
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

test('nickname uses white luminous lettering after the paper backing is removed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await setup(page);
  await page.getByRole('textbox').fill('小鹿');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const white = await page.evaluate(() => {
    const scene = document.getElementById('scene'), dpr = scene.width / innerWidth;
    const pixels = scene.getContext('2d').getImageData(Math.round((innerWidth*.66-140)*dpr), Math.round((innerHeight*.72-60)*dpr), Math.round(280*dpr), Math.round(120*dpr)).data;
    let white = 0;
    for (let i=0;i<pixels.length;i+=4) if (pixels[i]>235 && pixels[i+1]>235 && pixels[i+2]>235) white++;
    return white;
  });
  expect(white).toBeGreaterThan(100);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1080 }]) {
  test(`desktop composition clears guidance and status at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page); await submit(page);
    const bounds = await page.evaluate(async () => {
      const { Renderer } = await import('/src/renderer.js');
      const renderer = new Renderer(document.createElement('canvas'), document.getElementById('camera'));
      const art = new Image(); art.src = '/art/decor-atlas.png'; await art.decode();
      renderer.decorParts = art;
      const objects = [];
      const original = renderer.ctx.drawImage.bind(renderer.ctx);
      renderer.ctx.drawImage = (...args) => {
        if (args[0] === art) objects.push({ x: args[5], y: args[6], width: args[7], height: args[8] });
        original(...args);
      };
      renderer.drawFramedScene(1, '小鹿', 0);
      return { objects, top: 0, bottom: innerHeight };
    });
    expect(bounds.objects).toHaveLength(10);
    expect(bounds.objects[0].height).toBeGreaterThan(viewport.height * .68);
    expect(bounds.objects[0].width / bounds.objects[0].height).toBeCloseTo(365 / 325, 5);
    await expect(page.locator('#guidance')).toBeVisible();
    const guidance = await page.locator('#guidance').boundingBox();
    expect(guidance.x).toBeLessThan(viewport.width * .1);
    expect(guidance.y).toBeLessThan(viewport.height * .1);
    expect(await page.locator('#guidance p').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Fusion Pixel');
    for (const object of bounds.objects) {
      expect(object.x).toBeGreaterThanOrEqual(16);
      expect(object.x + object.width).toBeLessThanOrEqual(viewport.width - 16);
      expect(object.y).toBeGreaterThanOrEqual(bounds.top + 16);
      expect(object.y + object.height).toBeLessThanOrEqual(bounds.bottom - 16);
    }
    await page.screenshot({ path: `test-results/desktop-${viewport.width}x${viewport.height}.png` });
  });
}

test('mirror transition uses opaque scaling, pastel background and rotating decorations', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const renderer = new Renderer(document.createElement('canvas'), document.getElementById('camera'));
    const art = new Image(); art.src = '/art/decor-atlas.png'; await art.decode(); renderer.decorParts = art;
    const frames = [], alphas = [], rotations = [];
    const drawImage = renderer.ctx.drawImage.bind(renderer.ctx);
    renderer.ctx.drawImage = (...args) => {
      if (args[0] === art && args[1] === 0 && args[2] === 40) { frames.push(args[7]); alphas.push(renderer.ctx.globalAlpha); }
      drawImage(...args);
    };
    const rotate = renderer.ctx.rotate.bind(renderer.ctx);
    renderer.ctx.rotate = angle => { rotations.push(angle); rotate(angle); };
    renderer.drawFramedScene(.2, '', 0, 0, 0);
    renderer.drawFramedScene(.8, '', 0, 0, 0);
    renderer.drawFramedScene(1, '', 0, 0, 0);
    const light = renderer.ctx.getImageData(0, 0, 1, 1).data[0];
    renderer.drawFramedScene(1, '', 1, .5, 3000);
    const dark = renderer.ctx.getImageData(0, 0, 1, 1).data[0];
    return { frames, alphas, rotations, light, dark };
  });
  expect(result.alphas.every(alpha => alpha === 1)).toBe(true);
  expect(result.frames[0]).toBeGreaterThan(result.frames[1]);
  expect(result.frames[3]).toBeGreaterThan(result.frames[2]);
  expect(result.frames[3] / result.frames[2]).toBeCloseTo(1.06, 5);
  expect(result.rotations.some(angle => Math.abs(angle) > .0001)).toBe(true);
  expect(result.rotations.every(angle => Math.abs(angle) <= .01)).toBe(true);
  expect(result.dark).toBe(result.light);
});


test('decorations float gently with different rhythms and respect reduced motion', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const renderer = new Renderer(document.createElement('canvas'), document.getElementById('camera'));
    const art = new Image(); art.src = '/art/decor-atlas.png'; await art.decode(); renderer.decorParts = art;
    let objects = [];
    const original = renderer.ctx.drawImage.bind(renderer.ctx);
    renderer.ctx.drawImage = (...args) => { if (args[0] === art) objects.push(args[6]); original(...args); };
    const sample = now => { objects = []; renderer.drawFramedScene(1, '', 0, 0, now); return objects; };
    const first = sample(0), second = sample(2100);
    renderer.reducedMotion = true;
    const still = sample(0), stillLater = sample(2100);
    return { first, second, still, stillLater };
  });
  expect(result.first[0]).toBe(result.second[0]);
  const movement = result.second.slice(1).map((y, i) => y - result.first[i + 1]);
  expect(movement.some(delta => delta > 1)).toBe(true);
  expect(movement.some(delta => delta < -1)).toBe(true);
  expect(movement.some(delta => Math.abs(delta) > 16)).toBe(true);
  expect(movement.every(delta => Math.abs(delta) <= 40)).toBe(true);
  expect(result.still).toEqual(result.stillLater);
});

import './style.css';
import { Renderer, smooth } from './renderer.js';
import { Ritual, TIMING } from './ritual.js';
import { Tracker } from './tracker.js';
import { chooseAnswer } from './answers.js';
import { normalizeNickname } from './nickname.js';

const byId = id => document.getElementById(id);
const video = byId('camera');
const input = byId('nickname');
const renderer = new Renderer(byId('scene'), video);
const ritual = new Ritual(chooseAnswer);
let phase = 'camera', phaseAt = 0, nickname = '', cameraReady = false;
let trackingState = 'loading', lastSample = null, sampleAt = 0, composing = false;
let stream = null, previousPhase = '', previousStatus = '';
let wishPhoto = '', wishTime = null;

const onSample = (sample, now) => {
  lastSample = sample; sampleAt = now;
  if (document.hidden) return;
  const before = ritual.phase;
  ritual.observe(sample, now);
  if (before === 'waiting' && ritual.phase === 'lighting') {
    wishPhoto = renderer.captureWish();
    wishTime = new Date();
  }
};
const onTrackingStatus = status => { trackingState = status; };
// Test injection is available only to the development server, never in the build.
const tracker = import.meta.env.DEV && window.__CRYSTAL_TEST__
  ? window.__CRYSTAL_TEST__.createTracker(onSample, onTrackingStatus)
  : new Tracker(onSample, onTrackingStatus);

function updateNickname() {
  if (!composing) {
    if (Array.from(input.value.trim()).length > 12) input.value = normalizeNickname(input.value);
  }
  nickname = normalizeNickname(input.value);
}
input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; updateNickname(); });
input.addEventListener('input', updateNickname);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (composing || event.isComposing || event.keyCode === 229)) event.preventDefault();
});

byId('nickname-form').addEventListener('submit', event => {
  event.preventDefault();
  if (composing || !nickname || phase !== 'naming') return;
  input.value = nickname; input.blur();
  byId('sphere-name').textContent = nickname;
  phase = 'pullback'; phaseAt = performance.now();
  byId('nickname-form').hidden = true;
});

async function enableCamera() {
  const button = byId('enable-camera'); button.disabled = true;
  byId('camera-error').textContent = '';
  byId('camera-gate').hidden = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    video.srcObject = stream; await video.play();
    cameraReady = true; phase = 'naming'; phaseAt = performance.now();
    byId('camera-gate').hidden = true; byId('nickname-form').hidden = false;
    await document.fonts.load('48px "Fusion Pixel"');
    renderer.introAt = performance.now();
    input.focus();
    tracker.init();
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
      cameraReady = false; tracker.destroy(); ritual.start(performance.now());
      phase = 'camera'; byId('camera-gate').hidden = false;
      byId('nickname-form').hidden = true;
      byId('camera-error').textContent = '镜头已断开，请重新开启镜头。';
    });
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    const messages = {
      NotAllowedError: '请在浏览器中允许摄像头访问，再试一次。',
      NotFoundError: '没有找到摄像头，请连接摄像头后再试一次。',
      NotReadableError: '摄像头暂时无法使用，请关闭占用镜头的应用后重试。',
    };
    byId('camera-error').textContent = messages[error.name] || (error.message === 'UNSUPPORTED'
      ? '请使用支持摄像头的电脑浏览器，并通过 localhost 或 HTTPS 打开。'
      : '镜头连接没有成功，请检查摄像头后重试。');
    byId('camera-gate').hidden = false;
  } finally { button.disabled = false; }
}
byId('enable-camera').addEventListener('click', enableCamera);
void enableCamera();

byId('ask-again').addEventListener('click', () => {
  ritual.reset(performance.now()); wishPhoto = ''; wishTime = null; lastSample = null; sampleAt = 0;
});
byId('retry-tracking').addEventListener('click', () => { lastSample = null; sampleAt = 0; tracker.init(); });
window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  // Leaving the tab cannot complete a pose or an eye-open interval.
  if (document.hidden) ritual.observe({ faceValid: false, eyes: 'unknown', handsTogether: false, atChest: false }, performance.now());
});
window.addEventListener('pagehide', () => { tracker.destroy(); stream?.getTracks().forEach(track => track.stop()); });

function updateUi(now, glow) {
  const effectivePhase = phase === 'ritual' ? ritual.phase : phase;
  if (effectivePhase !== previousPhase) {
    document.body.dataset.phase = effectivePhase;
    byId('guidance').hidden = !['waiting', 'lighting'].includes(effectivePhase);
    byId('ask-again').hidden = effectivePhase !== 'keepsake';
    if (effectivePhase === 'keepsake') byId('ask-again').focus({ preventScroll: true });
    byId('keepsake').hidden = effectivePhase !== 'keepsake';
    if (effectivePhase === 'keepsake') {
      byId('wish-photo').src = wishPhoto;
      byId('wish-name').textContent = nickname;
      byId('wish-answer').textContent = ritual.answer;
      byId('wish-time').dateTime = wishTime.toISOString();
      byId('wish-time').textContent = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(wishTime).replace(' ', '\n');
    }
    const visibleAnswer = ['revealing', 'reading', 'resetting'].includes(effectivePhase);
    byId('answer').hidden = !visibleAnswer;
    if (visibleAnswer) byId('answer').textContent = ritual.answer;
    byId('tracking-panel').hidden = !['waiting', 'awaiting-eyes'].includes(effectivePhase);

    const announcements = { waiting: '将双手握合放在胸前，闭上眼睛默想问题。', lighting: '镜子正在靠近，可以放下双手。', 'awaiting-eyes': '准备好时，慢慢睁开眼睛。' };
    byId('live-announcement').textContent = announcements[effectivePhase] ?? '';
    previousPhase = effectivePhase;
  }
  byId('guidance').style.opacity = effectivePhase === 'lighting' ? 1 - glow : 1;
  const revealed = effectivePhase === 'reading' ? 1 : effectivePhase === 'revealing'
    ? smooth((now - ritual.phaseAt) / TIMING.reveal) : effectivePhase === 'resetting'
      ? 1 - smooth((now - ritual.phaseAt) / TIMING.reset) : 0;
  byId('answer').style.opacity = revealed;
  const status = trackingState === 'error' ? '识别暂时没有连接成功，请重试。'
    : trackingState === 'loading' ? '正在准备识别，请稍等片刻。'
      : effectivePhase === 'awaiting-eyes' ? (ritual.eyesOpened ? '答案正在来到你身边。' : '准备好时，慢慢睁开眼睛。')
        : !lastSample?.faceValid || now - sampleAt > 350 ? '请让脸和双手都进入镜头。'
          : ritual.holdProgress > 0 ? '就这样，停留片刻。'
            : !lastSample.handsTogether ? '还没看清双手，请将双手握合并放进镜头。'
              : !lastSample.atChest ? '已看到双手，请将它们放在胸前。'
                : lastSample.eyes !== 'closed' ? '已看到双手握合，请轻轻闭眼。'
                  : '就这样，停留片刻。';
  if (status !== previousStatus) { byId('tracking-status').textContent = status; previousStatus = status; }
  byId('retry-tracking').hidden = trackingState !== 'error';
  byId('sphere-name').style.fontSize = `${renderer.nicknameSize(nickname, phase === 'naming' ? 0 : 1)}px`;
}

function frame(now) {
  let zoom = 0, filmOpacity = 1, glow = 0, expansion = 0;
  if (phase === 'pullback') {
    zoom = smooth((now - phaseAt) / 3000);
    if (now - phaseAt >= 3000) { phase = 'clearing'; phaseAt += 3000; }
  }
  if (phase === 'clearing') {
    zoom = 1; filmOpacity = 1 - smooth((now - phaseAt) / 1000);
    if (now - phaseAt >= 1000) { phase = 'ritual'; ritual.start(now); }
  }
  if (phase === 'ritual') {
    zoom = 1; filmOpacity = 0; ritual.tick(now);
    if (ritual.phase === 'lighting') {
      const elapsed = now - ritual.phaseAt;
      glow = smooth(elapsed / 400);
      expansion = smooth((elapsed - 300) / (TIMING.lighting - 300));
    }
    else if (ritual.phase === 'resetting') {
      expansion = glow = 1 - smooth((now - ritual.phaseAt) / TIMING.reset);
    }
    else if (['awaiting-eyes', 'revealing', 'reading', 'keepsake'].includes(ritual.phase)) expansion = glow = 1;
  }
  renderer.draw({ now, zoom, filmOpacity, nickname: phase === 'camera' ? '' : nickname, glow, expansion,
    hold: phase === 'ritual' ? ritual.holdProgress : 0, phase: ritual.phase, cameraReady });
  updateUi(now, glow);
  if (cameraReady) tracker.pump(video, now, phase === 'ritual' ? ritual.phase : phase);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

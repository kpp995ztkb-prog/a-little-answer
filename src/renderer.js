const clamp = value => Math.min(1, Math.max(0, value));
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const serif = '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif';

export class Renderer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.lens = document.createElement('canvas');
    this.lensCtx = this.lens.getContext('2d', { alpha: false });
    this.film = document.createElement('canvas');
    this.filmCtx = this.film.getContext('2d');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.charge = 0;
    this.lastFrame = 0;
    this.resize();
  }

  resize() {
    this.width = innerWidth; this.height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const surface of [this.lens, this.film]) { surface.width = this.width; surface.height = this.height; }
    this.cx = this.width / 2; this.cy = this.height * 0.55;
    this.finalRadius = Math.min(245, this.width * (this.width < 650 ? 0.38 : 0.24), this.height * 0.225);
    this.initialRadius = Math.hypot(this.width, this.height) * 0.68;
    document.documentElement.style.setProperty('--center-y', `${this.cy}px`);
    document.documentElement.style.setProperty('--radius', `${this.finalRadius}px`);
  }

  nicknameSize(nickname, zoom) {
    const target = mix(Math.min(84, this.width * 0.075), Math.min(36, this.finalRadius * 0.19), zoom);
    this.ctx.font = `italic ${target}px ${serif}`;
    const available = mix(Math.min(660, this.width * 0.78), this.finalRadius * 1.38, zoom);
    return Math.min(target, target * available / Math.max(1, this.ctx.measureText(nickname || '你的名字').width));
  }

  drawVideo(ctx, scale, centerX, centerY) {
    const video = this.video;
    if (video.readyState < 2 || !video.videoWidth) return;
    const width = video.videoWidth * scale, height = video.videoHeight * scale;
    ctx.save(); ctx.translate(centerX, centerY); ctx.scale(-1, 1);
    ctx.drawImage(video, -width / 2, -height / 2, width, height); ctx.restore();
  }

  draw({ now, zoom, filmOpacity, nickname, glow, hold, phase, cameraReady }) {
    const { ctx, width: w, height: h, cx, cy } = this;
    const radius = mix(this.initialRadius, this.finalRadius, zoom);
    const dt = Math.min(100, now - (this.lastFrame || now)); this.lastFrame = now;
    this.charge += (hold - this.charge) * (1 - Math.exp(-dt / 200));
    ctx.fillStyle = '#d9d9d7'; ctx.fillRect(0, 0, w, h);
    if (cameraReady) {
      const backgroundScale = Math.max(w / this.video.videoWidth, h / this.video.videoHeight);
      this.drawVideo(ctx, backgroundScale, w / 2, h / 2);
      ctx.fillStyle = `rgba(17, 24, 21, ${0.57 * glow})`; ctx.fillRect(0, 0, w, h);
      this.lensCtx.fillStyle = '#999997'; this.lensCtx.fillRect(0, 0, w, h);
      const lensScale = mix(backgroundScale, this.finalRadius * 2 / this.video.videoHeight, zoom);
      this.drawVideo(this.lensCtx, lensScale, cx, mix(h / 2, cy, zoom));
      this.drawBase(radius, zoom, glow);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
      if (zoom < 0.6 || radius > h * 0.55) ctx.drawImage(this.lens, 0, 0);
      else {
        // A small, continuous horizontal/vertical refraction of the same frame.
        const top = Math.max(0, cy - radius), bottom = Math.min(h, cy + radius);
        const step = (bottom - top) / 80;
        for (let y = top; y < bottom; y += step) {
          const normalized = (y - cy) / radius;
          const bend = 0.024 * zoom * (1 - normalized * normalized);
          const sourceY = Math.min(h - step - 1, Math.max(0, y + normalized * bend * radius));
          const extra = w * bend;
          ctx.drawImage(this.lens, 0, sourceY, w, step + 1, -extra / 2, y, w + extra, step + 1);
        }
      }
      ctx.fillStyle = `rgba(18, 24, 22, ${glow * 0.15})`; ctx.fillRect(0, 0, w, h);
      if (glow > 0) this.drawAtmosphere(radius, glow, now, phase);
      ctx.restore();
      this.drawGlass(radius, zoom, glow);
    }
    if (filmOpacity > 0) this.drawFilm(radius, zoom, filmOpacity, nickname, !cameraReady);
    if (nickname && cameraReady && filmOpacity < 1) this.drawName(nickname, zoom, 1 - filmOpacity, glow);
    return { radius, nameSize: this.nicknameSize(nickname, zoom) };
  }

  drawFilm(radius, zoom, opacity, nickname, gate) {
    const { filmCtx: ctx, width: w, height: h, cx, cy } = this;
    ctx.clearRect(0, 0, w, h);
    // A neutral translucent film lets the live camera show through.
    ctx.fillStyle = 'rgba(245, 245, 245, .42)'; ctx.fillRect(0, 0, w, h);
    if (!gate) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#f5f2e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const surfaceScale = radius / this.initialRadius;
      const gift = '这份答案送给珍贵的';
      let giftSize = Math.min(34, w * 0.043);
      ctx.font = `${giftSize}px ${serif}`;
      giftSize *= Math.min(1, w * 0.84 / ctx.measureText(gift).width);
      ctx.font = `${giftSize * surfaceScale}px ${serif}`;
      ctx.fillText(gift, cx, cy - Math.min(123, h * 0.17) * surfaceScale);
      const nameSize = this.nicknameSize(nickname, zoom);
      ctx.font = `italic ${nameSize}px ${serif}`;
      ctx.globalAlpha = nickname ? 1 : 0.43;
      ctx.fillText(nickname || '你的名字', cx, cy);
      ctx.restore();
      ctx.strokeStyle = 'rgba(55, 55, 55, .38)'; ctx.lineWidth = 0.7;
      const lineWidth = Math.min(450, w * 0.58) * surfaceScale;
      ctx.beginPath(); ctx.moveTo(cx - lineWidth / 2, cy + 52 * surfaceScale); ctx.lineTo(cx + lineWidth / 2, cy + 52 * surfaceScale); ctx.stroke();
    }
    this.ctx.save(); this.ctx.globalAlpha = opacity;
    this.ctx.beginPath(); this.ctx.arc(cx, cy, radius, 0, Math.PI * 2); this.ctx.clip();
    this.ctx.drawImage(this.film, 0, 0); this.ctx.restore();
  }

  drawName(nickname, zoom, opacity, glow) {
    const { ctx, cx, cy } = this;
    ctx.save(); ctx.globalAlpha = opacity; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic ${this.nicknameSize(nickname, zoom)}px ${serif}`;
    ctx.fillStyle = `rgb(${Math.round(mix(241, 255, glow))}, ${Math.round(mix(238, 219, glow))}, ${Math.round(mix(222, 149, glow))})`;
    ctx.shadowColor = glow > 0.01 ? `rgba(245, 186, 77, ${glow * 0.8})` : 'rgba(21, 31, 26, .75)';
    ctx.shadowBlur = mix(3, 15, glow); ctx.shadowOffsetY = 0;
    ctx.fillText(nickname, cx, cy);
    if (glow > 0) { ctx.shadowBlur = 3; ctx.fillText(nickname, cx, cy); }
    ctx.restore();
  }

  drawGlass(radius, opacity, glow) {
    const { ctx, cx, cy } = this;
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const body = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, radius * 0.55, cx, cy, radius);
    body.addColorStop(0, 'rgba(236, 244, 235, 0)');
    body.addColorStop(0.86, 'rgba(210, 233, 226, .055)');
    body.addColorStop(0.96, 'rgba(33, 54, 48, .22)');
    body.addColorStop(0.984, 'rgba(235, 245, 238, .50)');
    body.addColorStop(1, 'rgba(236, 244, 235, .12)');
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = 'rgba(233, 243, 231, .5)'; ctx.lineWidth = 1.2; ctx.stroke();
    const arc = (start, end, color, lineWidth, inset = 0) => {
      ctx.beginPath(); ctx.arc(cx, cy, radius - inset, start, end); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
    };
    ctx.lineCap = 'round';
    arc(Math.PI * 1.10, Math.PI * 1.61, 'rgba(239, 246, 233, .70)', radius * 0.013, radius * 0.025);
    arc(Math.PI * 1.12, Math.PI * 1.32, 'rgba(252, 248, 219, .48)', radius * 0.006, radius * 0.047);
    arc(Math.PI * 0.02, Math.PI * 0.29, 'rgba(223, 246, 247, .5)', radius * 0.016, radius * 0.038);
    arc(Math.PI * 0.55, Math.PI * 0.84, `rgba(248, 216, 156, ${0.16 + glow * 0.28})`, radius * 0.01, radius * 0.025);
    ctx.save(); ctx.translate(cx + radius * 0.54, cy - radius * 0.57); ctx.rotate(-0.58);
    const highlight = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.16);
    highlight.addColorStop(0, 'rgba(248, 250, 237, .66)'); highlight.addColorStop(1, 'rgba(248, 250, 237, 0)');
    ctx.fillStyle = highlight; ctx.scale(0.58, 1); ctx.beginPath(); ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (glow > 0 || this.charge > 0.01) {
      ctx.shadowColor = '#edc57e'; ctx.shadowBlur = radius * 0.07;
      arc(0, Math.PI * 2, `rgba(248, 210, 139, ${glow * 0.34 + this.charge * 0.28})`, 1.7);
    }
    ctx.restore();
  }

  drawBase(radius, opacity, glow) {
    const { ctx, cx, cy } = this;
    const y = cy + radius * 0.91, halfWidth = radius * 0.68;
    ctx.save(); ctx.globalAlpha = opacity;
    const shadow = ctx.createRadialGradient(cx, y + radius * 0.32, 0, cx, y + radius * 0.32, radius * 0.9);
    shadow.addColorStop(0, 'rgba(10, 17, 14, .5)'); shadow.addColorStop(1, 'rgba(10, 17, 14, 0)');
    ctx.save(); ctx.translate(cx, y + radius * 0.31); ctx.scale(1, 0.22); ctx.fillStyle = shadow;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
    const block = (top, height, width) => {
      const gradient = ctx.createLinearGradient(cx - width, top, cx + width, top + height);
      gradient.addColorStop(0, '#211e1b'); gradient.addColorStop(0.24, '#53443b');
      gradient.addColorStop(0.43, '#282520'); gradient.addColorStop(0.75, '#171c19'); gradient.addColorStop(1, '#3e332e');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(cx - width, top); ctx.bezierCurveTo(cx - width * 1.04, top + height, cx - width, top + height, cx, top + height * 1.12);
      ctx.bezierCurveTo(cx + width, top + height, cx + width * 1.04, top + height, cx + width, top);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, top, width, radius * 0.075, 0, 0, Math.PI * 2);
      const ring = ctx.createLinearGradient(cx, top - radius * 0.08, cx, top + radius * 0.08);
      ring.addColorStop(0, '#8b8170'); ring.addColorStop(0.24, '#453c32'); ring.addColorStop(0.65, '#141b18'); ring.addColorStop(1, '#736351');
      ctx.fillStyle = ring; ctx.fill(); ctx.strokeStyle = 'rgba(233, 220, 189, .25)'; ctx.lineWidth = 0.8; ctx.stroke();
    };
    block(y + radius * 0.20, radius * 0.13, halfWidth * 1.07);
    block(y + radius * 0.12, radius * 0.13, halfWidth * 0.99);
    block(y + radius * 0.02, radius * 0.15, halfWidth * 0.87);
    ctx.beginPath(); ctx.ellipse(cx, y + radius * 0.025, halfWidth * 0.85, radius * 0.063, 0, 0, Math.PI);
    ctx.strokeStyle = `rgba(254, 215, 139, ${0.18 + glow * 0.7})`; ctx.lineWidth = 1.4;
    ctx.shadowColor = '#edc176'; ctx.shadowBlur = glow * 15; ctx.stroke(); ctx.restore();
  }

  drawAtmosphere(radius, glow, now, phase) {
    const { ctx, cx, cy } = this;
    const motion = this.reducedMotion || ['revealing', 'reading', 'resetting'].includes(phase) ? 0.12 : 1;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = cx + Math.sin(now / 12000 * motion + i * 2) * radius * 0.24;
      const y = cy + radius * (0.26 + i * 0.11);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22);
      const mist = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.8);
      mist.addColorStop(0, `rgba(223, 220, 169, ${glow * 0.075})`); mist.addColorStop(1, 'rgba(223, 220, 169, 0)');
      ctx.fillStyle = mist; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
    }
    for (let i = 0; i < 18; i++) {
      const angle = i * 2.39996 + now / 40000 * motion;
      const orbit = radius * (0.25 + (i % 7) * 0.077);
      const x = cx + Math.cos(angle) * orbit, y = cy + Math.sin(angle) * orbit;
      const alpha = glow * (0.14 + 0.18 * (0.5 + 0.5 * Math.sin(i + now / 2200 * motion)));
      ctx.fillStyle = `rgba(252, 224, 163, ${alpha})`; ctx.shadowColor = '#efca84'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 1.3 : 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

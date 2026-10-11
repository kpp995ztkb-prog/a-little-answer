const clamp = value => Math.min(1, Math.max(0, value));
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const nameFont = '"Bodoni 72", "Didot", "Songti SC", Georgia, serif';
const serif = '"Fusion Pixel", monospace';

export class Renderer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.lens = document.createElement('canvas');
    this.lensCtx = this.lens.getContext('2d', { alpha: false });
    this.film = document.createElement('canvas');
    this.filmCtx = this.film.getContext('2d');
    this.grain = document.createElement('canvas');
    this.grain.width = this.grain.height = 256;
    const grainCtx = this.grain.getContext('2d');
    const pixels = grainCtx.createImageData(256, 256);
    let seed = 37;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const shade = seed >>> 24;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = shade;
      pixels.data[i + 3] = 5;
    }
    grainCtx.putImageData(pixels, 0, 0);
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.charge = 0;
    this.lastFrame = 0;
    this.resize();
    const parts = new Image();
    parts.onload = () => { this.decorParts = parts; };
    parts.src = `${import.meta.env.BASE_URL}art/decor-atlas.png`;
    const wingImage = new Image();
    wingImage.onload = () => {
      const sheet = document.createElement('canvas');
      sheet.width = wingImage.width; sheet.height = wingImage.height;
      const context = sheet.getContext('2d'); context.drawImage(wingImage, 0, 0);
      const pixels = context.getImageData(0, 0, sheet.width, sheet.height);
      // Render the supplied dotted artwork in white, excluding its paper background.
      for (let i = 0; i < pixels.data.length; i += 4) {
        const ink = 255 - (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
        pixels.data[i + 3] = ink > 35 ? Math.min(255, ink * 1.25) : 0;
      }
      context.putImageData(pixels, 0, 0); this.wingArtwork = sheet;
    };
    wingImage.src = `${import.meta.env.BASE_URL}art/wing-reference.png`;
  }

  resize() {
    this.width = innerWidth; this.height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const surface of [this.lens, this.film]) { surface.width = this.width; surface.height = this.height; }
    this.cx = this.width / 2; this.cy = this.height * 0.5;
    this.desktopLayout = this.width > 650;
    if (this.desktopLayout) {
      const top = Math.max(160, this.height * .18);
      const bottom = Math.max(64, this.height * .08);
      this.sceneScale = Math.min((this.width - 48) / 1440, Math.max(1, this.height - top - bottom) / 760);
      this.cy = this.height / 2;
      this.frameSize = Math.min(this.width * .62, (this.height - 48) * 365 / 325);
    }
    this.frameScale = this.desktopLayout ? this.frameSize * .24 / 151 : Math.min(this.width * .52 / 436, this.height * .44 / 302);
    this.finalRadius = 151 * this.frameScale;
    this.initialRadius = Math.hypot(this.width, this.height) * 0.68;
    document.documentElement.style.setProperty('--center-y', `${this.cy}px`);
    document.documentElement.style.setProperty('--radius', `${this.finalRadius}px`);
  }

  nicknameSize(nickname, zoom) {
    const finalSize = this.desktopLayout ? Math.min(96, this.finalRadius * .42) : Math.min(60, this.finalRadius * .25);
    const target = mix(Math.min(108, this.width * 0.095), finalSize, zoom);
    this.ctx.font = `italic 600 ${target}px ${nameFont}`;
    const available = mix(Math.min(660, this.width * (this.desktopLayout ? .60 : .78)), this.finalRadius * (this.desktopLayout ? 2.1 : 1.38), zoom);
    return Math.min(target, target * available / Math.max(1, this.ctx.measureText(nickname || '你的名字').width));
  }

  drawVideo(ctx, scale, centerX, centerY) {
    const video = this.video;
    if (video.readyState < 2 || !video.videoWidth) return;
    const width = video.videoWidth * scale, height = video.videoHeight * scale;
    ctx.save(); ctx.translate(centerX, centerY); ctx.scale(-1, 1);
    ctx.drawImage(video, -width / 2, -height / 2, width, height); ctx.restore();
  }

  draw({ now, zoom, filmOpacity, nickname, glow, hold, phase, cameraReady, expansion = 0 }) {
    const { ctx, width: w, height: h, cx, cy } = this;
    if (cameraReady && !this.wasCameraReady) this.introAt = now;
    this.wasCameraReady = cameraReady;
    this.introProgress = this.reducedMotion ? 1 : smooth((now - (this.introAt ?? now)) / 3200);
    this.introPulse = this.reducedMotion ? 0.5 : 0.5 + Math.sin(now / 1800) * 0.5;
    this.lightPulse = this.reducedMotion ? 1 : .75 + .25 * Math.sin(now / 1050);
    const radius = mix(this.initialRadius, this.finalRadius, zoom);
    if (cameraReady && this.decorParts) {
      this.drawFramedScene(zoom, nickname, glow, expansion, now);
      if (filmOpacity > 0) this.drawFilm(radius, zoom, filmOpacity, nickname, false);
      return { radius, nameSize: this.nicknameSize(nickname, zoom) };
    }
    const dt = Math.min(100, now - (this.lastFrame || now)); this.lastFrame = now;
    this.charge += (hold - this.charge) * (1 - Math.exp(-dt / 200));
    ctx.fillStyle = '#17171e'; ctx.fillRect(0, 0, w, h);
    if (cameraReady) {
      const backgroundScale = Math.max(w / this.video.videoWidth, h / this.video.videoHeight);
      ctx.save(); ctx.filter = 'blur(20px) saturate(1.15)';
      this.drawVideo(ctx, backgroundScale * 1.08, w / 2, h / 2); ctx.restore();
      ctx.fillStyle = 'rgba(255, 255, 255, .24)'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = ctx.createPattern(this.grain, 'repeat'); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(17, 24, 21, ${0.57 * glow})`; ctx.fillRect(0, 0, w, h);
      this.lensCtx.fillStyle = '#999997'; this.lensCtx.fillRect(0, 0, w, h);
      const lensScale = mix(backgroundScale, this.finalRadius * 2 / this.video.videoHeight, zoom);
      this.drawVideo(this.lensCtx, lensScale, cx, mix(h / 2, cy, zoom));
      this.drawWings(radius, zoom, glow);
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
    if (cameraReady && zoom > 0 && this.decorParts) this.drawFramedScene(zoom, nickname, glow);
    return { radius, nameSize: this.nicknameSize(nickname, zoom) };
  }

  drawFramedScene(zoom, nickname, glow, expansion = 0, now = 0) {
    const { ctx, width: w, height: h, cx, cy } = this;
    if (!this.decorParts) return;
    const dt = Math.max(0, Math.min(100, now - (this.decorTime ?? now)));
    this.decorTime = now;
    this.decorRotation = (this.decorRotation ?? 0) + (this.reducedMotion ? 0 : dt * .000004 * glow);
    ctx.save();
    ctx.fillStyle = '#f7eff4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(196,171,186,.22)';
    for (let y=14;y<h;y+=24) for(let x=14;x<w;x+=24) {
      ctx.beginPath(); ctx.arc(x,y,1.4,0,Math.PI*2); ctx.fill();
    }
    // Each atlas cell contains one complete object, including transparent padding.
    // Never clip a decoration to an ellipse or hand-drawn polygon.
    const art = this.decorParts;
    const regions = [
      [0,40,365,325], [430,0,240,398], [720,45,365,340], [1080,65,368,305],
      [20,400,335,330], [430,420,235,310], [730,425,350,310], [1080,475,368,235],
      [0,760,395,320], [395,755,335,315],
    ];
    const tile = (index,x,y,size) => {
      if (index > 0 && !this.reducedMotion) {
        y += Math.sin(now / (1400 + index * 90) + index * 1.7) * Math.min(20, h * .025) * zoom;
      }
      const [sx,sy,sw,sh] = regions[index];
      const ratio = Math.min(size/sw,size/sh);
      const width = sw * ratio;
      const height = sh * ratio;
      const spread = 1 - zoom;
      if (index > 0 && (this.decorRotation > 0 || spread > 0)) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + spread * 3, 1 + spread * 3);
        ctx.translate(x + size / 2 - cx, y + size / 2 - cy);
        ctx.rotate(this.decorRotation * (index % 2 ? 1 : -1));
        ctx.drawImage(art,sx,sy,sw,sh,-width/2,-height/2,width,height); ctx.restore();
      } else ctx.drawImage(art,sx,sy,sw,sh,x+(size-width)/2,y+(size-height)/2,width,height);
    };
    const restingSize = this.desktopLayout ? this.frameSize : Math.min(w * .74, h * .88);
    const fullSize = Math.hypot(w / .644, h / .48) * 1.02;
    const size = mix(fullSize, restingSize, zoom) * (1 + expansion * .12);
    const frameX = cx - size * .5, frameY = cy - size * .5;
    const rx = size * .322, ry = size * .24;
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.clip();
    const fullVideoScale = Math.max(w / this.video.videoWidth, h / this.video.videoHeight);
    const mirrorVideoScale = Math.max(restingSize * .644 / this.video.videoWidth, restingSize * .48 / this.video.videoHeight);
    this.drawVideo(ctx, mix(fullVideoScale, mirrorVideoScale, zoom) * (1 + expansion * .12),cx,cy);
    ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(94,71,80,.16)'; ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3; tile(0, frameX, frameY, size); ctx.restore();
    if (this.desktopLayout) {
      const s = this.sceneScale;
      tile(1,cx-650*s,cy-300*s,170*s);
      tile(2,cx-490*s,cy-340*s,145*s);
      tile(3,cx+465*s,cy-310*s,180*s);
      tile(4,Math.min(w-180*s-24,cx+585*s),cy-100*s,180*s);
      tile(5,Math.max(24,cx-710*s),cy+65*s,145*s);
      tile(6,cx-650*s,cy+230*s,145*s);
      tile(7,cx-450*s,cy+205*s,195*s);
      tile(8,cx+470*s,cy+165*s,180*s);
      tile(9,cx+300*s,cy+230*s,145*s);
    } else {
      const side = Math.min(w * .17, h * .22, 190);
      const left = Math.max(8, cx - size * .49 - side);
      const right = Math.min(w-side-8, cx + size * .49);
      tile(1,left,h*.19,side);
      tile(2,cx-size*.58,h*.12,side*.8);
      tile(3,right,h*.16,side);
      tile(4,right,h*.39,side);
      tile(5,left,h*.58,side*.8);
      tile(6,cx-size*.53,h*.77,side*.8);
      tile(7,cx-size*.32,h*.76,side*1.25);
      tile(8,right,h*.66,side);
      tile(9,cx+size*.32,h*.80,side*.8);
    }
    ctx.restore();
  }

  captureWish() {
    const snapshot = document.createElement('canvas');
    snapshot.width = 900; snapshot.height = 800;
    const ctx = snapshot.getContext('2d');
    ctx.save(); ctx.beginPath(); ctx.ellipse(450, 400, 900 * .322, 900 * .24, 0, 0, Math.PI * 2); ctx.clip();
    this.drawVideo(ctx, Math.max(900 * .644 / this.video.videoWidth, 900 * .48 / this.video.videoHeight), 450, 400);
    ctx.restore();
    ctx.drawImage(this.decorParts, 0, 40, 365, 325, 0, 0, 900, 800);
    return snapshot.toDataURL('image/png');
  }

  drawFilm(radius, zoom, opacity, nickname, gate) {
    const { filmCtx: ctx, width: w, height: h, cx, cy } = this;
    ctx.clearRect(0, 0, w, h);
    if (!gate) {
      const scale = radius / this.initialRadius;
      const gift = '这份答案送给';
      const giftSize = Math.min(48, w * .057) * scale;
      ctx.font = `400 ${giftSize}px ${serif}`;
      const textX = mix(this.desktopLayout ? w * .66 : cx, cx, zoom);
      const textY = mix(this.desktopLayout ? h * .72 : cy, cy, zoom);
      const giftY = textY - Math.min(116, h * .16) * scale;
      const glyph = this.nameGlyph(nickname || '你的名字', this.nicknameSize(nickname, zoom));
      ctx.save();
      const revealWidth = Math.min(1000, w * .94);
      ctx.beginPath(); ctx.rect(textX - revealWidth / 2, 0, revealWidth * this.introProgress, h); ctx.clip();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(255,255,255,.5)'; ctx.shadowBlur = 4 + this.introPulse * 2;
      ctx.fillText(gift, textX, giftY);
      ctx.drawImage(glyph, textX - glyph.width / 2, textY - glyph.height / 2);

      ctx.restore();
    }
    this.ctx.save(); this.ctx.globalAlpha = opacity;
    this.ctx.beginPath(); this.ctx.arc(cx, cy, radius, 0, Math.PI * 2); this.ctx.clip();
    this.ctx.drawImage(this.film, 0, 0); this.ctx.restore();
  }

  nameGlyph(text, size) {
    const key = `${text}:${Math.round(size)}`;
    if (this.nameGlyphKey === key) return this.nameGlyphCanvas;
    const mask = document.createElement('canvas');
    const m = mask.getContext('2d');
    m.font = `italic 600 ${size}px ${nameFont}`;
    mask.width = Math.ceil(m.measureText(text).width + size * .5);
    mask.height = Math.ceil(size * 1.65);
    m.font = `italic 600 ${size}px ${nameFont}`;
    m.fillStyle = '#fff'; m.textAlign = 'center'; m.textBaseline = 'middle';
    m.fillText(text, mask.width / 2, mask.height / 2);
    const pixels = m.getImageData(0, 0, mask.width, mask.height).data;
    const dots = document.createElement('canvas'); dots.width = mask.width; dots.height = mask.height;
    const d = dots.getContext('2d'); d.fillStyle = '#fff';
    const step = Math.max(2, Math.round(size / 22)), dot = Math.max(1, step * .66);
    for (let y = 0; y < mask.height; y += step) for (let x = 0; x < mask.width; x += step) {
      if (pixels[(y * mask.width + x) * 4 + 3] > 80) d.fillRect(x, y, dot, dot);
    }
    this.nameGlyphKey = key; this.nameGlyphCanvas = dots;
    return dots;
  }

  drawGlass(radius, opacity, glow) {
    const { ctx, cx, cy } = this;
    ctx.save(); ctx.globalAlpha = opacity;
    if (glow > 0) {
      const halo = ctx.createRadialGradient(cx, cy, radius * .88, cx, cy, radius * 1.16);
      halo.addColorStop(0, 'rgba(255,255,255,0)');
      halo.addColorStop(.45, `rgba(255,255,255,${glow * this.lightPulse * .16})`);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(cx - radius * 1.2, cy - radius * 1.2, radius * 2.4, radius * 2.4);
    }
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
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = radius * 0.07 * this.lightPulse;
      arc(0, Math.PI * 2, `rgba(255, 255, 255, ${glow * this.lightPulse * 0.5 + this.charge * 0.28})`, 1.7);
    }
    ctx.restore();
  }

  drawWings(radius, opacity, glow) {
    if (!this.wingArtwork) return;
    const { ctx, cx, cy } = this;
    const gap = Math.max(24, radius * .18);
    const wingWidth = Math.min(radius * .9, this.width / 2 - radius - gap - 18);
    if (wingWidth < 18) return;
    const wingHeight = wingWidth * 237 / 324;
    const image = this.wingArtwork, sx = image.width / 1066, sy = image.height / 310;
    ctx.save(); ctx.globalAlpha = opacity * (.86 + glow * this.lightPulse * .14);
    ctx.shadowColor = '#fff'; ctx.shadowBlur = glow * this.lightPulse * 4;
    // Preserve the reference's asymmetric dot clusters and curled feather contours.
    ctx.drawImage(image, 10 * sx, 58 * sy, 324 * sx, 237 * sy,
      cx - radius - gap - wingWidth, cy - wingHeight / 2, wingWidth, wingHeight);
    ctx.drawImage(image, 746 * sx, 60 * sy, 314 * sx, 237 * sy,
      cx + radius + gap, cy - wingHeight / 2, wingWidth, wingHeight);
    ctx.restore();
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

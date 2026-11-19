// Vice City Cover Studio — cover renderer (round 2).
// Every visual here is drawn in code: gradient skies, a striped retro sun,
// palm silhouettes, panel frames and the lettering. No Rockstar logo, artwork
// or font is used anywhere in this app — the look is original, in the genre.
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#2b1055', '#7597de'],
    skyMid: '#ff7e5f',
    skyLow: '#feb47b',
    sun: '#ffd319',
    sunCore: '#fff3b0',
    tint: 'rgba(255, 94, 98, 0.18)',
    tintLow: 'rgba(255, 150, 60, 0.30)',
    title: '#ffffff',
    titleGlow: '#ff2e88',
    tagBg: '#12081f',
    tagText: '#ffd319',
    panelBg: '#3a1c5e',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#0b0620', '#1b0f3a'],
    skyMid: '#7b2ff7',
    skyLow: '#00e5ff',
    sun: '#ff2ea6',
    sunCore: '#ffd7f2',
    tint: 'rgba(123, 47, 247, 0.22)',
    tintLow: 'rgba(0, 229, 255, 0.22)',
    title: '#ffffff',
    titleGlow: '#00e5ff',
    tagBg: '#05030d',
    tagText: '#00e5ff',
    panelBg: '#160a33',
  },
  pastel: {
    label: 'Pastel Vice',
    sky: ['#a8edea', '#fed6e3'],
    skyMid: '#fbc2eb',
    skyLow: '#ff9a9e',
    sun: '#ffcf5c',
    sunCore: '#fff8d6',
    tint: 'rgba(255, 154, 158, 0.14)',
    tintLow: 'rgba(168, 237, 234, 0.20)',
    title: '#ffffff',
    titleGlow: '#ff5e8a',
    tagBg: '#2e1a47',
    tagText: '#ffe9a8',
    panelBg: '#c9a7eb',
  },
  midnight: {
    label: 'Midnight Drive',
    sky: ['#030014', '#0d1b4c'],
    skyMid: '#3d2b8f',
    skyLow: '#ff6b9d',
    sun: '#22d3ee',
    sunCore: '#cffafe',
    tint: 'rgba(34, 211, 238, 0.16)',
    tintLow: 'rgba(255, 107, 157, 0.26)',
    title: '#ffffff',
    titleGlow: '#22d3ee',
    tagBg: '#030014',
    tagText: '#67e8f9',
    panelBg: '#0a1030',
  },
};

export const LAYOUTS = {
  solo: { label: 'Solo', panels: 1 },
  duo: { label: 'Duo', panels: 2 },
  trio: { label: 'Trio', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
};

export const SIZES = [
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

/** Panel rectangles for a layout: white poster frame, thin gutters. */
export function layoutPanels(layout, w, h) {
  const gap = Math.max(6, Math.round(w * 0.008));
  const frame = Math.max(10, Math.round(w * 0.014));
  const x0 = frame;
  const y0 = frame;
  const cw = w - frame * 2;
  const ch = h - frame * 2;
  const centre = (a, b) => a + (b - a) / 2;
  if (layout === 'duo') {
    const mx = centre(x0, x0 + cw);
    return [
      { x: x0, y: y0, w: mx - x0 - gap / 2, h: ch },
      { x: mx + gap / 2, y: y0, w: x0 + cw - (mx + gap / 2), h: ch },
    ];
  }
  if (layout === 'trio') {
    const split = x0 + cw * 0.58;
    const midY = y0 + ch / 2;
    return [
      { x: x0, y: y0, w: split - x0 - gap / 2, h: ch },
      { x: split + gap / 2, y: y0, w: x0 + cw - (split + gap / 2), h: midY - y0 - gap / 2 },
      { x: split + gap / 2, y: midY + gap / 2, w: x0 + cw - (split + gap / 2), h: y0 + ch - (midY + gap / 2) },
    ];
  }
  if (layout === 'quad') {
    const mx = centre(x0, x0 + cw);
    const my = centre(y0, y0 + ch);
    return [
      { x: x0, y: y0, w: mx - x0 - gap / 2, h: my - y0 - gap / 2 },
      { x: mx + gap / 2, y: y0, w: x0 + cw - (mx + gap / 2), h: my - y0 - gap / 2 },
      { x: x0, y: my + gap / 2, w: mx - x0 - gap / 2, h: y0 + ch - (my + gap / 2) },
      { x: mx + gap / 2, y: my + gap / 2, w: x0 + cw - (mx + gap / 2), h: y0 + ch - (my + gap / 2) },
    ];
  }
  return [{ x: x0, y: y0, w: cw, h: ch }];
}

/** One palm silhouette: a leaning trunk and seven drooping fronds. */
export function drawPalm(ctx, x, y, s, color, lean) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.25, y - s * 0.55, x + lean * s * 0.12, y - s);
  ctx.stroke();
  const topX = x + lean * s * 0.12;
  const topY = y - s;
  for (let i = 0; i < 7; i++) {
    const angle = (-0.15 - i * 0.28) * Math.PI + (lean > 0 ? 0.15 : -0.15);
    const len = s * (0.42 - Math.abs(i - 3) * 0.035);
    const endX = topX + Math.cos(angle) * len;
    const endY = topY + Math.sin(angle) * len * 0.55 + s * 0.10;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (endX - topX) * 0.5, topY + (endY - topY) * 0.4 - s * 0.08, endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

/** The grade sky: gradient, striped retro sun, horizon glow, palms. */
export function drawSky(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.45, grade.skyMid);
  sky.addColorStop(0.75, grade.skyLow);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const sunR = Math.min(w, h) * 0.16;
  const sunX = x + w * 0.68;
  const sunY = y + h * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.6);
  glow.addColorStop(0, grade.sunCore + 'cc');
  glow.addColorStop(0.35, grade.sun + '55');
  glow.addColorStop(1, grade.sun + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // striped retro sun: disc clipped, then sky-coloured slats cut across it
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = grade.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grade.skyMid;
  let stripeY = sunY + sunR * 0.05;
  let stripeH = Math.max(2, sunR * 0.05);
  while (stripeY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, stripeY, sunR * 2, stripeH);
    stripeY += stripeH * 2.4;
    stripeH *= 1.35;
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(20, 8, 40, 0.35)';
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
  drawPalm(ctx, x + w * 0.10, y + h * 0.99, h * 0.34, 'rgba(15, 5, 30, 0.9)', -1);
  drawPalm(ctx, x + w * 0.92, y + h * 0.99, h * 0.28, 'rgba(15, 5, 30, 0.85)', 1);
}

/** One photo drawn into a panel rect, with cover/fit, zoom and pan. */
export function drawPhotoPanel(ctx, img, rect, transform) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const fit = transform.fit || 'fill';
  const zoom = transform.zoom || 1;
  const scale = fit === 'fit'
    ? Math.min(w / img.naturalWidth, h / img.naturalHeight) * zoom
    : Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const ox = transform.ox || 0;
  const oy = transform.oy || 0;
  ctx.drawImage(img, x + (w - pw) / 2 + ox * w, y + (h - ph) / 2 + oy * h, pw, ph);
  ctx.restore();
}

/** Shrinks a bold one-line title until it fits maxWidth; returns the size. */
export function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  const font = (s) => `900 ${s}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
  ctx.font = font(size);
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** The title + tagline block over the bottom of the cover. */
export function drawTitleBlock(ctx, w, h, grade, title, tagline) {
  const text = (title || 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const bandH = h * 0.16;
  const bandY = h - bandH - h * 0.02;
  const band = ctx.createLinearGradient(0, bandY - h * 0.03, 0, h);
  band.addColorStop(0, 'rgba(10, 4, 24, 0)');
  band.addColorStop(0.35, 'rgba(10, 4, 24, 0.72)');
  band.addColorStop(1, 'rgba(10, 4, 24, 0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - h * 0.03, w, h - bandY + h * 0.03);
  const maxW = w * 0.92;
  const size = fitTitleFont(ctx, text, maxW, Math.round(h * 0.115));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = w / 2;
  const ty = h - h * 0.075;
  ctx.lineJoin = 'round';
  ctx.shadowColor = grade.titleGlow;
  ctx.shadowBlur = size * 0.45;
  ctx.strokeStyle = 'rgba(10, 4, 24, 0.9)';
  ctx.lineWidth = Math.max(3, size * 0.10);
  ctx.strokeText(text, cx, ty);
  ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = grade.title;
  ctx.fillText(text, cx, ty);
  ctx.shadowBlur = 0;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = grade.titleGlow;
  ctx.fillRect(cx - tw / 2, ty + size * 0.10, tw, Math.max(3, h * 0.006));
  const tag = (tagline || '').trim();
  if (tag) {
    const tagSize = Math.max(13, Math.round(h * 0.026));
    ctx.font = `700 ${tagSize}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
    const tagW = Math.min(ctx.measureText(tag.toUpperCase()).width + tagSize * 2.4, w * 0.9);
    const tagH = tagSize * 2.1;
    const tagY = ty + size * 0.16;
    ctx.fillStyle = grade.tagBg;
    ctx.fillRect(cx - tagW / 2, tagY, tagW, tagH);
    ctx.fillStyle = grade.tagText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag.toUpperCase(), cx, tagY + tagH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }
}

/** Vignette, scanlines and deterministic grain over the whole cover. */
export function drawFinish(ctx, w, h, state) {
  if (state.vignette !== false) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.scanlines) {
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);
  }
  if (state.grain) {
    // deterministic pseudo-grain, so two renders of the same state match
    let seed = 1234567;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const dots = Math.floor((w * h) / 9000);
    for (let i = 0; i < dots; i++) ctx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(4, Math.round(w * 0.008));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/**
 * Renders the whole cover into ctx at size w x h from the editor state.
 * state: { photos, panelPhoto, panelZoom, panelOX, panelOY, panelFit,
 *          layout, grade, title, tagline, vignette, grain, scanlines }
 */
export function drawCoverArt(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = state.layout || 'solo';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const panels = layoutPanels(layout, w, h);
  panels.forEach((rect, i) => {
    const photoIndex = (state.panelPhoto && state.panelPhoto[i]) ?? Math.min(i, (state.photos || []).length - 1);
    const photo = (state.photos || [])[photoIndex] || null;
    const transform = {
      zoom: (state.panelZoom && state.panelZoom[i]) || 1,
      ox: (state.panelOX && state.panelOX[i]) || 0,
      oy: (state.panelOY && state.panelOY[i]) || 0,
      fit: (state.panelFit && state.panelFit[i]) || 'fill',
    };
    if (photo && photo.img) drawPhotoPanel(ctx, photo.img, rect, transform);
    else drawSky(ctx, rect, grade);
    const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    wash.addColorStop(0, grade.tint);
    wash.addColorStop(1, grade.tintLow);
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, Math.round(w * 0.006));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  drawTitleBlock(ctx, w, h, grade, state.title, state.tagline);
  drawFinish(ctx, w, h, state);
}

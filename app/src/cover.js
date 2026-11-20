// Vice City Cover Studio — cover renderer, round 2c rewrite.
// The look is drawn entirely in code: gradient skies, a striped retro
// sun, palm silhouettes, panel frames and lettering. Nothing here is
// Rockstar artwork, a Rockstar logo or a Rockstar font — the style is
// original, in the genre of a neon beach-city poster.
//
// Architecture (2c, kept from 2b and extended): a small render pipeline.
// drawCoverArt() runs four stages in order and nothing else draws:
//   1. planLayout()   — a layout name + canvas size into panel rects
//   2. paintPanels()  — one panel at a time: photo (with its filter) or
//                       the fallback sky art, then grade wash + frame
//   3. paintCaption() — title + tagline band across the bottom, with
//                       the caption size / letter-spacing controls
//   4. paintFinish()  — vignette / scanlines / grain / outer border
// Each stage is a plain function that takes what it needs and returns
// nothing; shared drawing helpers (sun, palm, text fitting) sit below.
//
// New in 2c: a sixth layout, Banner, and caption typography controls.
// Banner is a wide cinematic band: one hero panel across the top
// (about 2.5:1 on the 1920x1080 export) over a bottom row split into
// two panels. The caption now has two knobs in state — titleSize (a
// 0.7–1.3 multiplier on the fitted title size) and titleTracking
// (letter-spacing in px, -2 to +12) — both honoured by the renderer
// and by the exported PNG, not just the preview.

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    skyTop: '#2b1055', skyMid: '#ff7e5f', skyLow: '#feb47b', skyBottom: '#7597de',
    sun: '#ffd319', sunCore: '#fff3b0',
    washTop: 'rgba(255, 94, 98, 0.18)', washBottom: 'rgba(255, 150, 60, 0.30)',
    title: '#ffffff', titleGlow: '#ff2e88',
    tagBg: '#12081f', tagText: '#ffd319', panelBg: '#3a1c5e',
  },
  neon: {
    label: 'Neon Night',
    skyTop: '#0b0620', skyMid: '#7b2ff7', skyLow: '#00e5ff', skyBottom: '#1b0f3a',
    sun: '#ff2ea6', sunCore: '#ffd7f2',
    washTop: 'rgba(123, 47, 247, 0.22)', washBottom: 'rgba(0, 229, 255, 0.22)',
    title: '#ffffff', titleGlow: '#00e5ff',
    tagBg: '#05030d', tagText: '#00e5ff', panelBg: '#160a33',
  },
  pastel: {
    label: 'Pastel Vice',
    skyTop: '#a8edea', skyMid: '#fbc2eb', skyLow: '#ff9a9e', skyBottom: '#fed6e3',
    sun: '#ffcf5c', sunCore: '#fff8d6',
    washTop: 'rgba(255, 154, 158, 0.14)', washBottom: 'rgba(168, 237, 234, 0.20)',
    title: '#ffffff', titleGlow: '#ff5e8a',
    tagBg: '#2e1a47', tagText: '#ffe9a8', panelBg: '#c9a7eb',
  },
  midnight: {
    label: 'Midnight Drive',
    skyTop: '#030014', skyMid: '#3d2b8f', skyLow: '#ff6b9d', skyBottom: '#0d1b4c',
    sun: '#22d3ee', sunCore: '#cffafe',
    washTop: 'rgba(34, 211, 238, 0.16)', washBottom: 'rgba(255, 107, 157, 0.26)',
    title: '#ffffff', titleGlow: '#22d3ee',
    tagBg: '#030014', tagText: '#67e8f9', panelBg: '#0a1030',
  },
};

// One photo treatment per panel. The value is a canvas `ctx.filter`
// string; 'none' means no filter at all. Names are the user-facing labels.
export const FILTERS = {
  none: { label: 'None', css: 'none' },
  grayscale: { label: 'Grayscale', css: 'grayscale(1)' },
  sepia: { label: 'Sepia', css: 'sepia(0.85)' },
  // Retuned in 2b: contrast(1.45) barely moved the pixels (panel sum
  // changed ~0.4% vs none, against ~2.3% for sepia), so the high-
  // contrast treatment is stronger and lifts brightness slightly so
  // shadows do not crush to black.
  contrast: { label: 'High contrast', css: 'contrast(1.65) saturate(1.45) brightness(1.05)' },
};

/** Canvas filter string for a filter id; unknown ids fall back to none. */
export function filterCss(id) {
  return (FILTERS[id] || FILTERS.none).css;
}

export const LAYOUTS = {
  solo: { label: 'Solo', panels: 1 },
  duo: { label: 'Duo', panels: 2 },
  trio: { label: 'Trio', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
  strip: { label: 'Strip', panels: 3 },
  banner: { label: 'Banner', panels: 3 },
};

export const SIZES = [
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

// ---------------------------------------------------------------- caption knobs

/** Caption typography defaults and hard limits (shared by cover + editor). */
export const CAPTION = {
  titleSizeMin: 0.7,
  titleSizeMax: 1.3,
  titleSizeDefault: 1,
  titleTrackingMin: -2,
  titleTrackingMax: 12,
  titleTrackingDefault: 0,
};

/** Clamp a title-size multiplier into the slider range. */
export function clampTitleSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return CAPTION.titleSizeDefault;
  return Math.min(CAPTION.titleSizeMax, Math.max(CAPTION.titleSizeMin, n));
}

/** Clamp letter-spacing (px) into the slider range; whole pixels only. */
export function clampTitleTracking(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return CAPTION.titleTrackingDefault;
  return Math.min(CAPTION.titleTrackingMax, Math.max(CAPTION.titleTrackingMin, Math.round(n)));
}

// ---------------------------------------------------------------- layout

function frameMetrics(w) {
  return {
    gap: Math.max(6, Math.round(w * 0.008)),
    frame: Math.max(10, Math.round(w * 0.014)),
  };
}

function splitVertical(x, y, totalW, totalH, gap) {
  const mid = x + totalW / 2;
  return [
    { x, y, w: mid - x - gap / 2, h: totalH },
    { x: mid + gap / 2, y, w: x + totalW - (mid + gap / 2), h: totalH },
  ];
}

function splitHorizontal(x, y, totalW, totalH, gap, fractions) {
  // Whole-pixel bands only: fractional heights left hairline seams where
  // the white frame showed through between bands in the first render.
  // Each band (except the last) takes its rounded share minus half the
  // gutter; the last band takes whatever height is left, so the stack
  // always ends exactly on the frame edge.
  const rects = [];
  let cursor = y;
  fractions.forEach((frac, i) => {
    const last = i === fractions.length - 1;
    const bandH = last ? y + totalH - cursor : Math.round(totalH * frac);
    const h = last ? bandH : Math.round(bandH - gap / 2);
    rects.push({ x, y: Math.round(cursor), w: totalW, h });
    cursor += bandH + gap / 2;
  });
  return rects;
}

/**
 * Banner geometry: a wide hero band across the top (72% of the inner
 * height, so on the 1920x1080 export it is roughly a 2.5:1 cinematic
 * band) and a bottom row split vertically into two panels.
 *
 * Whole-pixel rects only, by construction: the first version reused
 * splitVertical for the bottom row, which splits on gap / 2 — with an
 * odd gap (15 px at 1920 wide) that put every Banner rect on a .5 px
 * boundary (hero h 731.5, bottom x 967.5). The first headless run
 * caught it (banner whole-pixel check failed, 77/78). So Banner does
 * its own integer split here — floor/ceil around the gutter — and
 * splitVertical is left exactly as the older layouts use it, so their
 * geometry (and screenshots 1/3/4) does not move.
 */
function splitBanner(x, y, totalW, totalH, gap) {
  const heroH = Math.round(totalH * 0.72);
  const hero = { x, y, w: totalW, h: heroH - Math.floor(gap / 2) };
  const bottomY = y + heroH + Math.ceil(gap / 2);
  const bottomH = y + totalH - bottomY;
  const leftW = Math.floor((totalW - gap) / 2);
  return [
    hero,
    { x, y: bottomY, w: leftW, h: bottomH },
    { x: x + leftW + gap, y: bottomY, w: totalW - leftW - gap, h: bottomH },
  ];
}

/**
 * Stage 1 — panel rectangles for a layout. The poster keeps a white
 * outer frame and thin gutters between panels.
 *   solo   — one full-bleed panel
 *   duo    — two side-by-side panels
 *   trio   — hero panel left, two stacked panels right
 *   quad   — 2 x 2 grid
 *   strip  — three horizontal bands (hero band on top, two thinner bands)
 *   banner — wide hero band on top, two panels side by side below
 */
export function layoutPanels(layout, w, h) {
  const { gap, frame } = frameMetrics(w);
  const x0 = frame;
  const y0 = frame;
  const cw = w - frame * 2;
  const ch = h - frame * 2;
  if (layout === 'duo') return splitVertical(x0, y0, cw, ch, gap);
  if (layout === 'strip') return splitHorizontal(x0, y0, cw, ch, gap, [0.44, 0.30, 0.26]);
  if (layout === 'banner') return splitBanner(x0, y0, cw, ch, gap);
  if (layout === 'trio') {
    const splitX = x0 + cw * 0.58;
    const midY = y0 + ch / 2;
    const rightW = x0 + cw - (splitX + gap / 2);
    return [
      { x: x0, y: y0, w: splitX - x0 - gap / 2, h: ch },
      { x: splitX + gap / 2, y: y0, w: rightW, h: midY - y0 - gap / 2 },
      { x: splitX + gap / 2, y: midY + gap / 2, w: rightW, h: y0 + ch - (midY + gap / 2) },
    ];
  }
  if (layout === 'quad') {
    const top = splitVertical(x0, y0, cw, (ch - gap) / 2, gap);
    const bottom = splitVertical(x0, y0 + (ch + gap) / 2, cw, (ch - gap) / 2, gap);
    return [...top, ...bottom];
  }
  return [{ x: x0, y: y0, w: cw, h: ch }];
}

// Backwards-compatible alias: older callers used planLayout's old name.
export const planLayout = layoutPanels;

// ---------------------------------------------------------------- sky art

function paintSun(ctx, rect, grade) {
  const radius = Math.min(rect.w, rect.h) * 0.16;
  const cx = rect.x + rect.w * 0.68;
  const cy = rect.y + rect.h * 0.42;
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.6);
  halo.addColorStop(0, `${grade.sunCore}cc`);
  halo.addColorStop(0.35, `${grade.sun}55`);
  halo.addColorStop(1, `${grade.sun}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Striped disc: paint the disc, then cut sky-coloured slats across
  // its lower half so it reads as a retro setting sun.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sun;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.fillStyle = grade.sunCore;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grade.skyMid;
  let sy = cy + radius * 0.05;
  let sh = Math.max(2, radius * 0.05);
  while (sy < cy + radius) {
    ctx.fillRect(cx - radius, sy, radius * 2, sh);
    sy += sh * 2.4;
    sh *= 1.35;
  }
  ctx.restore();
}

function paintPalm(ctx, baseX, baseY, size, color, lean) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(
    baseX + lean * size * 0.25, baseY - size * 0.55,
    baseX + lean * size * 0.12, baseY - size,
  );
  ctx.stroke();
  const crownX = baseX + lean * size * 0.12;
  const crownY = baseY - size;
  for (let i = 0; i < 7; i++) {
    const angle = (-0.15 - i * 0.28) * Math.PI + (lean > 0 ? 0.15 : -0.15);
    const len = size * (0.42 - Math.abs(i - 3) * 0.035);
    const endX = crownX + Math.cos(angle) * len;
    const endY = crownY + Math.sin(angle) * len * 0.55 + size * 0.10;
    ctx.lineWidth = Math.max(1.5, size * 0.02);
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + (endX - crownX) * 0.5,
      crownY + (endY - crownY) * 0.4 - size * 0.08,
      endX, endY,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** The fallback art for a panel with no photo: grade sky + sun + palms. */
export function drawSky(ctx, rect, grade) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.45, grade.skyMid);
  sky.addColorStop(0.75, grade.skyLow);
  sky.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  paintSun(ctx, rect, grade);
  ctx.fillStyle = 'rgba(20, 8, 40, 0.35)';
  ctx.fillRect(rect.x, rect.y + rect.h * 0.78, rect.w, rect.h * 0.22);
  paintPalm(ctx, rect.x + rect.w * 0.10, rect.y + rect.h * 0.99, rect.h * 0.34, 'rgba(15, 5, 30, 0.9)', -1);
  paintPalm(ctx, rect.x + rect.w * 0.92, rect.y + rect.h * 0.99, rect.h * 0.28, 'rgba(15, 5, 30, 0.85)', 1);
}

// Kept for callers that used the old helper name.
export const drawPalm = paintPalm;

// ---------------------------------------------------------------- photos

/**
 * Draw one photo into a panel rect. `transform` is { zoom, ox, oy, fit }
 * (fit = 'fill' crops to cover the panel, 'fit' letterboxes inside it)
 * and `filterId` is one of FILTERS — applied through ctx.filter so the
 * export PNG carries the same treatment as the preview.
 */
export function drawPhotoPanel(ctx, img, rect, transform, filterId) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const zoom = transform.zoom || 1;
  const base = transform.fit === 'fit'
    ? Math.min(rect.w / img.naturalWidth, rect.h / img.naturalHeight)
    : Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const filter = filterCss(filterId);
  if (filter !== 'none') ctx.filter = filter;
  ctx.drawImage(
    img,
    rect.x + (rect.w - pw) / 2 + (transform.ox || 0) * rect.w,
    rect.y + (rect.h - ph) / 2 + (transform.oy || 0) * rect.h,
    pw, ph,
  );
  ctx.restore();
}

// ---------------------------------------------------------------- caption

/**
 * Shrink a bold one-line title until it fits maxWidth; returns the size.
 * `tracking` is the letter-spacing in px (ctx.letterSpacing): it is set
 * on the context before measuring, because Chrome counts the spacing in
 * measureText, so a widely-tracked title still shrinks instead of
 * overflowing the frame. `startSize` is already multiplied by the
 * titleSize knob by the caller.
 */
export function fitTitleFont(ctx, text, maxWidth, startSize, tracking = 0) {
  const fontFor = (s) => `900 ${s}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
  let size = startSize;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  ctx.font = fontFor(size);
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = fontFor(size);
  }
  return size;
}

/**
 * Stage 3 — the title + tagline block over the bottom of the cover.
 * `opts` carries the 2c caption knobs: { titleSize, titleTracking }.
 * titleSize multiplies the fitted base size (0.7–1.3); titleTracking
 * sets ctx.letterSpacing for the title only (the tagline keeps tight
 * spacing). Letter-spacing is reset to 0px before returning so no
 * later drawing inherits it.
 */
export function drawTitleBlock(ctx, w, h, grade, title, tagline, opts = {}) {
  const text = (title || 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const titleSize = clampTitleSize(opts.titleSize ?? CAPTION.titleSizeDefault);
  const tracking = clampTitleTracking(opts.titleTracking ?? CAPTION.titleTrackingDefault);
  const bandH = h * 0.16;
  const bandY = h - bandH - h * 0.02;
  const shade = ctx.createLinearGradient(0, bandY - h * 0.03, 0, h);
  shade.addColorStop(0, 'rgba(10, 4, 24, 0)');
  shade.addColorStop(0.35, 'rgba(10, 4, 24, 0.72)');
  shade.addColorStop(1, 'rgba(10, 4, 24, 0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, bandY - h * 0.03, w, h - bandY + h * 0.03);
  const baseSize = Math.round(h * 0.115);
  const size = fitTitleFont(ctx, text, w * 0.92, Math.round(baseSize * titleSize), tracking);
  const cx = w / 2;
  const ty = h - h * 0.075;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
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
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const titleW = ctx.measureText(text).width;
  ctx.fillStyle = grade.titleGlow;
  ctx.fillRect(cx - titleW / 2, ty + size * 0.10, titleW, Math.max(3, h * 0.006));
  const tag = (tagline || '').trim();
  if (!tag) return;
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

/** Stage 3 as a pipeline step: caption knobs read from state. */
export function paintCaption(ctx, w, h, grade, state) {
  drawTitleBlock(ctx, w, h, grade, state.title, state.tagline, {
    titleSize: state.titleSize,
    titleTracking: state.titleTracking,
  });
}

// ---------------------------------------------------------------- finish

/** Stage 4 — vignette, scanlines, deterministic grain, outer border. */
export function drawFinish(ctx, w, h, state) {
  if (state.vignette !== false) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
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
    // Seeded pseudo-grain, so two renders of the same state match exactly.
    let seed = 1234567;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const dots = Math.floor((w * h) / 9000);
    for (let i = 0; i < dots; i++) ctx.fillRect(next() * w, next() * h, 1.6, 1.6);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(4, Math.round(w * 0.008));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

// ---------------------------------------------------------------- pipeline

function panelPhotoFor(state, index, panelCount) {
  const photos = state.photos || [];
  if (photos.length === 0) return null;
  const picked = state.panelPhoto ? state.panelPhoto[index] : undefined;
  const safe = Number.isInteger(picked) ? Math.min(Math.max(picked, 0), photos.length - 1) : Math.min(index, photos.length - 1);
  return photos[safe] || null;
}

function panelTransformFor(state, index) {
  return {
    zoom: (state.panelZoom && state.panelZoom[index]) || 1,
    ox: (state.panelOX && state.panelOX[index]) || 0,
    oy: (state.panelOY && state.panelOY[index]) || 0,
    fit: (state.panelFit && state.panelFit[index]) || 'fill',
  };
}

/** Stage 2 — paint every panel, then wash + frame each one. */
export function paintPanels(ctx, panels, grade, state) {
  panels.forEach((rect, i) => {
    const photo = panelPhotoFor(state, i, panels.length);
    if (photo && photo.img) {
      drawPhotoPanel(ctx, photo.img, rect, panelTransformFor(state, i), (state.panelFilter && state.panelFilter[i]) || 'none');
    } else {
      ctx.fillStyle = grade.panelBg;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      drawSky(ctx, rect, grade);
    }
    const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    wash.addColorStop(0, grade.washTop);
    wash.addColorStop(1, grade.washBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, Math.round(ctx.canvas.width * 0.006));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
}

/**
 * The pipeline entry point. Renders the whole cover into ctx at w x h.
 * state: { photos, panelPhoto, panelZoom, panelOX, panelOY, panelFit,
 *          panelFilter, layout, grade, title, tagline, titleSize,
 *          titleTracking, vignette, grain, scanlines }
 */
export function drawCoverArt(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const panels = planLayout(state.layout || 'solo', w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  paintPanels(ctx, panels, grade, state);
  paintCaption(ctx, w, h, grade, state);
  drawFinish(ctx, w, h, state);
}

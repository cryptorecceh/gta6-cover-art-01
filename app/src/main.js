// Vice City Cover Studio — editor wiring, round 2c rewrite.
// Pick photos (picker, drag-drop or the bundled samples), choose a
// multi-panel layout and a colour grade, give each panel its own photo
// treatment, crop and position each panel by dragging on the preview,
// tune the caption's size and letter-spacing, edit the caption live,
// export a PNG. Photos are read with FileReader / object URLs on this
// machine only; nothing is uploaded.
//
// Architecture (kept from 2b, extended in 2c): one `state` object owns
// everything, and every change goes through the same two steps —
//   applyState(patch)  — merge a patch into state, then render()
//   render()           — resize the preview canvas, draw the cover,
//                       then sync every control back from state
// Event handlers never draw directly and never keep their own copy of
// a value; they only call applyState(). That keeps the preview, the
// controls and the exported PNG in agreement by construction.
//
// New in 2c: caption size + tracking sliders wired into state, the
// sixth layout Banner, and keyboard shortcuts — keys 1–6 pick a layout
// in order, G cycles the colour grade, E exports the current size.
// Shortcuts are ignored while the user is typing in a text field or
// a select, so typing a caption never triggers a layout switch.

import { CAPTION, FILTERS, GRADES, LAYOUTS, SIZES, clampTitleSize, clampTitleTracking, drawCoverArt, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

// ---- element handles (queried once, up front) ----
const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const titleInput = $('title');
const taglineInput = $('tagline');
const titleSizeInput = $('titleSize');
const titleSizeLabel = $('titleSizeLabel');
const titleTrackingInput = $('titleTracking');
const titleTrackingLabel = $('titleTrackingLabel');
const zoomInput = $('zoom');
const zoomLabel = $('zoomLabel');
const activePanelEl = $('activePanel');
const photoInput = $('photo');

// Layouts in shortcut order: keys 1-6 map to this list, in order.
export const LAYOUT_ORDER = ['solo', 'duo', 'trio', 'quad', 'strip', 'banner'];
export const GRADE_ORDER = ['sunset', 'neon', 'pastel', 'midnight'];

// ---- the single source of truth ----
export const state = {
  photos: [], // { img, name }
  panelPhoto: [0, 0, 0, 0],
  panelZoom: [1, 1, 1, 1],
  panelOX: [0, 0, 0, 0],
  panelOY: [0, 0, 0, 0],
  panelFit: ['fill', 'fill', 'fill', 'fill'],
  panelFilter: ['none', 'none', 'none', 'none'],
  layout: 'trio',
  grade: 'sunset',
  title: 'Vice City Nights',
  tagline: 'Welcome back to Vice City',
  titleSize: CAPTION.titleSizeDefault,
  titleTracking: CAPTION.titleTrackingDefault,
  size: '1080x1080',
  vignette: true,
  grain: false,
  scanlines: false,
};
let selectedPanel = 0;
let drag = null;

export function currentSize() {
  return SIZES.find((s) => s.id === state.size) || SIZES[0];
}

/** Merge a patch into state and re-render. The only way state changes. */
export function applyState(patch) {
  Object.assign(state, patch);
  render();
}

/** Resize the preview canvas to the chosen export size and redraw. */
export function render() {
  const size = currentSize();
  canvas.width = size.w;
  canvas.height = size.h;
  drawCoverArt(canvas.getContext('2d'), canvas.width, canvas.height, state);
  syncControls();
}

// Backwards-compatible names used by the previous round's test hook.
export const redraw = render;
export const resizePreview = () => {
  const size = currentSize();
  canvas.width = size.w;
  canvas.height = size.h;
};

export function setStatus(msg) {
  statusEl.textContent = msg;
}

/** Keep every control showing the current state (called by render()). */
export function syncControls() {
  // Layout / grade / size button groups: exactly one active each.
  const markActive = (attr, value) => {
    document.querySelectorAll(`[${attr}]`).forEach((b) => {
      b.classList.toggle('active', b.dataset[attr.slice(5)] === value);
    });
  };
  markActive('data-layout', state.layout);
  markActive('data-grade', state.grade);
  markActive('data-size', state.size);
  // Per-panel photo + filter selects.
  document.querySelectorAll('[data-panel]').forEach((sel) => {
    const idx = Number(sel.dataset.panel);
    const previous = sel.value;
    sel.innerHTML = '';
    if (state.photos.length === 0) {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'No photo yet — sunset art';
      sel.appendChild(opt);
    } else {
      state.photos.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Photo ${i + 1} — ${p.name}`;
        sel.appendChild(opt);
      });
    }
    sel.value = String(state.panelPhoto[idx] ?? 0);
    if (sel.value === '' && previous !== '') sel.value = previous;
    sel.disabled = state.photos.length === 0;
  });
  document.querySelectorAll('[data-filter]').forEach((sel) => {
    const idx = Number(sel.dataset.filter);
    sel.value = state.panelFilter[idx] || 'none';
  });
  // Caption size + tracking sliders (2c): labels show the live value.
  if (titleSizeInput) {
    titleSizeInput.value = String(clampTitleSize(state.titleSize));
    if (titleSizeLabel) titleSizeLabel.textContent = `${clampTitleSize(state.titleSize).toFixed(2)}x`;
  }
  if (titleTrackingInput) {
    titleTrackingInput.value = String(clampTitleTracking(state.titleTracking));
    if (titleTrackingLabel) titleTrackingLabel.textContent = `${clampTitleTracking(state.titleTracking)} px`;
  }
  // Selected-panel readout + zoom slider.
  const panelCount = (LAYOUTS[state.layout] || LAYOUTS.solo).panels;
  if (activePanelEl) activePanelEl.textContent = `Panel ${selectedPanel + 1} of ${panelCount}`;
  const zoom = state.panelZoom[selectedPanel] || 1;
  zoomInput.value = String(zoom);
  zoomLabel.textContent = `${zoom.toFixed(2)}x`;
  // Fit / Fill buttons show the selected panel's mode.
  const fit = state.panelFit[selectedPanel] || 'fill';
  $('fitBtn')?.classList.toggle('active', fit === 'fit');
  $('fillBtn')?.classList.toggle('active', fit === 'fill');
}

// ---- photos ----

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

function reassignPanelsAfterPhotoChange() {
  const last = Math.max(state.photos.length - 1, 0);
  state.panelPhoto = state.panelPhoto.map((_, i) => Math.min(i, last));
}

export async function addPhotoFile(file) {
  if (!file) return false;
  if (!file.type || !file.type.startsWith('image/')) {
    setStatus('That file is not an image — pick a JPG, PNG or WebP photo.');
    return false;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    state.photos.push({ img, name: file.name });
  } catch {
    setStatus('Could not read that image file. Try another photo.');
    return false;
  }
  if (state.photos.length > 4) state.photos = state.photos.slice(-4);
  reassignPanelsAfterPhotoChange();
  render();
  setStatus(`Loaded ${file.name} — ${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} ready.`);
  return true;
}

export async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos.push({ img, name: `${name}.jpg` });
  if (state.photos.length > 4) state.photos = state.photos.slice(-4);
  reassignPanelsAfterPhotoChange();
  render();
  return true;
}

/**
 * Random layout + grade (+ a random filter per panel) in one click.
 * 2c: the shuffle also rolls the caption knobs — a title size between
 * 0.85x and 1.15x and tracking between 0 and 6 px — so a shuffled look
 * can land on a wider, airier caption as well as a new layout.
 */
export function shuffleLook() {
  const layoutKeys = Object.keys(LAYOUTS);
  const gradeKeys = Object.keys(GRADES);
  const filterKeys = Object.keys(FILTERS);
  const layout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];
  const grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
  const panelFilter = state.panelFilter.map(() => filterKeys[Math.floor(Math.random() * filterKeys.length)]);
  const panelPhoto = state.photos.length > 1
    ? state.panelPhoto.map(() => Math.floor(Math.random() * state.photos.length))
    : state.panelPhoto;
  const titleSize = Math.round((0.85 + Math.random() * 0.3) * 100) / 100;
  const titleTracking = Math.floor(Math.random() * 7);
  applyState({ layout, grade, panelFilter, panelPhoto, titleSize, titleTracking });
  setStatus(`Shuffled: ${LAYOUTS[layout].label} layout, ${GRADES[grade].label} grade.`);
}

/** Advance the grade one step (wraps); used by the G shortcut. */
export function cycleGrade() {
  const next = GRADE_ORDER[(GRADE_ORDER.indexOf(state.grade) + 1) % GRADE_ORDER.length];
  applyState({ grade: next });
  setStatus(`Grade: ${GRADES[next].label}.`);
  return next;
}

// ---- keyboard shortcuts (2c) ----

/**
 * Handle one keydown for the shortcut layer. Returns the action taken
 * ('layout', 'grade', 'export') or null when the key is not a shortcut
 * or the user is typing. Exported so the test driver can call it
 * directly; the live listener below is a thin wrapper around it.
 */
export function handleShortcut(event) {
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return null;
  const key = (event.key || '').toLowerCase();
  if (key >= '1' && key <= String(LAYOUT_ORDER.length)) {
    const layout = LAYOUT_ORDER[Number(key) - 1];
    applyState({ layout });
    setStatus(`Layout: ${LAYOUTS[layout].label}.`);
    return 'layout';
  }
  if (key === 'g') {
    cycleGrade();
    return 'grade';
  }
  if (key === 'e') {
    exportPNG(state.size);
    return 'export';
  }
  return null;
}

// ---- control wiring (one function, called once at boot) ----

function bindControls() {
  photoInput.addEventListener('change', async (e) => {
    for (const file of e.target.files) await addPhotoFile(file);
    photoInput.value = '';
  });
  titleInput.addEventListener('input', () => applyState({ title: titleInput.value }));
  taglineInput.addEventListener('input', () => applyState({ tagline: taglineInput.value }));
  titleSizeInput?.addEventListener('input', () => {
    applyState({ titleSize: clampTitleSize(Number(titleSizeInput.value)) });
  });
  titleTrackingInput?.addEventListener('input', () => {
    applyState({ titleTracking: clampTitleTracking(Number(titleTrackingInput.value)) });
  });
  zoomInput.addEventListener('input', () => {
    const zoom = Number(zoomInput.value);
    const panelZoom = [...state.panelZoom];
    panelZoom[selectedPanel] = zoom;
    applyState({ panelZoom });
  });

  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => applyState({ layout: btn.dataset.layout }));
  });
  document.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', () => applyState({ grade: btn.dataset.grade }));
  });
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => applyState({ size: btn.dataset.size }));
  });
  $('fitBtn').addEventListener('click', () => {
    const panelFit = [...state.panelFit];
    panelFit[selectedPanel] = 'fit';
    applyState({ panelFit });
  });
  $('fillBtn').addEventListener('click', () => {
    const panelFit = [...state.panelFit];
    panelFit[selectedPanel] = 'fill';
    applyState({ panelFit });
  });
  $('resetPan').addEventListener('click', () => {
    const panelOX = [...state.panelOX];
    const panelOY = [...state.panelOY];
    const panelZoom = [...state.panelZoom];
    panelOX[selectedPanel] = 0;
    panelOY[selectedPanel] = 0;
    panelZoom[selectedPanel] = 1;
    applyState({ panelOX, panelOY, panelZoom });
  });
  $('resetCaption')?.addEventListener('click', () => {
    applyState({ titleSize: CAPTION.titleSizeDefault, titleTracking: CAPTION.titleTrackingDefault });
    setStatus('Caption size and spacing reset to defaults.');
  });
  $('shuffleBtn').addEventListener('click', () => shuffleLook());
  $('vignette').addEventListener('change', (e) => applyState({ vignette: e.target.checked }));
  $('grain').addEventListener('change', (e) => applyState({ grain: e.target.checked }));
  $('scanlines').addEventListener('change', (e) => applyState({ scanlines: e.target.checked }));
  $('sampleBoulevard').addEventListener('click', async () => {
    await loadSample('boulevard');
    setStatus('Sample photo loaded: boulevard.');
  });
  $('samplePier').addEventListener('click', async () => {
    await loadSample('pier');
    setStatus('Sample photo loaded: pier.');
  });

  // Per-panel photo + filter selects.
  document.querySelectorAll('[data-panel]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const panelPhoto = [...state.panelPhoto];
      panelPhoto[Number(sel.dataset.panel)] = Number(sel.value);
      applyState({ panelPhoto });
    });
  });
  document.querySelectorAll('[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const panelFilter = [...state.panelFilter];
      panelFilter[Number(sel.dataset.filter)] = sel.value;
      applyState({ panelFilter });
    });
  });

  // Keyboard shortcuts: 1-6 layouts, G grade cycle, E export.
  document.addEventListener('keydown', (e) => handleShortcut(e));

  // Drag on the preview to pan the panel under the pointer (and select it).
  canvas.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e.clientX, e.clientY);
    selectedPanel = hit.index;
    drag = { x: e.clientX, y: e.clientY, ox: state.panelOX[selectedPanel], oy: state.panelOY[selectedPanel] };
    canvas.setPointerCapture(e.pointerId);
    syncControls();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panelOX = [...state.panelOX];
    const panelOY = [...state.panelOY];
    panelOX[selectedPanel] = drag.ox + (e.clientX - drag.x) / rect.width;
    panelOY[selectedPanel] = drag.oy + (e.clientY - drag.y) / rect.height;
    applyState({ panelOX, panelOY });
  });
  canvas.addEventListener('pointerup', () => { drag = null; });

  // Drag-drop photos onto the preview or the whole page.
  const handleDrop = (e) => {
    e.preventDefault();
    [...(e.dataTransfer?.files || [])].forEach((f) => addPhotoFile(f));
  };
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', handleDrop);
  document.body.addEventListener('dragover', (e) => e.preventDefault());
  document.body.addEventListener('drop', handleDrop);

  // Export buttons.
  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => exportPNG(btn.dataset.export));
  });
  $('exportAll').addEventListener('click', () => exportAllSizes());
}

/** Which panel (if any) sits under a pointer position on the canvas. */
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = ((clientX - rect.left) / rect.width) * canvas.width;
  const py = ((clientY - rect.top) / rect.height) * canvas.height;
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < panels.length; i++) {
    const r = panels[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { index: i, px, py };
  }
  return { index: 0, px, py };
}

// ---- export ----

export function renderExport(sizeId) {
  const size = SIZES.find((s) => s.id === sizeId) || currentSize();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCoverArt(off.getContext('2d'), size.w, size.h, state);
  return off;
}

export function exportPNG(sizeId) {
  return new Promise((resolve) => {
    const off = renderExport(sizeId);
    const size = SIZES.find((s) => s.id === sizeId) || currentSize();
    off.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — try again.'); resolve(null); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-cover-${size.id}.png`;
      a.click();
      setStatus(`Saved vice-city-cover-${size.id}.png (${size.w} x ${size.h}). Photos never left this machine.`);
      resolve(blob);
    }, 'image/png');
  });
}

export async function exportAllSizes() {
  for (const size of SIZES) {
    await exportPNG(size.id);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Saved all three sizes: 1080x1080, 1080x1350, 1920x1080.');
}

export function exportBytes(sizeId) {
  return new Promise((resolve) => {
    renderExport(sizeId).toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({ size: blob.size, dataUrl: reader.result });
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// test hook: lets automated checks drive the app without a mouse
window.__vc = {
  state, loadSample, addPhotoFile, exportBytes, exportPNG, exportAllSizes,
  shuffleLook, cycleGrade, handleShortcut, LAYOUT_ORDER, GRADE_ORDER,
  redraw: render, render, applyState, currentSize,
  get selectedPanel() { return selectedPanel; },
};

// ---- boot + shot scenes ----
bindControls();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  await runShot(shot, query, async (scene) => {
    applyState({
      title: scene.title,
      tagline: scene.tagline,
      layout: scene.layout,
      grade: scene.grade,
      size: scene.size.id,
    });
    titleInput.value = scene.title;
    taglineInput.value = scene.tagline;
    for (const name of scene.photos) await loadSample(name);
    // Spread the two samples across panels for a real multi-panel cover.
    applyState({ panelPhoto: [0, 1, 0, 1] });
  });
} else {
  render();
}

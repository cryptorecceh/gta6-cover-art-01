// Vice City Cover Studio — editor wiring.
// Pick photos (file picker, drag-drop or the bundled samples), choose a
// multi-panel layout and a colour grade, crop and position each panel by
// dragging on the preview, edit the caption live, export a PNG. Photos are
// read with FileReader / object URLs on this machine only; nothing uploads.
import { GRADES, LAYOUTS, SIZES, drawCoverArt, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const taglineInput = document.getElementById('tagline');
const zoomInput = document.getElementById('zoom');
const zoomLabel = document.getElementById('zoomLabel');

export const state = {
  photos: [], // { img, name }
  panelPhoto: [0, 0, 0, 0],
  panelZoom: [1, 1, 1, 1],
  panelOX: [0, 0, 0, 0],
  panelOY: [0, 0, 0, 0],
  panelFit: ['fill', 'fill', 'fill', 'fill'],
  layout: 'trio',
  grade: 'sunset',
  title: 'Vice City Nights',
  tagline: 'Welcome back to Vice City',
  size: '1080x1080',
  vignette: true,
  grain: false,
  scanlines: false,
};
let selectedPanel = 0;

export function currentSize() {
  return SIZES.find((s) => s.id === state.size) || SIZES[0];
}

export function resizePreview() {
  const size = currentSize();
  canvas.width = size.w;
  canvas.height = size.h;
}

export function redraw() {
  resizePreview();
  const ctx = canvas.getContext('2d');
  drawCoverArt(ctx, canvas.width, canvas.height, state);
  syncPanelControls();
}

export function setStatus(msg) {
  statusEl.textContent = msg;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image: ' + url));
    img.src = url;
  });
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
  state.panelPhoto = state.panelPhoto.map((_, i) => Math.min(i, state.photos.length - 1));
  redraw();
  setStatus(`Loaded ${file.name} — ${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} ready.`);
  return true;
}

export async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos.push({ img, name: name + '.jpg' });
  if (state.photos.length > 4) state.photos = state.photos.slice(-4);
  state.panelPhoto = state.panelPhoto.map((_, i) => Math.min(i, state.photos.length - 1));
  redraw();
  return true;
}

// ---- controls ----
const photoInput = document.getElementById('photo');
photoInput.addEventListener('change', async (e) => {
  for (const file of e.target.files) await addPhotoFile(file);
  photoInput.value = '';
});
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
taglineInput.addEventListener('input', () => { state.tagline = taglineInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  state.panelZoom[selectedPanel] = Number(zoomInput.value);
  zoomLabel.textContent = `${Number(zoomInput.value).toFixed(2)}x`;
  redraw();
});

document.querySelectorAll('[data-layout]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.layout = btn.dataset.layout;
    document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b === btn));
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.grade = btn.dataset.grade;
    document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b === btn));
    redraw();
  });
});
document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.size = btn.dataset.size;
    document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b === btn));
    redraw();
  });
});
document.getElementById('fitBtn').addEventListener('click', () => {
  state.panelFit[selectedPanel] = 'fit';
  redraw();
});
document.getElementById('fillBtn').addEventListener('click', () => {
  state.panelFit[selectedPanel] = 'fill';
  redraw();
});
document.getElementById('resetPan').addEventListener('click', () => {
  state.panelOX[selectedPanel] = 0;
  state.panelOY[selectedPanel] = 0;
  state.panelZoom[selectedPanel] = 1;
  zoomInput.value = '1';
  zoomLabel.textContent = '1.00x';
  redraw();
});
document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; redraw(); });
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });
document.getElementById('scanlines').addEventListener('change', (e) => { state.scanlines = e.target.checked; redraw(); });
document.getElementById('sampleBoulevard').addEventListener('click', async () => {
  await loadSample('boulevard');
  setStatus('Sample photo loaded: boulevard.');
});
document.getElementById('samplePier').addEventListener('click', async () => {
  await loadSample('pier');
  setStatus('Sample photo loaded: pier.');
});

// panel photo selectors
const panelSelects = [...document.querySelectorAll('[data-panel]')];
function syncPanelControls() {
  panelSelects.forEach((sel) => {
    const idx = Number(sel.dataset.panel);
    const keep = sel.value;
    sel.innerHTML = '';
    state.photos.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Photo ${i + 1} — ${p.name}`;
      sel.appendChild(opt);
    });
    if (state.photos.length === 0) {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'No photo yet — sunset art';
      sel.appendChild(opt);
    }
    sel.value = String(state.panelPhoto[idx] ?? 0);
    if (sel.value === '' && keep !== '') sel.value = keep;
    sel.disabled = state.photos.length === 0;
  });
  const active = document.getElementById('activePanel');
  if (active) active.textContent = `Panel ${selectedPanel + 1} of ${LAYOUTS[state.layout].panels}`;
  zoomInput.value = String(state.panelZoom[selectedPanel] || 1);
  zoomLabel.textContent = `${(state.panelZoom[selectedPanel] || 1).toFixed(2)}x`;
}
panelSelects.forEach((sel) => {
  sel.addEventListener('change', () => {
    state.panelPhoto[Number(sel.dataset.panel)] = Number(sel.value);
    redraw();
  });
});

// drag on the preview to pan the panel under the pointer
let dragging = null;
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
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  selectedPanel = hit.index;
  dragging = { x: e.clientX, y: e.clientY, ox: state.panelOX[selectedPanel], oy: state.panelOY[selectedPanel] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  state.panelOX[selectedPanel] = dragging.ox + (e.clientX - dragging.x) / rect.width;
  state.panelOY[selectedPanel] = dragging.oy + (e.clientY - dragging.y) / rect.height;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });

// drag-drop photos onto the preview or the whole page
function handleDrop(e) {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  files.forEach((f) => addPhotoFile(f));
}
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', handleDrop);
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', handleDrop);

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

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => exportPNG(btn.dataset.export));
});

// test hook: lets automated checks drive the app without a mouse
window.__vc = { state, loadSample, addPhotoFile, exportBytes, exportPNG, redraw, currentSize };

// ---- shot scenes ----
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  await runShot(shot, query, async (scene) => {
    state.title = scene.title;
    state.tagline = scene.tagline;
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.size = scene.size.id;
    titleInput.value = scene.title;
    taglineInput.value = scene.tagline;
    document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === scene.layout));
    document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === scene.grade));
    document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === scene.size.id));
    for (const name of scene.photos) await loadSample(name);
    // spread the two samples across panels for a real multi-panel cover
    state.panelPhoto = [0, 1, 0, 1];
    redraw();
  });
} else {
  redraw();
}

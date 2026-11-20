// Vice City Cover Studio — export orchestration (round 2d, new module).
// Everything that turns a rendered cover canvas into a downloaded file
// lives here, so main.js never hand-rolls a download again: PNG and
// JPEG exports, the "all sizes" batch with a progress callback, and the
// safe filenames. JPEG has no alpha channel, so a JPEG export is drawn
// onto a white-filled copy first — otherwise the transparent corners
// of a cover would come out black. Nothing here touches the network;
// the download is a same-page object URL that is revoked right after
// the click, and the caption is only ever used to build a filename.
import { SIZES } from './cover.js';

/** The formats the app can export. The entry program (--formats) reads this list back. */
export const EXPORT_FORMATS = ['png', 'jpeg'];

/** The JPEG qualities offered in the UI (quality select). */
export const JPEG_QUALITIES = [0.8, 0.9, 0.95];
export const DEFAULT_JPEG_QUALITY = 0.9;

/** Pause between files in an "export all" batch, so the browser can start each download. */
export const EXPORT_ALL_DELAY_MS = 350;

/** Clamp a JPEG quality into the 0..1 range canvas.toBlob() accepts. */
export function clampQuality(quality) {
  const q = Number(quality);
  if (!Number.isFinite(q)) return DEFAULT_JPEG_QUALITY;
  return Math.min(1, Math.max(0, q));
}

/**
 * Turn a caption into a filename-safe slug: lowercase, runs of
 * non-letters/digits become one dash, leading/trailing dashes cut,
 * capped at 40 characters. An empty or punctuation-only caption falls
 * back to 'cover', so the filename is never just dashes or empty.
 */
export function slugifyTitle(title) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'cover';
}

/** `vice-city-cover-<slug>-<sizeId>.png` (or `.jpg` for JPEG). */
export function safeFilename(title, sizeId, format) {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  return `vice-city-cover-${slugifyTitle(title)}-${sizeId}.${ext}`;
}

/**
 * Render a canvas to a Blob. PNG keeps its alpha channel; JPEG is
 * painted onto a white-filled copy first (JPEG has no alpha, and a
 * transparent pixel would otherwise export as black).
 */
export function canvasToBlob(canvas, format, quality = DEFAULT_JPEG_QUALITY) {
  return new Promise((resolve) => {
    if (format === 'jpeg') {
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      flat.toBlob((blob) => resolve(blob), 'image/jpeg', clampQuality(quality));
      return;
    }
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Trigger a browser download of a Blob and return the filename used. */
export function downloadFile(blob, filename) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/**
 * Build the export functions for one editor. `render(sizeId)` returns
 * the off-screen canvas for that size (main.js owns the render), and
 * `getTitle()` supplies the caption for the filename. Every export
 * reports its result through `setStatus`, like the rest of the app.
 */
export function createExporter({ render, getTitle, setStatus }) {
  const sizeFor = (sizeId) => SIZES.find((s) => s.id === sizeId) || SIZES[0];

  async function exportOne(sizeId, format, quality) {
    const size = sizeFor(sizeId);
    const blob = await canvasToBlob(render(size.id), format, quality);
    if (!blob) {
      setStatus('Export failed — try again.');
      return null;
    }
    const name = safeFilename(getTitle(), size.id, format);
    downloadFile(blob, name);
    const label = format === 'jpeg' ? `JPEG (quality ${clampQuality(quality)})` : 'PNG';
    setStatus(`Saved ${name} (${size.w} x ${size.h}, ${label}). Photos never left this machine.`);
    return blob;
  }

  /** Export one size as PNG and download it. Returns the Blob (or null). */
  function exportPNG(sizeId) {
    return exportOne(sizeId, 'png');
  }

  /** Export one size as JPEG at the given quality and download it. */
  function exportJPEG(sizeId, quality = DEFAULT_JPEG_QUALITY) {
    return exportOne(sizeId, 'jpeg', quality);
  }

  /**
   * Export every size in `sizes` (default: all three) in one format,
   * calling `onProgress({ done, total, sizeId, format })` after each
   * file. Returns the Blobs in order. Unknown formats fail fast with
   * a thrown error instead of silently exporting nothing.
   */
  async function exportAll(sizes = SIZES, format = 'png', onProgress = null, quality = DEFAULT_JPEG_QUALITY) {
    if (!EXPORT_FORMATS.includes(format)) throw new Error(`Unknown export format: ${format}`);
    const list = sizes.length ? sizes : SIZES;
    const blobs = [];
    for (let i = 0; i < list.length; i++) {
      const size = list[i];
      blobs.push(await exportOne(size.id, format, quality));
      if (onProgress) onProgress({ done: i + 1, total: list.length, sizeId: size.id, format });
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, EXPORT_ALL_DELAY_MS));
    }
    const label = format === 'jpeg' ? 'JPEG' : 'PNG';
    setStatus(`Saved all ${list.length} sizes as ${label}: ${list.map((s) => s.id).join(', ')}.`);
    return blobs;
  }

  /**
   * Same render as exportOne, but returns a data URL instead of
   * downloading — the hook the automated tests use to decode and
   * measure an export without a file dialog.
   */
  function exportDataURL(sizeId, format = 'png', quality = DEFAULT_JPEG_QUALITY) {
    return new Promise((resolve) => {
      const size = sizeFor(sizeId);
      canvasToBlob(render(size.id), format, quality).then((blob) => {
        if (!blob) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ size: blob.size, dataUrl: reader.result, format });
        reader.readAsDataURL(blob);
      });
    });
  }

  return { exportPNG, exportJPEG, exportAll, exportDataURL, downloadFile, safeFilename };
}

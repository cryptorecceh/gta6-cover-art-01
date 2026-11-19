// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the exported cover alone, full frame.
// Params: photo (sample name), photo2 (second sample), caption (title),
// tagline, layout, grade, size. window.__shotReady is set once painted.
import { SIZES } from './cover.js';

export function shotSize(query) {
  const size = SIZES.find((s) => s.id === (query.get('size') || '1080x1080')) || SIZES[0];
  return size;
}

export async function runShot(shot, query, load) {
  const size = shotSize(query);
  const layout = query.get('layout') || 'trio';
  const grade = query.get('grade') || 'sunset';
  const title = query.get('caption') || 'Vice City Nights';
  const tagline = query.get('tagline') || 'Welcome back to Vice City';
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.documentElement.classList.add('shot-cover');
  }
  const photoName = query.get('photo') || 'boulevard';
  const second = query.get('photo2') || 'pier';
  await load({
    photos: [photoName, second],
    title,
    tagline,
    layout,
    grade,
    size,
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

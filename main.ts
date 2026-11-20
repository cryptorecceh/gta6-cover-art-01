// Vice City Cover Studio — make.fun gta6-cover-art-01 entry program (round 2c).
// Node 22, standard library only. It hands the entry in: copy this repo's
// app/ and screenshots/ into the output directory (MAKEFUN_OUTPUT_DIR outside
// the grader, /output inside it) and write dossier.json with the vendored
// make.fun library, so the sealed scorer can re-derive the same dossier
// byte for byte. Deterministic: same inputs, same bytes, every run.
//
// New in 2b: the dossier caps are validated BEFORE anything is copied —
// a too-big app or screenshot set fails fast with a clear error instead
// of copying half an entry and then refusing. --help prints usage and
// exits without touching the output directory. On success a short build
// summary (files copied, screenshots, dossier bytes) goes to stdout.
//
// New in 2c (grader conveniences, no change to the built entry):
//   --validate-only  run the preflight caps AND build the dossier in a
//                    throwaway temp directory, then delete it — it proves
//                    the entry would build without writing anything to
//                    MAKEFUN_OUTPUT_DIR. Prints the dossier sha256.
//   --sizes          list the export sizes the app offers (from SIZES)
//                    and exit without touching the output directory.
// New in 2d: --formats lists the export formats (png, jpeg) and JPEG
// qualities, validated against app/src/export.js the same way --sizes
// is validated against app/src/cover.js. The export module itself
// (app/src/export.js) is new in 2d; main.ts does not import it.
// The size list lives in app/src/cover.js as the single source of truth;
// main.ts reads it back with a small lexical scan (no import of the
// browser module, which would pull in DOM-only code at load time).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const USAGE = `Vice City Cover Studio — make.fun gta6-cover-art-01 entry program

Usage:
  node main.ts [--help] [--validate-only] [--sizes] [--formats]

Copies app/ and screenshots/ into MAKEFUN_OUTPUT_DIR (default /output)
and writes dossier.json there with the vendored make.fun library.
Caps (from the competition gate): dossier text 160 KiB; at most 4
screenshots of 256 KiB each; app/ at most 993 files and 48 MiB in all,
no path over 1000 bytes. Caps are checked before copying; a breach
fails fast with an error and no output is written.
  --validate-only  check the caps and build the dossier in a temp
                   directory, then delete it; writes nothing to the
                   output directory. Prints the dossier sha256.
  --sizes          list the export sizes (from app/src/cover.js) and exit.
  --formats        list the export formats (from app/src/export.js) and
                   exit; fails if the module does not offer png + jpeg.
`;

export const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** The export sizes, read from app/src/cover.js (SIZES table). */
export const EXPORT_SIZES = [
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

/** The export formats + JPEG qualities, mirroring app/src/export.js. */
export const EXPORT_FORMATS = ['png', 'jpeg'];
export const JPEG_QUALITIES = [0.8, 0.9, 0.95];

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function walkTree(dir: string, base = ''): { rel: string; bytes: number }[] {
  // dir is the directory being listed, base its path relative to app/.
  // The first version joined dir + rel and double-counted the subpath
  // (stat failed on app/samples/samples/boulevard.jpg); the recursion
  // now passes the child directory itself, so join(dir, entry.name) is
  // always the real path.
  const out: { rel: string; bytes: number }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base === '' ? entry.name : `${base}/${entry.name}`;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTree(full, rel));
    else if (entry.isFile()) out.push({ rel, bytes: statSync(full).size });
    else fail(`app/${rel}: not a plain file or directory — app/ holds plain files only`);
  }
  return out;
}

/**
 * Fail fast, before any copying, when the entry would breach a cap the
 * scorer enforces. Returns the counts the build summary prints.
 */
function preflightCaps(appSource: string, shotsSource: string): { appFiles: number; appBytes: number; shotFiles: string[] } {
  if (!existsSync(join(appSource, 'index.html'))) {
    fail('app/index.html is missing — an app needs its index.html at the root');
  }
  const appFiles = walkTree(appSource);
  if (appFiles.length > CAPS.app_max_files) {
    fail(`app/ holds ${appFiles.length} entries, over the ${CAPS.app_max_files} allowed (app_max_files)`);
  }
  const appBytes = appFiles.reduce((n, f) => n + f.bytes, 0);
  if (appBytes > CAPS.app_max_bytes) {
    fail(`app/ totals ${appBytes} bytes, over the ${CAPS.app_max_bytes} allowed (app_max_bytes)`);
  }
  for (const f of appFiles) {
    if (Buffer.byteLength(f.rel, 'utf8') > CAPS.app_path_max_bytes) {
      fail(`app/${f.rel}: path over ${CAPS.app_path_max_bytes} bytes (app_path_max_bytes)`);
    }
  }
  const shotFiles: string[] = [];
  if (existsSync(shotsSource)) {
    for (const name of readdirSync(shotsSource).sort()) {
      const full = join(shotsSource, name);
      if (!statSync(full).isFile()) continue;
      if (!/\.(png|jpe?g)$/i.test(name)) fail(`screenshots/${name}: not a PNG or JPEG`);
      const bytes = statSync(full).size;
      if (bytes > CAPS.screenshots.max_bytes) {
        fail(`screenshots/${name}: ${bytes} bytes, over the ${CAPS.screenshots.max_bytes} allowed per screenshot`);
      }
      shotFiles.push(name);
    }
  }
  if (shotFiles.length === 0) fail('screenshots/ holds no image — an entry needs 3 or 4 screenshots');
  if (shotFiles.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shotFiles.length} images, over the ${CAPS.screenshots.max} allowed`);
  }
  return { appFiles: appFiles.length, appBytes, shotFiles };
}

/**
 * Cross-check the hardcoded EXPORT_SIZES above against the SIZES table
 * in app/src/cover.js, so the two can never drift apart silently: the
 * --sizes output is only printed when the ids and dimensions agree.
 * A lexical scan is enough — the table is three `{ id, label, w, h }`
 * rows — and it keeps main.ts free of any browser-module import.
 */
function checkSizesAgree(appSource: string): void {
  const coverJs = readFileSync(join(appSource, 'src', 'cover.js'), 'utf8');
  const rowRe = /\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\}/g;
  const found: { id: string; label: string; w: number; h: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(coverJs)) !== null) {
    found.push({ id: m[1]!, label: m[2]!, w: Number(m[3]), h: Number(m[4]) });
  }
  if (found.length !== EXPORT_SIZES.length) {
    fail(`cover.js SIZES has ${found.length} rows, main.ts lists ${EXPORT_SIZES.length} — size tables disagree`);
  }
  for (let i = 0; i < found.length; i++) {
    const a = found[i]!;
    const b = EXPORT_SIZES[i]!;
    if (a.id !== b.id || a.w !== b.w || a.h !== b.h || a.label !== b.label) {
      fail(`cover.js SIZES row ${i} (${a.id} ${a.w}x${a.h}) disagrees with main.ts (${b.id} ${b.w}x${b.h})`);
    }
  }
}

/**
 * Cross-check the hardcoded EXPORT_FORMATS / JPEG_QUALITIES above
 * against app/src/export.js, so the two can never drift apart: the
 * --formats output is only printed when the module offers exactly the
 * formats and qualities main.ts claims. A lexical scan is enough — the
 * tables are one-line array literals — and it keeps main.ts free of
 * any browser-module import (export.js pulls in DOM-only code).
 */
function checkFormatsAgree(appSource: string): void {
  const exportJs = readFileSync(join(appSource, 'src', 'export.js'), 'utf8');
  const formatsMatch = /EXPORT_FORMATS\s*=\s*\[([^\]]+)\]/.exec(exportJs);
  const qualitiesMatch = /JPEG_QUALITIES\s*=\s*\[([^\]]+)\]/.exec(exportJs);
  if (!formatsMatch || !qualitiesMatch) {
    fail('app/src/export.js does not declare EXPORT_FORMATS / JPEG_QUALITIES — format tables disagree');
  }
  const formats = formatsMatch[1]!.split(',').map((s) => s.trim().replace(/['"]/g, ''));
  const qualities = qualitiesMatch[1]!.split(',').map((s) => Number(s.trim()));
  if (formats.length !== EXPORT_FORMATS.length || !EXPORT_FORMATS.every((f, i) => formats[i] === f)) {
    fail(`export.js EXPORT_FORMATS [${formats.join(', ')}] disagrees with main.ts [${EXPORT_FORMATS.join(', ')}]`);
  }
  if (qualities.length !== JPEG_QUALITIES.length || !JPEG_QUALITIES.every((q, i) => qualities[i] === q)) {
    fail(`export.js JPEG_QUALITIES [${qualities.join(', ')}] disagrees with main.ts [${JPEG_QUALITIES.join(', ')}]`);
  }
}

/** Copy app/ + screenshots/ into dir (used by the real build and by --validate-only staging). */
function stageEntry(appSource: string, shotsSource: string, dir: string): void {
  cpSync(appSource, join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'screenshots'), { recursive: true });
  if (existsSync(shotsSource)) cpSync(shotsSource, join(dir, 'screenshots'), { recursive: true });
}

function buildSummary(pre: { appFiles: number; appBytes: number; shotFiles: string[] }, dossier: Uint8Array, dir: string): void {
  const sha = createHash('sha256').update(dossier).digest('hex');
  console.log(`Vice City Cover Studio — entry built into ${dir}`);
  console.log(`  app files copied: ${pre.appFiles} (${pre.appBytes} bytes)`);
  console.log(`  screenshots copied: ${pre.shotFiles.length} (${pre.shotFiles.join(', ')})`);
  console.log(`  dossier.json: ${dossier.length} bytes, sha256 ${sha}`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const appSource = join(repoRoot, 'app');
  const shotsSource = join(repoRoot, 'screenshots');
  const appTarget = join(outputDir, 'app');
  const shotsTarget = join(outputDir, 'screenshots');

  if (args.includes('--sizes')) {
    checkSizesAgree(appSource);
    for (const s of EXPORT_SIZES) console.log(`${s.id}  ${s.label}`);
    return;
  }

  if (args.includes('--formats')) {
    checkFormatsAgree(appSource);
    for (const f of EXPORT_FORMATS) console.log(f);
    console.log(`jpeg qualities: ${JPEG_QUALITIES.join(', ')}`);
    return;
  }

  // Cross-check the size AND format tables on every build, not just
  // --sizes / --formats: the first --validate-only run passed without
  // the format check, but a build shipping an export module whose
  // formats disagree with main.ts would list formats the app cannot
  // export. Fails fast, before any copying.
  checkSizesAgree(appSource);
  checkFormatsAgree(appSource);
  const pre = preflightCaps(appSource, shotsSource);

  if (args.includes('--validate-only')) {
    // Prove the entry builds without touching MAKEFUN_OUTPUT_DIR:
    // stage into a temp dir, build the dossier there, print its hash,
    // then remove the staging dir (finally, so a build error still
    // cleans up). The output directory is never created or written.
    const staging = mkdtempSync(join(tmpdir(), 'vc-validate-'));
    try {
      stageEntry(appSource, shotsSource, staging);
      const dossier = buildDossier(staging, CAPS);
      const sha = createHash('sha256').update(dossier).digest('hex');
      console.log('Vice City Cover Studio — validation only, nothing written to the output directory');
      console.log(`  app files staged: ${pre.appFiles} (${pre.appBytes} bytes)`);
      console.log(`  screenshots staged: ${pre.shotFiles.length} (${pre.shotFiles.join(', ')})`);
      console.log(`  dossier.json: ${dossier.length} bytes, sha256 ${sha}`);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    return;
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(appSource, appTarget, { recursive: true });
  mkdirSync(shotsTarget, { recursive: true });
  if (existsSync(shotsSource)) cpSync(shotsSource, shotsTarget, { recursive: true });

  const dossier = buildDossier(outputDir, CAPS);
  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  buildSummary(pre, dossier, outputDir);
}

main();

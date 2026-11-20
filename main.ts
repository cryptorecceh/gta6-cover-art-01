// Vice City Cover Studio — make.fun gta6-cover-art-01 entry program (round 2b).
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
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const USAGE = `Vice City Cover Studio — make.fun gta6-cover-art-01 entry program

Usage:
  node main.ts [--help]

Copies app/ and screenshots/ into MAKEFUN_OUTPUT_DIR (default /output)
and writes dossier.json there with the vendored make.fun library.
Caps (from the competition gate): dossier text 160 KiB; at most 4
screenshots of 256 KiB each; app/ at most 993 files and 48 MiB in all,
no path over 1000 bytes. Caps are checked before copying; a breach
fails fast with an error and no output is written.
`;

export const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

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

function main(): void {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const appSource = join(repoRoot, 'app');
  const shotsSource = join(repoRoot, 'screenshots');
  const appTarget = join(outputDir, 'app');
  const shotsTarget = join(outputDir, 'screenshots');

  const pre = preflightCaps(appSource, shotsSource);

  mkdirSync(outputDir, { recursive: true });
  cpSync(appSource, appTarget, { recursive: true });
  mkdirSync(shotsTarget, { recursive: true });
  if (existsSync(shotsSource)) cpSync(shotsSource, shotsTarget, { recursive: true });

  const dossier = buildDossier(outputDir, CAPS);
  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  const sha = createHash('sha256').update(dossier).digest('hex');
  console.log(`Vice City Cover Studio — entry built into ${outputDir}`);
  console.log(`  app files copied: ${pre.appFiles} (${pre.appBytes} bytes)`);
  console.log(`  screenshots copied: ${pre.shotFiles.length} (${pre.shotFiles.join(', ')})`);
  console.log(`  dossier.json: ${dossier.length} bytes, sha256 ${sha}`);
}

main();

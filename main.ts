// Vice City Cover Studio — make.fun gta6-cover-art-01 entry program.
// Node 22, standard library only. It hands the entry in: copy this repo's
// app/ and screenshots/ into the output directory (MAKEFUN_OUTPUT_DIR outside
// the grader, /output inside it) and write /output/dossier.json with the
// vendored make.fun library, so the sealed scorer can re-derive the same
// dossier byte for byte. Deterministic: same inputs, same bytes, every run.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const appSource = join(repoRoot, 'app');
const shotsSource = join(repoRoot, 'screenshots');
const appTarget = join(outputDir, 'app');
const shotsTarget = join(outputDir, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(appSource, appTarget, { recursive: true });
mkdirSync(shotsTarget, { recursive: true });
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

// Caps from the competition's gate (reference/gate.json): the dossier text is
// capped at 160 KiB; at most 4 screenshots of 256 KiB each; app/ at most 993
// files and 48 MiB in all, with no path over 1000 bytes. buildDossier enforces
// them and refuses an entry the scorer would refuse.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

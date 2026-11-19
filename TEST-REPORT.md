# TEST REPORT — Vice City Cover Studio, round 2 (gta6-cover-art-01)

Entry rebuilt from scratch in the recorded round-2 session (child of round-1
commit `3ab534eeaab38e9386e6754368862f828ad082dc`). Every file was written fresh
in the session; `vendor/makefun-app.ts` is the fresh kit's copy, byte-identical
(sha256 `14e650adbd6aff7fb760e9bcd7be00dfbe86fb4819afe88dfe23dd0e087e770e`).
Sample photos are the kit's free-to-use model-made images, copied in-session
from the round-1 reference dir. Screenshots were regenerated with headless
Chrome from the new app — no round-1 screenshot was reused.

Environment: Node v24.22.1, Google Chrome 157.0.8103.78
(`~/workspace/tools/chrome/opt/google/chrome/google-chrome`).

## 1. Fresh-tree test (as the grader would run it)

The working tree was copied (excluding `.git`) to a separate temp dir
`/tmp/r2-test` — a plain `git clone` would have returned the round-1 commit,
so the copy is the exact file set being committed here.

```
rm -rf /tmp/r2-test /tmp/r2-out1 /tmp/r2-out2
mkdir -p /tmp/r2-test
tar --exclude=.git -cf - . | (cd /tmp/r2-test && tar xf -)
cd /tmp/r2-test
mkdir -p /tmp/r2-out1 /tmp/r2-out2
MAKEFUN_OUTPUT_DIR=/tmp/r2-out1 node main.ts
MAKEFUN_OUTPUT_DIR=/tmp/r2-out2 node main.ts
```

Results:

```
sha256sum /tmp/r2-out1/dossier.json /tmp/r2-out2/dossier.json
dc4ef8e7822787f2419b63c24b0516dc9db2b0114dd19e1405e0fe4233055ab0  /tmp/r2-out1/dossier.json
dc4ef8e7822787f2419b63c24b0516dc9db2b0114dd19e1405e0fe4233055ab0  /tmp/r2-out2/dossier.json
cmp /tmp/r2-out1/dossier.json /tmp/r2-out2/dossier.json  -> DOSSIER-IDENTICAL
diff -r /tmp/r2-test/app /tmp/r2-out1/app                -> COPIES-BYTE-IDENTICAL
diff -r /tmp/r2-test/screenshots /tmp/r2-out1/screenshots -> COPIES-BYTE-IDENTICAL
dossier.json: 945771 bytes (cap 1.5 MiB = 1572864)
```

`main.ts` is deterministic: two runs produce byte-identical `dossier.json`,
and the copied `app/` + `screenshots/` are byte-identical to source.

## 2. Functional test in headless Chrome (CDP, Node stdlib only)

Driver: `/tmp/test-drive.mjs` — launches headless Chrome with
`--remote-debugging-port`, drives the app served from `/tmp/r2-test` on
`http://127.0.0.1:8081` via `window.__vc`, 40 checks. Full log:

```
r2-test serve: 200
PASS  app boots, window.__vc present
PASS  starts with 0 photos
PASS  default layout trio
PASS  default grade sunset
PASS  default title set
PASS  canvas paints non-blank sunset art with no photo  — pixel-sum=376748
PASS  2 sample photos loaded
PASS  panelPhoto spread across panels  — [0,1,1,1]
PASS  title edit updates state
PASS  tagline edit updates state
PASS  layout switch -> solo
PASS  layout solo panel count
PASS  layout switch -> duo
PASS  layout duo panel count
PASS  layout switch -> trio
PASS  layout trio panel count
PASS  layout switch -> quad
PASS  layout quad panel count
PASS  grade switch -> sunset
PASS  grade switch -> neon
PASS  grade switch -> pastel
PASS  grade switch -> midnight
PASS  zoom slider sets panel zoom 2x
PASS  Fit button sets panel fit=fit
PASS  Fill button sets panel fit=fill
PASS  Reset restores zoom 1x
PASS  Shuffle runs, layout+grade valid  — {"l":"duo","g":"pastel"}
PASS  export 1080x1080 returns PNG data URL  — ~1910602 bytes
PASS  export 1080x1080 sane size (>100 KiB)  — ~1910602 bytes
PASS  export 1080x1350 returns PNG data URL  — ~2303575 bytes
PASS  export 1080x1350 sane size (>100 KiB)  — ~2303575 bytes
PASS  export 1920x1080 returns PNG data URL  — ~3319807 bytes
PASS  export 1920x1080 sane size (>100 KiB)  — ~3319807 bytes
PASS  export with no photo still produces PNG (sunset fallback)  — ~1079149 bytes
PASS  non-image file rejected (addPhotoFile -> false)
PASS  non-image status message shown
PASS  empty caption exports without error
PASS  empty caption state is empty string (renderer defaults)
PASS  zero external network requests  — 4 local resources
PASS  panel 2 selector reassigns photo

TOTAL: 40 checks, 40 passed, 0 failed
```

Note: an earlier run of this driver against a plain `git clone` (which returns
the round-1 commit, not the working tree) failed 1 check — the `midnight`
grade button does not exist in round 1. That run was discarded; the 40/40 run
above is against `/tmp/r2-test`, the exact round-2 files.

## 3. Exported PNG decodes at the right size (independent proof)

Driver `/tmp/export-check.mjs` exported a 1080x1080 cover from the app and
saved `/tmp/export-check.png`:

```
saved /tmp/export-check.png bytes= 2068979 dataUrlLen= 2758662
exported PNG decodes: PNG (1080, 1080) RGBA
```

The exported PNG is a real 1080x1080 image, not an empty canvas.

## 4. Gate numbers (measured on /tmp/r2-test)

| Gate row | Measured | Cap | Result |
|---|---|---|---|
| app_files: entries under app/ | 10 | 993 | PASS |
| app_files: app/ bytes | 151992 | 50331648 | PASS |
| app_files: index.html bytes | 4363 | 1048576 | PASS |
| app_files: symlinks under app/ | 0 | 0 | PASS |
| references: external refs in app/ | none (`grep -rnE "https?://|//[a-zA-Z0-9]" app/` -> NONE FOUND) | 0 | PASS |
| screenshots: count | 4 | 3–4 | PASS |
| screenshots: 1-cover.jpg | JPEG 1080x1080, 194632 B | ≤262144 B, long ≤1280, short ≥480 | PASS |
| screenshots: 2-editor.jpg | JPEG 1280x720, 131184 B | same | PASS |
| screenshots: 3-cover-portrait.jpg | JPEG 1024x1280, 215398 B | same | PASS |
| screenshots: 4-cover-wide.jpg | JPEG 1280x720, 141435 B | same | PASS |
| dossier_matches: dossier byte-identical across 2 runs | sha256 `dc4ef8e7…3055ab0` both runs | — | PASS |
| dossier_matches: dossier bytes | 945771 | ≤1572864 | PASS |
| js_parses: app/src/cover.js, main.js, shots.js | all parse as ES modules (`node --input-type=module --check`) | — | PASS |
| vendor/makefun-app.ts | sha256 `14e650ad…770e`, identical to fresh kit | unchanged | PASS |

Note on `node --check serve.ts`: it fails with `SyntaxError: Missing
initializer` at the `Record<string, string>` type annotation, because
`--check` parses the file as plain JavaScript with no type stripping. This is
a `--check` limitation, not a runtime problem: `serve.ts` executes fine under
plain `node` (it served the app on ports 8080/8081, HTTP 200, pages rendered)
and `main.ts` passes `--check` (it has no annotations). Round 1 carried the
identical annotation and ran the same way.

Screenshots were visually inspected: 1-cover.jpg shows the trio multi-panel
cover with photos loaded, bold title and tagline; 2-editor.jpg shows the
editor with controls + live preview and photos loaded; 3-cover-portrait.jpg
shows the quad cover in the new Midnight Drive grade (1080x1350);
4-cover-wide.jpg shows the duo wide cover (1920x1080).

## 5. requirements.json checklist (gta6-cover-art-01-requirements.json)

- Competition: `gta6-cover-art-01`, "Make GTA 6 Cover Art", status open,
  harness program/v1. Entries close 2026-11-21T10:30:00Z — this round-2 build
  is inside the window.
- Deliverables (repo files): `LICENSE` (MIT, OSI-approved) present;
  `main.ts` at repo root (Node 22 stdlib only) present. `.makefun/owner.json`
  not needed: the repo owner `cryptorecceh` is the account's GitHub login.
  Form fields (`repo_url`, `commit_sha`, `recording_ids`, `entry_message`,
  `entry_signature`) are the submit step, done by the parent, not this build.
- The task: multi-panel GTA-style cover art — Solo/Duo/Trio/Quad layouts,
  bold caption lettering, Vice City sunset/neon grade — all present and
  tested (§2). Any photo: file picker (up to 4), drag & drop, 2 bundled
  samples; crop/position per panel (drag pan, zoom, Fill/Fit, reset);
  caption editable live — all tested (§2).
- Fast and easy: 1 click per export size, plus "Export all three sizes";
  1080x1080, 1080x1350, 1920x1080 all export and decode (§2, §3).
- Original: no Rockstar logo, wordmark, official artwork or font anywhere;
  all art is drawn in canvas code; system fonts only; samples are the kit's
  free-to-use model-made photos.
- Static + offline: `app/` is plain files, no build step; 0 external network
  requests measured in the browser (§2); every reference is a relative path
  inside `app/` or a `data:` URI (§4).
- `main.ts` copies `app/` + `screenshots/` to `MAKEFUN_OUTPUT_DIR` (or
  `/output`) and writes `dossier.json` via `vendor/makefun-app.ts` (§1).
- Screenshots: 4 JPEGs, first by name is the cover; one shows the editor
  with a photo loaded (2-editor.jpg), the others show exported covers (§4).
- No secrets in the tree: `grep -rInE` for `sk-…`, `ghp_/gho_…`, `AKIA…`,
  `api_key = "…"` over the tree (excluding `.git`) -> NO SECRETS FOUND.
- No payment anywhere: free only, no key, no SOL spent (Rp 0).

## 6. Negative tests (all in §2 driver, all PASS)

- No photo: export still produces a PNG (sunset-art fallback), ~1,079,149 B.
- Empty caption: exports without error; renderer falls back to "VICE CITY".
- Non-image file (`note.txt`, `text/plain`): `addPhotoFile` returns `false`
  and the status line says "That file is not an image".

## 7. What was NOT tested here (out of scope for the build agent)

- The submit step (`makefun.mjs submit`, entry signature, recording ids):
  done by the parent after this build is pushed.
- The sealed scorer / judge: only the public gate numbers above were
  re-checked locally; the real gate runs on make.fun.

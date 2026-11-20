# Vice City Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/cryptorecceh/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/cryptorecceh/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Bounty:** [Make GTA 6 Cover Art — $250 in USDC, top 50 share](https://make.fun/bounty/gta6-cover-art-01)
**Referral:** https://make.fun/?ref=zdkc9vmx

Give any photo the Vice City poster treatment: pick a layout, grade each
panel, shape the caption, and export a share-ready PNG. Built by an AI
agent for make.fun's "Make GTA 6 Cover Art" bounty.

## What you can do

- **Bring your own photos:** file picker (up to 4), drag & drop onto the preview, or the two bundled sample photos. Everything is read on your machine — nothing uploads anywhere.
- **Six panel layouts:** Solo (full-bleed), Duo (side by side), Trio (hero + two stacked), Quad (2×2 grid), Strip (three horizontal bands — a wide hero band on top, two thinner bands below), and the new **Banner** (one wide cinematic hero band across the top, two panels below — made for the 1920×1080 export). Every panel can show a different photo.
- **A photo treatment per panel:** None, Grayscale, Sepia, or High contrast — set independently for each of the four panels, and baked into the exported PNG exactly as previewed.
- **Crop & position per panel:** drag on the preview to pan (click selects the panel), zoom slider, Fill / Fit, reset.
- **Caption, your way:** a bold condensed uppercase title with outline + neon glow, plus a tagline strip — both edit live as you type. Two new sliders shape the title itself: **title size** (0.70×–1.30×) and **letter spacing** (−2 to +12 px), with a one-click reset. Both are baked into the exported PNG, not just the preview.
- **Colour grades:** Vice Sunset, Neon Night, Pastel Vice, and Midnight Drive — gradient skies, a striped retro sun and palm silhouettes, all drawn in canvas code. Vignette, grain and scanlines are optional, and **Shuffle look** randomises layout, grade, panel treatments, and the caption size/spacing in one click.
- **Keyboard shortcuts:** keys **1–6** pick a layout in order, **G** cycles the colour grade, **E** exports the current size. (Shortcuts pause while you type in a text field.)
- **Export PNG or JPEG:** 1080×1080, 1080×1350, 1920×1080 — one button per size, or **Export all three sizes** at once. **Export JPEG** saves the current size as a `.jpg` at the quality you pick (0.8 smaller file, 0.9 balanced, 0.95 near lossless); JPEG has no transparency, so the export is painted on a white background first, while PNG keeps its alpha channel. Filenames come from your caption (`vice-city-cover-<caption>-<size>.png/.jpg`), sanitised and falling back to `cover` for an empty caption.

All art is drawn in code (canvas gradients, sun, palms, lettering). No Rockstar logo, official artwork or font is used anywhere.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network, no CDN. Open `app/index.html` from any static server in desktop Chrome.

## Screenshot scenes

`shots.json` lists the deterministic scenes (`?shot=editor` for the editor with sample photos loaded, `?shot=cover` for a cover alone, with `photo`, `caption`, `layout`, `grade` and `size` params).

## How it is handed in

`main.ts` (Node 22, stdlib only) checks the dossier caps first, then copies `app/` + `screenshots/` to `MAKEFUN_OUTPUT_DIR` (or `/output`), writes `dossier.json` with the vendored `vendor/makefun-app.ts`, and prints a short build summary. `node main.ts --help` shows usage; `node main.ts --validate-only` proves the entry builds (caps + dossier) without writing to the output directory; `node main.ts --sizes` lists the export sizes; `node main.ts --formats` lists the export formats (png, jpeg) and JPEG qualities, cross-checked against `app/src/export.js`. `TEST-REPORT.md` records the full test evidence for this round.

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=zdkc9vmx&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

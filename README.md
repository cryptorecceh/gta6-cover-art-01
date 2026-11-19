# Vice City Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/cryptorecceh/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/cryptorecceh/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Bounty:** [Make GTA 6 Cover Art — $250 in USDC, top 50 share](https://make.fun/bounty/gta6-cover-art-01)
**Referral:** https://make.fun/?ref=zdkc9vmx

Turn any photo + caption into GTA 6-style multi-panel cover art and export it as a PNG to share. Built by an AI agent for make.fun's "Make GTA 6 Cover Art" bounty.

## What it does

- **Any photo:** file picker (up to 4 photos), drag & drop onto the preview, or the two bundled sample photos. Photos are read on your machine only — nothing is uploaded.
- **Multi-panel layouts:** Solo (full-bleed), Duo (2 vertical panels), Trio (hero + 2 stacked), Quad (2x2 grid). Each panel can show a different photo.
- **Crop & position per panel:** drag on the preview to pan, zoom slider, Fill / Fit, reset.
- **Caption:** bold condensed uppercase title with outline + neon glow, plus a tagline strip. Editable live.
- **Grades:** Vice Sunset (magenta-orange-teal sky, sun disc, palm silhouettes drawn in canvas), Neon Night, Pastel Vice. Vignette, grain and scanlines optional.
- **Export PNG:** 1080x1080, 1080x1350, 1920x1080 — one button per size.

All art is drawn in code (CSS/canvas gradients, sun, palms, lettering). No Rockstar logo, official artwork or font is used anywhere.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network, no CDN. Open `app/index.html` from any static server in desktop Chrome.

## Screenshot scenes

`shots.json` lists the deterministic scenes (`?shot=editor` for the editor with a sample photo loaded, `?shot=cover` for a cover alone, with `photo`, `caption`, `layout`, `grade` and `size` params).

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=zdkc9vmx&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

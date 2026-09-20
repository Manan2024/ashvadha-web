# ASHVADHA website (v35)

Static site, no build step.

## Files
- `index.html` — Hero → SAGA (3D) → Beyond Visible (lead-in + "See you down there.") → Join us
- `team.html`, `journal.html`, `404.html`
- `styles.css` — main styles (layered "passes"; later blocks override earlier ones)
- `saga-v29.css`, `js/saga-brain-v29.js` — SAGA scene source (three.js, WebGL). **The page loads `js/saga-brain.bundle.js`**, a classic-script build of it (no import map, works on older Safari and from `file://`)
- `domain-v29.css`, `js/domain-v29.js` — the black Beyond Visible stage (scroll-driven lead-in + final line + build rail + faint 2D dust; no WebGL)
- `script.js` — nav, reveals, Join grid, page particle fields, boot-veil failsafe
- `js/vendor/three.module.min.js` — three.js r164 (MIT, see `LICENSE-three.txt`), used as the build input
- `images/` — hero, logo, portraits (`.webp` are served; the `.png` masters are kept for reference), favicons, `og-image.jpg`
- `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`

## Local preview
Open `index.html`, or `python3 -m http.server 8080`.

## Rebuilding the SAGA bundle (only after editing `js/saga-brain-v29.js`)
```bash
npx esbuild js/saga-brain-v29.js --bundle --format=iife --minify --target=safari14 \
  --legal-comments=none --alias:three=./js/vendor/three.module.min.js --outfile=js/saga-brain.bundle.js
```

## Deploy
GitHub Pages: push the folder contents to the repo root. `CNAME` keeps the custom domain (`ashvadha.in`) attached.
Cloudflare Pages / Netlify: drag the folder in; ignore `CNAME`.

## Behaviour notes
- If WebGL or the SAGA module fails, `html.saga-failed` is set and SAGA shows as a static title.
- `prefers-reduced-motion` is respected: the SAGA and Beyond Visible sections fall back to static layouts.
- Social preview uses absolute URLs on `https://ashvadha.in` — change them in each page's `<head>` if the domain changes.

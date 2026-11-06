# Portfolio — Hariprasath S

A static portfolio for AI systems, full-stack work and a rule-based futures platform.
No build step: plain HTML, CSS and JavaScript, with an optional JSON content source.

**Live:** https://portfolio-static-lilac.vercel.app

## What's here

| Path | Purpose |
| --- | --- |
| `index.html` | The whole page: hero, case studies, screenshot rail, demo, toolkit, background map, contact. |
| `assets/site.css` | Design tokens for both themes, layout and components. |
| `assets/site.js` | Content hydration, scroll animations, pinned screenshot rail, mind-map connectors, theme toggle. |
| `assets/theme-init.js` | Applies the saved theme before first paint, in its own file so the page needs no inline script under a strict CSP. |
| `content.json` | Profile, contact and project copy. The page hydrates from this file, so editing it changes the site without touching HTML. |
| `404.html`, `assets/404.css` | Not-found page. |
| `admin.html`, `assets/admin.css`, `assets/admin.js` | A local content editor. Not deployed — see below. |
| `frame-*.jpg`, `steizen-shot.jpg`, `steizen-demo.mp4` | Media used by the case studies and the screenshot rail. |
| `vercel.json` | Security headers (CSP and friends) for Vercel. |
| `_headers`, `_redirects` | The same policy for Netlify, kept for portability. |

## Run it locally

The page reads `content.json`, so it needs HTTP rather than `file://`:

```bash
npx serve .        # or: python -m http.server 8901
```

Then open `http://localhost:3000` (or `:8901`).

## Deploy

```bash
npx vercel --prod
```

`vercel.json` supplies the Content-Security-Policy and the other security headers.
Vercel does not read `_headers` or `_redirects`.

## The editor

`admin.html` is a local tool for editing `content.json` through a form instead of JSON.
Open it over HTTP, enter the password, edit, then use **Export** to download
`content-YYYY-MM-DD.json` and replace `content.json` with it.

It can also save to JSONBin (key and bin ID in its Settings panel), and it keeps an
unsaved draft in `localStorage`.

The login is a convenience gate, not authentication — the password is in the client-side
bundle. Keep the editor out of production: it is excluded from the Vercel upload by
`.vercelignore`, and `_redirects` 404s it on Netlify. If you ever want to edit content
from a deployed site, that needs real server-side authentication.

## Notes

- Both themes are supported; the toggle persists to `localStorage` and animates from the button.
- `prefers-reduced-motion` shortens every animation.
- Old revisions (`backup/`) and development screenshots are ignored by git.

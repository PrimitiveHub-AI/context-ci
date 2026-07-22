# `public/brand/` — identity drop-zone

Drop your favicon / icon / logo assets here **using the exact filenames
below**. The site reads from these paths, so replacing a file (same name)
is all it takes — no code change. Files here are served at
`https://primitivehub.ai/brand/<name>`.

Anything currently in this folder is a **seeded placeholder** (the old
Next-template mark). Overwrite freely.

## Slots the site actively consumes

| Filename | Size / format | Where it's used | Required |
|---|---|---|---|
| `icon.svg` | SVG, ~180×180 viewBox, theme-aware fill | Primary favicon (modern browsers) | ✅ |
| `favicon.ico` | multi-res `.ico` (16+32+48) | Legacy/Windows tab favicon fallback — **drop it and tell Claude to wire it** (not referenced yet, to avoid a 404) | recommended |
| `icon-32.png` | 32×32 PNG | PNG favicon fallback | recommended |
| `apple-icon.png` | 180×180 PNG, opaque bg (no transparency) | iOS "Add to Home Screen" | recommended |
| `icon-192.png` | 192×192 PNG | Android / PWA install icon | optional |
| `icon-512.png` | 512×512 PNG | Android / PWA splash + maskable | optional |
| `logo-mark.svg` | SVG glyph only (square-ish) | Reserved: navbar mark, OG card | optional |
| `logo-wordmark.svg` | SVG "PrimitiveHub" horizontal lockup | Reserved: navbar wordmark swap | optional |

Only the rows Claude has wired into `app/layout.tsx` take effect on drop;
the "Reserved" rows are staged slots — tell Claude to wire them into the
navbar / OG image once you've dropped real art.

## Notes

- **`icon.svg` is theme-aware.** The seeded one flips fill by
  `prefers-color-scheme` (dark bg in light mode, light bg in dark mode).
  Keep that pattern or ship two files if you prefer static colors.
- **Apple touch icons must be opaque** — iOS ignores transparency and
  adds its own rounded corners, so bake a solid background in.
- Raw source art (Figma exports, oversized masters, `.ai`/`.svg` working
  files) that the site should NOT serve goes in `apps/web/assets/brand/`
  instead (not under `public/`), so it isn't shipped to the browser.
- After dropping new files, run `pnpm --filter web build` to confirm no
  broken references, then hard-refresh (favicons cache aggressively).

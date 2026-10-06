# Third-Party Assets & Licenses

## Game code, story and content
All game code, story text, characters, cases, dialogue, UI and design are
original work created for the CASE 404 project. Licensed under the MIT License
(see `LICENSE`), with story and characters (c) the project authors.

## Generated assets
- **Launcher icons & splash** — generated programmatically by
  `scripts/gen_icon.py` (Python/PIL). Original.
- **Audio** — every sound effect and music loop is synthesized at runtime by
  `src/engine/audio.js` using the Web Audio API. No samples, no third-party
  music, nothing copyrighted.

## Third-party packages (npm)
| Package | License | Use |
|---|---|---|
| `@capacitor/core` | MIT | Native shell runtime |
| `@capacitor/android` | MIT | Android platform |
| `@capacitor/cli` | MIT | Build tooling (dev) |

## Fonts
The game uses the device system font stack (`Segoe UI`, Roboto, system-ui and
`ui-monospace` for file numbers). No fonts are bundled, so no font licensing
applies.

## Runtime dependencies at build time
- Python (Pillow) — only for the optional icon generator script, not shipped.
- Playwright — only for the development smoke test, not shipped.

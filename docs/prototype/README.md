# LinguaCompanion UI Prototype v2

Interactive HTML prototype representing the full mobile UI.

## Open locally
```bash
open docs/prototype/index.html
```
Or just double-click `index.html` in Finder/Explorer.

## What's interactive (v2)
- ☀️/🌙 theme toggle — instant CSS variable switch
- Free Chat / Scenario tabs — both populated
- `[📝 Transcribe]` — expands voice transcript
- `[Analyse]` — shows Reconstruction diff + 5 Variant Cards
- Variant Cards — horizontal scroll with drag (fixed in v2)
- `[▶ Listen]` — real TTS via Web Speech API
- `[+ Save]` — toggles saved state with toast notification
- Voice Input Bar — 4 states: text / idle / recording / processing
- Hold-to-record — proper touchstart/touchend + mousedown/mouseup
- Text input → **real Claude API response** (Alex persona, IT context)
- Scenario tab — 6 scenario cards with level badges

## v2 fixes (vs v1)
| Bug | Fix |
|-----|-----|
| Variant cards scroll broken | `margin: 0 -16px` + `overflow-x:auto` on wrapper |
| 💾 icon unclear | Replaced with `+ Save` / `✓ Saved` text |
| No variant subtitle | Added context hint below each phrase |
| Hold mic = two taps | Proper touchstart/mousedown handlers |
| Companion reply = random string | Connected to Claude API (Sonnet 4, Alex persona) |
| Light theme shadows missing | Applied `var(--shadow)` on all cards |
| Scenario tab empty | 6 scenario cards with B1/B2 badges |

## Design tokens reference
See `docs/DESIGN_JOURNEY.md` §10 for full color system.

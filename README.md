# InkBuddy ✍️✨

Handwritten notes with a built-in AI study buddy that **writes back on your page**.

Lasso any handwriting, drawing or typed text → it's re-rendered from the raw pen strokes at high resolution (no blurry screenshots) → send it to **Claude** or **Gemini** → the AI answers in a side panel *and* draws circles, check marks and margin notes directly on your page in "AI ink".

**Killer demo:** write a math problem with a mistake → lasso → **🔍 Find my mistake** → the wrong step gets circled in red with a handwritten note explaining why.

```
swamphacks2026/
├── app/      Expo (SDK 58) tablet app — Skia canvas, S Pen input, agent panel
└── server/   Node/Express — holds API keys, calls Claude / Gemini, returns {reply, annotations}
```

## Run it

**1. Server** (one laptop)
```bash
cd server
cp .env.example .env        # paste ANTHROPIC_API_KEY and GEMINI_API_KEY
npm install
npm run dev                 # http://localhost:8787
ngrok http 8787             # copy the https URL
```

**2a. App on the tablet via web (easiest, one ngrok URL)**
```bash
cd server
npm run build:web           # builds app/dist; the server then hosts it
npm run dev                 # restart after each build:web
ngrok http 8787             # open the https URL in Chrome on the tablet
```
Laptop dev: `cd app && npx expo start --web` → http://localhost:8081 (talks to localhost:8787 automatically).

**2b. App on the tablet via Expo Go** (needs Expo Go for SDK 58)
```bash
cd app
echo EXPO_PUBLIC_API_URL=https://YOUR-ID.ngrok-free.app > .env
npm install
npx expo start              # scan QR with Expo Go on the tablet
```
Everything currently used is bundled in Expo Go. A **dev build** (`npx expo run:android` or `eas build --profile development`) is only needed once we add a custom native module (e.g. ML Kit).

On the tablet: toggle **🖊️ Pen only** so your palm doesn't draw.

## How it works

1. **Ink is vectors.** Each stroke = `[x, y, pressure][]` (S Pen pressure via gesture-handler `stylusData`). Rendered with `perfect-freehand` → Skia path.
2. **Lasso → Chip.** `selectWithLasso` picks strokes ≥50% inside the loop. `renderSelection` redraws *just those strokes* onto an offscreen Skia surface at up to 4× scale on white → PNG. Typed text goes along as text.
3. **Server** sends images + chat history to Claude (forced `respond` tool) or Gemini (JSON schema output). Both return:
   ```json
   { "reply": "...", "annotations": [{ "kind": "circle", "box": [ymin, xmin, ymax, xmax], "color": "red" }], "transcription": "..." }
   ```
   Boxes are normalized 0–1000 relative to the chip image.
4. **AI ink.** `toPageAnnotations` maps boxes back to page coordinates; `annotationPath` draws a hand-drawn-looking circle/box/underline/check/cross that animates in. Notes render in the Caveat handwriting font.

Contract lives in `server/src/schema.ts` ↔ `app/src/lib/api.ts` + `app/src/lib/annotations.ts`. **Change both sides together.**

## Team split (4 people, 2 days)

| Who | Owns | Files | Day 1 | Day 2 |
|---|---|---|---|---|
| **A — Ink** | Drawing feel | `components/InkCanvas.tsx`, `lib/ink.ts` | Test on Tab w/ S Pen, tune pressure/smoothing, palm rejection | Pan/zoom + scrolling page, stroke-segment eraser, S Pen side-button = eraser |
| **B — Selection & context** | What the AI sees | `lib/snapshot.ts`, `lib/ink.ts` (lasso) | Lasso UX, multi-chip, camera/whiteboard import placement & drag | Move/resize lassoed content, auto "page context" (send whole page as low-res background) |
| **C — Agent** | Server + chat | `server/`, `components/AgentPanel.tsx`, `lib/api.ts` | Keys + ngrok, prompt-tune Find my mistake on real handwriting, Markdown + LaTeX rendering | Streaming replies, model compare (Claude vs Gemini side-by-side), voice question |
| **D — AI ink & polish** | The wow | `lib/annotations.ts`, overlays, theming | Calibrate box accuracy, better hand-drawn shapes, arrows | Step-by-step "tutor mode" (AI writes hint lines one at a time), flashcards/quiz from page, demo script + pitch |

## Stretch ideas
- **Live handwriting → text** with Google ML Kit Digital Ink (on-device, works on strokes) — needs a dev build + small Expo native module
- AI **writes in your handwriting style** (stroke-synthesized text instead of a font)
- "Explain this error": photograph a stack trace, AI marks the failing line
- Per-page chat memory → "what did I struggle with this week?"
- Export page + AI ink as PDF

## Known TODOs / gotchas
- Infinite canvas: pinch to zoom/pan (2 fingers), 1 finger scrolls in Pen-only mode; web: wheel = pan, Ctrl+wheel = zoom
- Gemini is wired on the server but hidden in the app (`provider` in `AgentPanel.tsx`)
- Chat replies render as plain text (Markdown/LaTeX not rendered yet)
- Pages persist to AsyncStorage including images as base64 — fine for a demo, move to `expo-file-system` if it gets slow
- Vision models' coordinates are good but not perfect; Gemini tends to be more precise for boxes — compare both

# comfy-mac — session handoff context

Local web app on the Mac that drives **ComfyUI** on a separate Windows GPU PC
(LAN or Tailscale). Run with `npm start` → http://localhost:4242.

## Current state (end of session)

- **git**: branch `main` @ `ed8b352`. Backup branch `backup-session-changes` (@ `32b54c9`)
  holds the work before the last 2 UI commits, in case a rollback is ever needed.
- **server**: started with `npm start`; was connected to **ComfyUI 0.24.1** via Tailscale.
- **The tool works.** Save-to-folder and live step progress are fine (verified with a real render).

## ⚠️ #1 GOTCHA — ComfyUI won't connect after a ComfyUI Desktop update/reboot

This bit us repeatedly. ComfyUI Desktop (now **v0.9.x**, ComfyUI core **0.24.1**) changed its
config folder to `%APPDATA%\Comfy Desktop\` (with a space) and builds the server launch
command from **`installations.json`** there — it **ignores** the old
`…\Documents\ComfyUI\user\default\comfy.settings.json` server settings.

**Symptom:** ComfyUI runs on the PC (localhost works) but is unreachable from the Mac.
**Diagnose (from the Mac):** `curl http://192.168.1.194:8000/system_stats` and the Tailscale IP
`100.65.146.55`. `000` = not listening on the network. On the PC: `netstat -ano | findstr :8000`
→ if it shows `127.0.0.1:8000` it's localhost-only.
**Fix (on the PC):** close ComfyUI fully (tray + kill `python.exe`), edit
`C:\Users\robOT\AppData\Roaming\Comfy Desktop\installations.json`, set the local install's
`"launchArgs"` to include `--listen 0.0.0.0`:
```
"launchArgs": "--listen 0.0.0.0 --port 8000 --enable-manager",
```
Save, relaunch ComfyUI. Verify netstat shows `0.0.0.0:8000`. (CORS not needed — comfy-mac
talks server-to-server; CORS is browser-only.)

## ⚠️ #2 GOTCHA — Mac can't reach the LAN even when ComfyUI is up

Seen after a Mac reboot / VPN use: `curl` reaches `192.168.1.194:8000` (200) but comfy-mac
(Node) gets `EHOSTUNREACH`. Cause: the Mac had a tangled network state (many `en*`/`utun*`
interfaces left by VPN apps; a VPN as default route). **Fix that worked: reboot the Mac**
(clears stale tunnels/routes), keep the VPN off, then `npm start`. Alternatively reopen
Tailscale on both Mac + PC and set the connection dropdown to Auto.

Network facts: PC `laptop-j8h3guqi`, LAN `192.168.1.194`, Tailscale `100.65.146.55`,
account `princess.vega.love`. Mac WiFi `en0` = `192.168.1.108`. Win user = `robOT`,
ComfyUI base dir `C:\Users\robOT\Documents\ComfyUI`.

## What was built this session (commits c6a0c22..ed8b352)

- **"Text to Image with Image" mode** (`text2img-img`) + new workflow **`qwen-image-edit-2511`**
  (two input images: Image 1 + Image 2 reference; 4-step fast toggle). Pulled from ComfyUI
  `/history` and wired into `config.json` + `server/workflows/qwen-image-edit-2511.json`.
- **Mode tabs → dropdown** (`#modeSelect`).
- **Cache-bust** on `/api/image` URLs (`&v=<promptId>`) — fixes stale image when ComfyUI
  recycles a filename (counter resets to `_00001_`).
- **"Recupera ultimi [N]" button** + `GET /api/history?limit=N` — pull the last N renders from
  ComfyUI (recover a batch made while the Mac was asleep). Note: ComfyUI history is in-memory.
- **Live queue counter** chip "⧗ N in coda" + **"✕ Annulla"** (`POST /api/cancel` = clear queue +
  interrupt). `/api/health` now reads the real queue from ComfyUI `/queue` (fixed a stale counter).
- **Watchdog** (`GET /api/prompt-status?id=`) — recovers the UI if a completion event is missed
  (it was freezing on "Loading model…").
- Committed `qwen-image-2512-turbo.json` (was referenced but untracked).

## Adaptive controls — a field is shown only if editing it changes the render

`server/index.js` `/api/config` exposes `has.*` flags + `toggles[].overrides`. `app.js`
`updateConditionalControls()` + `applyWorkflow()` decide visibility:
- **Negative prompt**: shown only when **cfg > 1**. Turbo/distilled models run at cfg 1 where
  CFG is off and the negative is **mathematically ignored** (ComfyUI skips the uncond pass).
- **Denoise**: shown only when there's an input image (img2img / image-edit). For pure text2img
  it's always 1.0.
- **Steps & cfg are ALWAYS shown** (steps influence the render on every model, incl. z-turbo —
  more steps = better image at same seed). Do NOT hide them.
- Qwen-2512 & Qwen-edit's "4-step fast" toggle reroutes steps/cfg through switch nodes to a
  fixed preset (~4 steps, cfg 1), so editing Steps/CFG while it's ON is cosmetic — but the
  fields stay **visible** on purpose (we tried hiding them in fast mode; the user wants them).
  Principle: show everything that influences the render for the chosen model; hide only what's
  truly inert (= the negative at cfg <= 1).
- Audit done: **every visible field in every workflow is wired to a real node AND connected to
  the output path** (no dead/orphan fields).

## Workflows & when the negative actually works

| id | type | cfg | negative effective? |
|---|---|---|---|
| z-image-turbo | text2img | 1 | NO (ignored) |
| flux-schnell | text2img | — | no negative field |
| qwen-image-2512 | text2img | 4 | YES (no in fast mode) |
| qwen-image-2512-turbo | text2img | 1 | no negative field |
| qwen-image-edit-2511 | text2img-img | 4 | YES (no in fast mode) |
| z-image-img2img | img2img | 8 | YES |
| wan-img2vid | img2vid | 5 | YES |

## Negative-prompt investigation (resolved, proven)

User reported: yesterday hundreds of z-turbo photos with a long "no deform" negative → no
deformities; today cyberpunk people on z-turbo → ~50% deformed. **Proven** the negative is
inert on z-turbo (cfg 1): same-seed render with vs without a strong negative = **pixel-identical**
(ffmpeg raw-pixel hash match). Metadata confirms yesterday AND today used the same engine
(z-turbo, cfg 1, 4 steps). The real difference: yesterday's subjects were mostly architecture/
scenes (no anatomy) + people shots from-behind/dark; today's are people-forward cyberpunk on
z-turbo, which has weak anatomy — and the (ignored) negative can't fix it.
**Lever for good people anatomy:** use **qwen-2512** (negative works + better anatomy), or on
z-turbo reroll seed / put anatomy in the positive / add steps. NOT the negative.
(Offered but not run: re-render one of today's deformed shots with the same seed + the long
negative to show pixel-identical = final per-case proof.)

## Creative work in progress

A scene series: a grassy meadow / cliff "plate" with a **solid flat sky for chroma key**
(magenta `#ff0099`, chosen so it doesn't clash with green grass / blue sea). Scenes built:
red London phone box on a cliff (sea behind, magenta sky); a woman in tight red leather +
black boots (back to camera, no face) near / inside the phone box; the same woman dancing,
grim, in a dark dystopian disco among shadowy figures.
- **User wants PROMPTS, not auto-generation** — give the positive/negative text, don't render
  for them unless asked.
- For continuity of an existing plate use the **image-edit** mode (input image + edit
  instruction); for a new angle/scene use text2img with a fully descriptive prompt.
- A seed only reproduces an image if **all** params match (size included) — seeds are
  resolution-dependent.

## Open / unfinished

- **DaVinci Resolve task (NOT done):** Project `thephonebox2` (Resolve 21, bridge connected),
  Timeline 2 = one clip `s1_00020_.png` with a Fusion comp (a moon-1.png animation). User wants
  to apply "the same mild distortion as a previous picture" to the grass. Blocker: the DaVinci
  MCP bridge can't author Fusion nodes/masks granularly (only list/export/import whole comps),
  and the "previous distortion" wasn't identified. Next step would be to switch to Timeline 1 /
  export its Fusion comp to read the exact distortion node + params.
- The **gstack `/browse`** headless browser is currently broken on this Mac (`npx playwright
  install` needed) — UI changes were verified via logic simulation instead.

## Working norms (this user)

- Direct, low-patience, wants targeted minimal changes and proof over assertions. Verify claims
  empirically (render tests, file metadata) rather than insisting.
- Privacy-sensitive: do NOT display/fetch/keep private renders; clean up temp files.
- Default save folder: `/Users/roberto/io/local-labs/ai-comfy`.
- Use gstack `/browse` for any web browsing; never `mcp__claude-in-chrome__*`.

# comfy-mac

A local web app on the Mac that drives **ComfyUI** running on a separate GPU PC, over the
LAN at home or remotely via Tailscale. Send prompts/images from the Mac, the PC renders,
images/videos come back, get saved, and can be snapshotted to recreate later.

## Run

```bash
npm start            # → http://localhost:4242
```

Requirements at run time: the PC is on/awake with **ComfyUI Desktop open**, and **Tailscale
running** on both Mac and PC (only needed for the Tailscale connection option).

## Architecture

- **Backend** — Node + Express (ESM): `server/index.js` (HTTP API + SSE) and
  `server/comfy.js` (ComfyUI HTTP + websocket client). Proxies images/videos, streams progress.
- **Frontend** — vanilla `public/{index.html,app.js,styles.css}`. No build step.
- **ComfyUI** (the PC) — Windows 11, ComfyUI Desktop, RTX 4080 Laptop (12 GB), listening on
  `0.0.0.0:8000`. The Mac never exposes anything publicly; remote access is via Tailscale.

Config lives in `config.json`: connection hosts, save folders, and the workflow registry.
Each workflow maps UI fields → ComfyUI node IDs; the API-format graph templates are in
`server/workflows/`.

## Modes & workflows

Top-level **Mode** dropdown filters the Workflow dropdown.

| id | mode | notes |
|---|---|---|
| `z-image-turbo` | text2img | positive + negative (cfg 1 → negative inert) |
| `flux-schnell` | text2img | single prompt |
| `qwen-image-2512` | text2img | pos/neg, 4-step fast toggle (LoRA) |
| `qwen-image-2512-turbo` | text2img | single prompt |
| `qwen-image-edit-2511` | text2img-img | 2 input images, 4-step fast toggle |
| `z-image-img2img` | img2img | needs input image; output follows input size |
| `wan-img2vid` | img2vid | input image, single Resolution + frames + fps; see WAN notes |

**Add a workflow:** run it once in ComfyUI → pull the API graph from `/history` → save to
`server/workflows/<id>.json` → add a `config.json workflows[]` entry (field map + defaults +
`type`, `promptMode`, optional `toggles`).

## WAN image→video — key facts

The `wan-img2vid` workflow runs the **WAN 2.2 i2v 14B** models (high+low noise, fp8) with
block-swap so it fits 12 GB.

- **Native frame rate is 16 fps.** A **RIFE VFI ×2** node doubles the frames before encoding,
  so the output mp4 must play at **32 fps** to be real-time. Default fps = 32.
  - **Slow-motion bug:** setting fps = 16 with RIFE ×2 active → output plays at half speed.
    Always keep **fps = 32** (= 16 native × 2 RIFE).
- **Duration is set by `frames`** (real seconds ≈ `frames / 16`). Use 4n+1 counts:
  17 (~1s), 25 (~1.5s), 33 (~2s), 49 (~3s), 65 (~4s). Keep fps = 32 regardless.
- **Face quality** is driven by **resolution**, not steps/cfg. At 240 short side faces deform
  (too few pixels). Steps help a little and cost ~no VRAM (time only); CFG ≈ 5 is right and
  raising it tends to worsen faces.
- **VRAM-safe auto** (`config.json → wan-img2vid.vramSafe`): at resolution ≥ 400 the server
  auto-bumps `blocks_to_swap` to 40 (node 128) and enables VAE tiling on the decode (node 158).
  Low-res test renders stay fast. Tune `blocksHigh`/`resThreshold` there if needed.
- **Export** select (img2vid only):
  - **Video (mp4)** — RIFE-interpolated, 32 fps.
  - **Video (mp4) + last frame (PNG lossless)** — also saves the final decoded frame as
    `<prefix>_lastframe_NNNNN_.png`, straight from the clean decode (node 158, not from the
    compressed mp4). Use it as the next segment's input image to chain clips at full quality.
  - **PNG sequence** — drops the mp4, saves all raw decoded frames as lossless PNG.

## Controls

All visible (no "Advanced"). Shown adaptively per workflow via `has.*` flags from `/api/config`:
prompts, seed + random, images-per-prompt, size (or single Resolution for img2vid), denoise
(img2img/edit only), steps & cfg (always), sampler, scheduler, input image(s), workflow toggles,
filename prefix, save folder, and the export-format select (img2vid).

Rule: show a field only when editing it changes the render. **Negative** is hidden when inert
(cfg ≤ 1, or a "fast" Lightning toggle on). **Steps & CFG are always shown.**

## History / Packages / VRAM

- **History** (session only): click a thumbnail to restore the full recipe. `×` deletes the
  Mac copy. **Recupera ultimi [N]** pulls the last N renders from ComfyUI (recover a batch made
  while the Mac was asleep).
- **Save package**: `<saveDir>/packages/<name>/` with `render.png|mp4` + `recipe.json`
  (full params + input image as base64). **Import** a `recipe.json` to reproduce a shot.
- **Free VRAM** button (ComfyUI `/free`); status shows VRAM used/total + active host + live
  queue depth, with a **✕ Annulla** to clear/interrupt the queue.

## Default save folder

`config.json → output.saveDirs`: `/Users/roberto/io/local-labs/ai-comfy` (if it exists), else
`~/Pictures/comfy-mac`.

## API (`server/index.js`)

`/api/config`, `/api/health`, `/api/generate`, `/api/upload`, `/api/image` (proxy, Range for
video), `/api/delete`, `/api/free`, `/api/host`, `/api/package`, `/api/history`, `/api/cancel`,
`/api/prompt-status`, `/api/stream` (SSE).

## Gotchas

- **ComfyUI unreachable after a Desktop update** — it now reads `%APPDATA%\Comfy Desktop\
  installations.json`; set `launchArgs` to include `--listen 0.0.0.0`. See `CONTEXT.md`.
- **Mac can't reach LAN though `curl` can** — tangled network/VPN routes; reboot the Mac, VPN off.
- WAN first run is slow (~1–2 min loading two 14B models). Video is VRAM-heavy: test small,
  then export bigger.

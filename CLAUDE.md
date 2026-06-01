# comfy-mac

A local web app on the Mac that drives **ComfyUI** running on a separate GPU PC, over the
LAN at home or remotely via Tailscale. Send prompts/images from the Mac, the PC renders,
images/videos come back, get saved, and can be snapshotted to recreate later.

## Run

```
npm start            # → http://localhost:4242
```

Requirements at run time: the PC is on/awake with **ComfyUI Desktop open**, and **Tailscale
running** on both Mac and PC (only needed for the Tailscale connection option).

## Architecture

- **Backend**: Node + Express (ESM), `server/index.js` + `server/comfy.js` (ComfyUI HTTP +
  websocket client). Talks to ComfyUI, proxies images/videos, streams progress via SSE.
- **Frontend**: vanilla `public/{index.html,app.js,styles.css}`. No build step.
- **ComfyUI** (the PC): Windows 11 Home, ComfyUI Desktop, RTX 4080 Laptop (12 GB). Configured
  to listen on `0.0.0.0:8000` with CORS `*` (set in ComfyUI Desktop → Server-Config).

The Mac never exposes anything publicly. Remote access is via **Tailscale** (private mesh).

## Connection (top-right dropdown)

`config.json → comfy.hosts`: **Home (LAN)** `192.168.1.194` and **Remote (Tailscale)**
`100.65.146.55`. Modes: **Auto** (probes LAN first, falls back to Tailscale), or force a host.
Switching reconnects live (no restart). Tailscale: account `princess.vega.love`,
PC=`laptop-j8h3guqi` (`100.65.146.55`), Mac=`robertos-macbook-pro` (`100.76.161.95`).

## Modes & workflows

Three top-level tabs: **Text to Image · Image to Image · Image to Video**. The Workflow
dropdown is filtered by the active mode. Workflows live in `config.json → workflows[]`,
each mapping UI fields to ComfyUI node IDs; templates (API-format graphs) in `server/workflows/`.

| id | mode | notes |
|---|---|---|
| `z-image-turbo` | text2img | positive + negative |
| `flux-schnell` | text2img | single prompt (no negative, no cfg) |
| `qwen-image-2512` | text2img | pos/neg, **4-step fast toggle** (LoRA), default negative prefilled |
| `z-image-img2img` | img2img | needs an **input image**; output size follows the input |
| `wan-img2vid` | img2vid | input image, **single Resolution** + frames + fps, **two seeds locked together**, **video (mp4) output** |

**To add a workflow**: run it once in ComfyUI → pull the API graph from `/history` → save to
`server/workflows/<id>.json` → add an entry to `config.json workflows[]` with field map +
defaults (+ `type`, `promptMode`, optional `toggles`).

## Controls

All visible (no "Advanced" section). Adaptive per workflow via `has.*` flags from `/api/config`:
- Prompts (positive always; negative when present; relabeled "Prompt" for single-prompt models)
- Seed + 🎲 random; **Images per prompt** (count; rendered sequentially = VRAM-safe)
- **Size** W×H + presets — **IG (1080×1920) is first and the default size** — OR single
  **Resolution** (img2vid) OR none (img2img follows the input image)
- **Denoise slider** (key for img2img); steps, cfg, sampler, scheduler
- **Input image** dropzone (img2img/img2vid): uploaded to ComfyUI via `/api/upload`
- Workflow **toggles** (checkboxes), e.g. Qwen's 4-step fast mode
- Filename prefix; **Save to** folder

## Render / Batch / History / Packages

- **Render** vs **Batch** sub-tabs. Batch = queue many prompts; each item × count.
- **History** (session only): click a thumbnail to restore the full recipe (workflow, mode,
  prompts, all settings, seed with randomize off, input image, toggles). `×` deletes the Mac copy.
- **Save package**: writes `<saveDir>/packages/<name>/` with `render.png|mp4` + `recipe.json`
  (full params + input image embedded as base64). **Import**: pick a `recipe.json` → UI is
  reconfigured exactly + input image re-uploaded → Generate reproduces the shot.
- **Free VRAM** button (calls ComfyUI `/free`); status shows VRAM used/total + active host.

## Default save folder

`config.json → output.saveDirs`: `/Users/roberto/io/local-labs/ai-comfy` (used if it exists),
else `~/Pictures/comfy-mac`. Backend picks at startup, exposed as `defaultSaveDir`.

## API (server/index.js)

`/api/config`, `/api/health`, `/api/generate`, `/api/upload`, `/api/image` (proxy, supports
Range for video), `/api/delete`, `/api/free`, `/api/host` (switch connection), `/api/package`,
`/api/stream` (SSE progress).

## Gotchas / notes

- WAN img2vid first run is slow (~1–2 min loading two 14B models; UI shows "Loading model…").
  Video is VRAM-heavy — high res can OOM on 12 GB; test small, then export.
- Qwen fast mode: the result caption says the steps field value (e.g. 50) but the LoRA path
  actually uses 4 — cosmetic only.
- PC reliability for remote: disable the WiFi adapter's power-nap (or use Ethernet) so it stays
  reachable; keep the PC on and ComfyUI open.

## Open ideas (not built)

Per-item workflow choice in batch · history persisted across reloads · a resize node for
img2vid · progress feedback polish.

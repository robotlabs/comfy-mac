# RunPod video workflows — Wan 2.2 + LTX 2.3

Four official ComfyUI templates (verified valid, drag-and-drop) plus model download scripts.

## Files
- `Wan2.2_14B_I2V.json` — Wan 2.2 image→video (hyperrealistic)
- `Wan2.2_14B_T2V.json` — Wan 2.2 text→video
- `LTX2.3_I2V.json`     — LTX 2.3 image→video (fast / artistic)
- `LTX2.3_T2V.json`     — LTX 2.3 text→video
- `download_wan22.sh`   — pulls all Wan 2.2 models into ComfyUI
- `download_ltx23.sh`   — pulls all LTX 2.3 models into ComfyUI

## IMPORTANT: the red errors are MISSING MODEL FILES, not missing nodes
"Value not in list" = the file the node wants isn't on disk. ComfyUI Manager
will NOT fix this (the nodes already exist). You must download the models.

## How to use on RunPod
1. Open the RunPod **web terminal** (or Jupyter terminal).
2. Find your ComfyUI path (usually `/workspace/ComfyUI`). If different:
   `export COMFY=/your/path/ComfyUI`
3. Run the downloader(s):
   ```
   bash download_wan22.sh      # for the Wan workflows
   bash download_ltx23.sh      # for the LTX workflows
   ```
   (Uses aria2c if available — much faster — else wget. Resumable.)
4. In ComfyUI: top menu → Refresh (or restart the pod), then reload the workflow.
5. In the `LoadImage` node, upload YOUR image (the sample one in the template
   doesn't exist — that's the "Invalid image file" error).

## Disk space — get a big network volume
- Wan 2.2 (i2v + t2v, both): ~69 GB
- LTX 2.3: ~43 GB
- All four: ~112 GB  → use a **150 GB+ network volume**.

## Quick fix for the CLIPLoader red box
The Wan template wants `umt5_xxl_fp8_e4m3fn_scaled.safetensors`. You already have
`nsfw_wan_umt5-xxl_fp8_scaled.safetensors` — it's the same encoder. Either:
- click the CLIPLoader dropdown and select the file you already have, OR
- let `download_wan22.sh` fetch the proper-named one.

## GPU
fp8 14B (Wan) and fp8 22B (LTX) run on 24 GB, but for smooth 720p use 48 GB
(A6000 / L40S) or an H100.

---

## Settings cheat-sheet

### Wan 2.2 (your HYPERREALISTIC engine)
Templates ship pre-tuned with the **lightx2v 4-step LoRAs** → fast + sharp out of the box.
- High-noise sampler: steps 0→half, Low-noise sampler: half→total.
- Default: 4 total steps, cfg 1, euler/simple, shift 5. Leave it.
- Want more detail/realism: bump total steps to 8 (set the split to 4),
  keep cfg ~1. Going higher rarely helps with the distill LoRA.
- Want more prompt adherence: raise cfg on the HIGH-noise sampler to 2–3.5,
  keep LOW-noise at cfg 1.
- Resolution: start 640×640 / 81 frames to iterate, then push to 720p.
- Motion amount: shift 3 = more motion, shift 8 = smoother/slower.

### LTX 2.3 (your FAST / ARTISTIC engine)
- Much faster than Wan, great for crazy/stylized ideas and quick iteration.
- Ships with distilled LoRA + cfg 1. Keep defaults; it's tuned.
- Prompt it descriptively — LTX uses a Gemma text encoder and likes rich,
  natural-language prompts (camera, lighting, motion, style).
- For wild/artistic looks, lean on strong style words in the prompt rather
  than cranking cfg.

## One-thing-at-a-time test order (keep res low while testing)
1. Run the template defaults → confirm it's watchable.
2. cfg sweep (Wan high-noise): 1 → 2 → 3.5.
3. steps: 4 → 8.
4. shift: 3 → 5 → 8 (motion feel).
5. Only then raise resolution / frame count.

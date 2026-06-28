# RunPod setup — repeat this every time you create a new pod

Goal: drag-and-drop a workflow → run two terminal commands → generate.
Tested working. No treasure hunt.

---

## What lives where
- The 4 workflow files (`Wan2.2_14B_I2V.json`, `Wan2.2_14B_T2V.json`,
  `LTX2.3_I2V.json`, `LTX2.3_T2V.json`) stay **on your Mac**. You drag them
  into the ComfyUI browser tab — they don't need to be on the pod.
- The **models** (the big files) must be downloaded **onto the pod** every time
  you make a NEW pod, UNLESS you put them on a **network volume** (see bottom).

---

## STEP 1 — Open the pod terminal
RunPod → your pod → **Connect → Web Terminal** (or the Jupyter terminal).

## STEP 2 — Go into the ComfyUI models folder
Try the known path first:
```
cd /workspace/runpod-slim/ComfyUI/models && pwd && ls
```
You should see folders like `diffusion_models  loras  vae  text_encoders  checkpoints`.

If that path doesn't exist on a new template, find it automatically:
```
cd "$(dirname "$(find / -name model_management.py -path '*ComfyUI*' 2>/dev/null | head -1)")/models" && pwd && ls
```
(Use whichever one lands you in a folder that lists `diffusion_models`.)

## STEP 3 — Download the Wan 2.2 models (one command, ~70 GB: i2v + t2v)
```
W=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && W1=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files && wget -c -P text_encoders $W1/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors && wget -c -P vae $W/vae/wan_2.1_vae.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors && wget -c -P loras $W/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors && wget -c -P loras $W/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors
```
(If you only want image-to-video, stop after the 6th wget — the i2v ones.)

## STEP 4 — Download the LTX 2.3 models (one command, ~43 GB)
```
L=https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files && L3=https://huggingface.co/Comfy-Org/ltx-2.3/resolve/main/split_files && wget -c -P checkpoints https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors && wget -c -P latent_upscale_models https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors && wget -c -P text_encoders $L/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors && wget -c -P loras $L/loras/gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors && wget -c -P loras $L3/loras/ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors
```

## STEP 5 — Install LTX custom NODES (only LTX needs this; Wan does not)
LTX uses custom nodes. In ComfyUI: open **Manager → Install Missing Custom Nodes**,
install everything it lists, then **Restart**. (Wan 2.2 uses only built-in nodes,
so it never shows missing nodes — only missing models, which Step 3 covers.)

## STEP 6 — Run a generation
1. In the ComfyUI tab, top menu → **Refresh** (or reload the page) so it sees the new files.
2. Drag the workflow JSON from your Mac into ComfyUI.
3. Red boxes should be gone. If one is still red, click its dropdown and pick the file.
4. `LoadImage` node → upload YOUR image (the sample image error is normal).
5. **Queue Prompt**.

---

## Make it instant next time: use a NETWORK VOLUME (recommended)
If you attach a **RunPod network volume** and ComfyUI's `models` folder lives on it
(e.g. `/workspace/...`), the downloaded models **persist** between pods. Then on a
new pod you SKIP Steps 3–4 entirely — the models are already there. You'd only
re-do Step 5 (LTX nodes) if it's a fresh ComfyUI install.

- First time: create the pod with a network volume mounted at `/workspace`,
  run Steps 1–6 once.
- Every time after: new pod on the SAME volume → models already present → just
  refresh, drag workflow, queue.

This is the difference between "wait 1 hour downloading 110 GB every time" and
"up and running in 2 minutes."

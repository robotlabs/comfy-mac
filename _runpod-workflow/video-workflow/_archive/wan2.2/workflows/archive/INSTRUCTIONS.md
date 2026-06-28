# Wan 2.2 Image-to-Video — working setup (RunPod)

This is exactly what worked. Repeat these steps on every new pod.

## STEP 1 — Open the pod terminal
RunPod → your pod → Connect → Web Terminal.

## STEP 2 — Go into the ComfyUI models folder
```
cd /workspace/runpod-slim/ComfyUI/models && pwd && ls
```
You should see folders like `diffusion_models  loras  vae  text_encoders`.
(If the path differs on a new template, find it:)
```
cd "$(dirname "$(find / -name model_management.py -path '*ComfyUI*' 2>/dev/null | head -1)")/models" && pwd && ls
```

## STEP 3 — Download the Wan 2.2 image-to-video models (one command)
```
W=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && W1=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files && wget -c -P text_encoders $W1/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors && wget -c -P vae $W/vae/wan_2.1_vae.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors
```
Downloads ~38 GB. The two 14 GB files (high_noise / low_noise) are the slow ones.

## STEP 4 — Run it in ComfyUI
1. Top menu → Refresh (or reload the page) so it sees the new files.
2. Drag `Wan2.2_14B_I2V.json` into ComfyUI.
3. Red boxes should be gone. If one stays red, click its dropdown and pick the file.
4. `LoadImage` node → upload your image.
5. Queue Prompt.

---

## Open issue (to fix next)
Output renders in slow-motion — needs a fix to the playback frame rate / frame
count (the video is being created at the wrong fps for its frame count).

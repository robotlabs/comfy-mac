PARTE 1 di 3 - i 2 modelli fun_camera (high + low)

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install -q -U huggingface_hub hf_xet && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors models/diffusion_models && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors models/diffusion_models && echo "OK 1/3 - incolla PARTE 2"
```

PARTE 2 di 3 - vae + umt5 + lightx2v high

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/vae/wan_2.1_vae.safetensors models/vae && dl Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors models/text_encoders && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors models/loras && echo "OK 2/3 - incolla PARTE 3"
```

PARTE 3 di 3 - lightx2v low

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors models/loras && rm -rf .dl && echo "OK wan fun-camera completo - riavvia ComfyUI"
```

PARTE 1 di 2 — modello + encoder + vae

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install -q -U huggingface_hub hf_xet && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Qwen-Image_ComfyUI split_files/diffusion_models/qwen_image_2512_fp8_e4m3fn.safetensors models/diffusion_models && dl Comfy-Org/HunyuanVideo_1.5_repackaged split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors models/text_encoders && dl Comfy-Org/Qwen-Image_ComfyUI split_files/vae/qwen_image_vae.safetensors models/vae && echo "OK parte 1 - ora incolla la PARTE 2"
```

PARTE 2 di 2 — i 2 lora (base + turbo)

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl lightx2v/Qwen-Image-2512-Lightning Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors models/loras && dl Wuli-art/Qwen-Image-2512-Turbo-LoRA-2-Steps Wuli-Qwen-Image-2512-Turbo-LoRA-2steps-V1.0-bf16.safetensors models/loras && rm -rf .dl && echo "OK qwen completo - riavvia ComfyUI"
```

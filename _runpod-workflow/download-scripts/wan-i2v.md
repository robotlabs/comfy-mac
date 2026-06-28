PARTE 1 di 4 — i 2 modelli diffusion (i2v high + low)

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install -q -U huggingface_hub hf_xet && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors models/diffusion_models && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors models/diffusion_models && echo "OK 1/4 - incolla PARTE 2"
```

PARTE 2 di 4 — vae + umt5 + lightx2v high

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/vae/wan_2.1_vae.safetensors models/vae && dl Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors models/text_encoders && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors models/loras && echo "OK 2/4 - incolla PARTE 3"
```

PARTE 3 di 4 — lightx2v low + nodo RIFE (lo installa)

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && export HF_XET_HIGH_PERFORMANCE=1 && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors models/loras && rm -rf .dl && { [ -d custom_nodes/ComfyUI-Frame-Interpolation ] || git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation custom_nodes/ComfyUI-Frame-Interpolation; } && pip install -q -r custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt && echo "OK 3/4 - ORA incolla PARTE 4 (riavvio, carica RIFE)"
```

PARTE 4 di 4 — riavvia ComfyUI (carica RIFE) + disabilita ComfyUI-Manager (che fa crashare). OBBLIGATORIA: senza questa RIFE resta "not found".

```bash
cd /workspace/runpod-slim/ComfyUI && pkill -f main.py; sleep 3; mkdir -p _cn_off; [ -d custom_nodes/ComfyUI-Manager ] && mv custom_nodes/ComfyUI-Manager _cn_off/; source .venv-cu128/bin/activate && nohup python -u main.py --listen 0.0.0.0 --port 8188 --enable-cors-header > /workspace/comfy.log 2>&1 & sleep 12; tail -25 /workspace/comfy.log
```

Quando nel log vedi "To see the GUI go to: http://0.0.0.0:8188" = ComfyUI su con RIFE. Ricarica comfy-mac e lancia WAN i2v.

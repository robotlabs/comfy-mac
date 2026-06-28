#!/usr/bin/env bash
# Wan 2.2 IMAGE-TO-VIDEO — bootstrap completo per pod RunPod nuovo.
# Fa TUTTO: scarica i 6 modelli, installa RIFE + dipendenze, riavvia ComfyUI pulito.
# Idempotente: salta modelli/clone già presenti. ~38 GB la prima volta.
set -e
cd /workspace/runpod-slim/ComfyUI
source .venv-cu128/bin/activate
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files
W21=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files
wget -c -P models/text_encoders    $W21/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
wget -c -P models/vae              $W22/vae/wan_2.1_vae.safetensors
wget -c -P models/diffusion_models $W22/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors
wget -c -P models/diffusion_models $W22/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors
wget -c -P models/loras            $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors
wget -c -P models/loras            $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors
[ -d custom_nodes/ComfyUI-Frame-Interpolation ] || git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation custom_nodes/ComfyUI-Frame-Interpolation
pip install -q -r custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt
pkill -f main.py || true
sleep 3
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
# Quando vedi "To see the GUI go to: http://0.0.0.0:8188" -> ricarica il browser, ricarica il json, Queue.

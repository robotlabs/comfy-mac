#!/usr/bin/env bash
# Wan 2.2 TEXT-TO-VIDEO — bootstrap completo per pod RunPod nuovo.
# Scarica: text encoder + vae (condivisi) + i 4 modelli T2V, installa RIFE, riavvia ComfyUI.
# Idempotente: salta ciò che c'è già (se hai già fatto l'i2v, encoder/vae/RIFE ci sono).
set -e
cd /workspace/runpod-slim/ComfyUI
source .venv-cu128/bin/activate
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files
W21=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files
# --- condivisi (gia' presenti se hai fatto l'i2v) ---
wget -c -P models/text_encoders    $W21/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
wget -c -P models/vae              $W22/vae/wan_2.1_vae.safetensors
# --- T2V (i 4 che mancano) ---
wget -c -P models/diffusion_models $W22/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors
wget -c -P models/diffusion_models $W22/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors
wget -c -P models/loras            $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors
wget -c -P models/loras            $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors
# --- RIFE (per il video fluido; gia' presente se hai fatto l'i2v) ---
[ -d custom_nodes/ComfyUI-Frame-Interpolation ] || git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation custom_nodes/ComfyUI-Frame-Interpolation
pip install -q -r custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt
pkill -f main.py || true
sleep 3
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
# Quando vedi "To see the GUI go to: http://0.0.0.0:8188" -> ricarica il browser, ricarica il json, Queue.

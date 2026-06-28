#!/usr/bin/env bash
# QWEN IMAGE EDIT 2511 — bootstrap completo per pod RunPod nuovo.
# Scarica i 4 modelli e riavvia ComfyUI pulito. NESSUN custom node serve (tutto core).
# Idempotente: salta i modelli già presenti. ~50 GB la prima volta.
set -e
cd /workspace/runpod-slim/ComfyUI
source .venv-cu128/bin/activate
TE=https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders
DM=https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models
LORA=https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main
VAE=https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae
wget -c -P models/text_encoders    $TE/qwen_2.5_vl_7b_fp8_scaled.safetensors
wget -c -P models/diffusion_models $DM/qwen_image_edit_2511_bf16.safetensors
wget -c -P models/loras            $LORA/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors
wget -c -P models/vae              $VAE/qwen_image_vae.safetensors
pkill -f main.py || true
sleep 3
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
# Quando vedi "To see the GUI go to: http://0.0.0.0:8188" -> ricarica il browser, ricarica il json, Queue.

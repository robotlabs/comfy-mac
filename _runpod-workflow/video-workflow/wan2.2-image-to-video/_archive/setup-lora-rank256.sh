#!/usr/bin/env bash
# Wan 2.2 I2V — lora lightning NUOVA (260412 rank_256, HIGH+LOW) per piu' movimento.
# Drop-in: stessa architettura split della v1, ma rank 256 (molta piu' capacita').
# Scarica le 2 lore con nomi -o forzati (HF Xet), poi RIAVVIA ComfyUI cosi' le registra.
# Idempotente: aria2c -c riprende; la 2a volta salta cio' che c'e' gia'.
set -e
apt-get update && apt-get install -y aria2 || true
cd /workspace/runpod-slim/ComfyUI/models
KJ=https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/LoRAs/Wan22_Lightx2v
aria2c -x16 -s16 -c -d loras -o Wan_2_2_I2V_A14B_HIGH_lightx2v_4step_lora_260412_rank_256_fp16.safetensors $KJ/Wan_2_2_I2V_A14B_HIGH_lightx2v_4step_lora_260412_rank_256_fp16.safetensors
aria2c -x16 -s16 -c -d loras -o Wan_2_2_I2V_A14B_LOW_lightx2v_4step_lora_260412_rank_256_fp16.safetensors  $KJ/Wan_2_2_I2V_A14B_LOW_lightx2v_4step_lora_260412_rank_256_fp16.safetensors
echo "--- loras 260412 presenti ---"; ls -la loras | grep 260412 || echo "ATTENZIONE: file non trovati!"
echo "--- riavvio ComfyUI (registra le lore nuove) ---"
pkill -f main.py || true; sleep 3
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header

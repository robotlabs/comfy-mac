#!/usr/bin/env bash
# LTX-2.3 TEXT-TO-VIDEO — bootstrap completo per pod RunPod nuovo.
# Scarica i 5 modelli LTX-2.3 (~32 GB) e riavvia ComfyUI pulito.
# Idempotente: salta ciò che c'è già. NIENTE in comune con Wan (download da zero).
# LTX non usa RIFE: genera nativo a 24/25fps + upscaler suo.
set -e
cd /workspace/runpod-slim/ComfyUI
source .venv-cu128/bin/activate
LTX23=https://huggingface.co/Comfy-Org/ltx-2.3/resolve/main/split_files
LTX2=https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files
wget -c -P models/checkpoints           https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors
wget -c -P models/latent_upscale_models https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors
wget -c -P models/text_encoders         $LTX2/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors
wget -c -P models/loras                 $LTX2/loras/gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors
wget -c -P models/loras                 $LTX23/loras/ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors
pkill -f main.py || true
sleep 3
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
# Quando vedi "To see the GUI go to: http://0.0.0.0:8188" -> ricarica il browser, ricarica il json, Queue.

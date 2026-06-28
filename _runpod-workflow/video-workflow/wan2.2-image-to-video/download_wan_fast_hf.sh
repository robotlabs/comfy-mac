#!/usr/bin/env bash
# WAN 2.2 i2v — setup completo VELOCE col motore nativo HuggingFace (hf_transfer + Xet,
# chunk paralleli), lo STESSO che usa ComfyUI quando draggi LTX. Niente wget single-stream.
# Fa TUTTO: 6 modelli + nodo RIFE + dipendenze + riavvio pulito di ComfyUI.
# Versione one-liner equivalente nel README (per il web terminal di runpod che spezza i multilinea).
#   bash download_wan_fast_hf.sh
set -e

cd /workspace/runpod-slim/ComfyUI
source .venv-cu128/bin/activate

# Motore veloce (Rust, multi-connessione). La env-var e' LA chiave: senza, hf va lento come wget.
pip install -q -U "huggingface_hub[hf_transfer]" hf_xet
export HF_HUB_ENABLE_HF_TRANSFER=1
HF=$(command -v hf || echo huggingface-cli)

# hf download mantiene la sotto-cartella del repo -> scarico in .dl e sposto nella cartella giusta.
dl() { # $1=repo  $2=path-nel-repo  $3=cartella-destinazione
  mkdir -p "$3"
  $HF download "$1" "$2" --local-dir .dl
  mv -f ".dl/$2" "$3/$(basename "$2")"
}

W22=Comfy-Org/Wan_2.2_ComfyUI_Repackaged
W21=Comfy-Org/Wan_2.1_ComfyUI_repackaged
dl $W22 split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors models/diffusion_models
dl $W22 split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors  models/diffusion_models
dl $W22 split_files/vae/wan_2.1_vae.safetensors                                       models/vae
dl $W21 split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors              models/text_encoders
dl $W22 split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors   models/loras
dl $W22 split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors    models/loras
rm -rf .dl

# Nodo RIFE (custom node) — il workflow lo usa; va clonato e ComfyUI riavviato.
[ -d custom_nodes/ComfyUI-Frame-Interpolation ] || git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation custom_nodes/ComfyUI-Frame-Interpolation
pip install -q -r custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt

# Riavvio pulito (i custom node si caricano solo all'avvio).
pkill -f main.py || true
sleep 3
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header

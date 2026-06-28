#!/usr/bin/env bash
# WAN 2.2 i2v — i 3 file che mancano sul PC LAN per girare il workflow runpod (wan2.2-i2v).
#   - 2 lora lightx2v 4-step (high + low)
#   - encoder umt5_xxl_fp8_e4m3fn_scaled
# Lancialo SULLA macchina LAN, DALLA root di ComfyUI (la cartella che contiene `models/`).
# Idempotente: wget -c riprende/salta quello che c'è già. ~7.5 GB la prima volta.
set -e

# Se non sei già nella root di ComfyUI, passala come argomento:  ./setup-local-lan.sh /path/to/ComfyUI
[ -n "$1" ] && cd "$1"
[ -d models ] || { echo "ERRORE: non trovo ./models — lancialo dalla root di ComfyUI (o passala come argomento)"; exit 1; }

W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files
W21=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files

mkdir -p models/loras models/text_encoders

wget -c -P models/loras         "$W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
wget -c -P models/loras         "$W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"
wget -c -P models/text_encoders "$W21/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"

echo
echo "FATTO. Torna in ComfyUI e premi 'Refresh' sul pannello Missing Models."

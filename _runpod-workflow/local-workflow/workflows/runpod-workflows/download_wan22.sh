#!/usr/bin/env bash
# Download all models for the Wan 2.2 14B I2V + T2V templates.
# Run this in the RunPod terminal (web terminal or Jupyter terminal).
#
#   bash download_wan22.sh
#
# Set COMFY to your ComfyUI install path if it's not the default below.
set -e
COMFY="${COMFY:-/workspace/ComfyUI}"
M="$COMFY/models"

# Prefer aria2c (fast, parallel) if present; fall back to wget.
dl() {  # dl <url> <dest_dir>
  local url="$1" dir="$2"
  mkdir -p "$dir"
  local name; name="$(basename "$url")"
  if [ -f "$dir/$name" ]; then echo "✓ already have $name"; return; fi
  echo ">>> $name"
  if command -v aria2c >/dev/null 2>&1; then
    aria2c -x16 -s16 -k1M --continue=true -d "$dir" -o "$name" "$url"
  else
    wget -c -O "$dir/$name" "$url"
  fi
}

WAN22="https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files"
WAN21="https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files"

# --- Shared (used by BOTH i2v and t2v) ---
dl "$WAN21/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" "$M/text_encoders"
dl "$WAN22/vae/wan_2.1_vae.safetensors"                          "$M/vae"

# --- Image-to-Video ---
dl "$WAN22/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors" "$M/diffusion_models"
dl "$WAN22/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"  "$M/diffusion_models"
dl "$WAN22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"   "$M/loras"
dl "$WAN22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"    "$M/loras"

# --- Text-to-Video ---
dl "$WAN22/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors" "$M/diffusion_models"
dl "$WAN22/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"  "$M/diffusion_models"
dl "$WAN22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors" "$M/loras"
dl "$WAN22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors"  "$M/loras"

echo ""
echo "Done. In ComfyUI: click the menu > Refresh (or restart), then reload the workflow."
echo "If a dropdown is still red, click it and pick the matching file you just downloaded."

#!/usr/bin/env bash
# Download all models for the LTX-2.3 I2V + T2V templates.
# Run this in the RunPod terminal:
#
#   bash download_ltx23.sh
#
set -e
COMFY="${COMFY:-/workspace/ComfyUI}"
M="$COMFY/models"

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

LTX23="https://huggingface.co/Comfy-Org/ltx-2.3/resolve/main/split_files"
LTX2="https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files"

dl "https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors"          "$M/checkpoints"
dl "https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors" "$M/latent_upscale_models"
dl "$LTX2/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors"                                            "$M/text_encoders"
dl "$LTX2/loras/gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors"                                 "$M/loras"
dl "$LTX23/loras/ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors"             "$M/loras"

echo ""
echo "Done. Refresh/restart ComfyUI, reload the workflow."

# WAN 2.2 i2v - i 3 file mancanti per il ComfyUI locale (Windows).
# Lancialo dalla root di ComfyUI:
#   cd C:\Users\robOT\Documents\ComfyUI
#   powershell -ExecutionPolicy Bypass -File .\download_wan_local.ps1
# Idempotente: curl -C - riprende/salta quello gia' scaricato. ~7.5 GB la prima volta.
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "models\loras","models\text_encoders" | Out-Null
$b22 = "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files"
$b21 = "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files"

curl.exe -L -C - -o "models\loras\wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors" "$b22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
curl.exe -L -C - -o "models\loras\wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"  "$b22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"
curl.exe -L -C - -o "models\text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors" "$b21/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"

Write-Host "FATTO. In ComfyUI premi Refresh sul pannello Missing Models."

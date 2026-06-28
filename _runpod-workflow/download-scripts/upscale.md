```bash
cd /workspace/runpod-slim/ComfyUI && mkdir -p models/upscale_models && curl -L -C - -o models/upscale_models/RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth && curl -L -C - -o models/upscale_models/RealESRGAN_x2plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth && echo "=== DONE upscale x2+x4 - riavvia ComfyUI ==="
```

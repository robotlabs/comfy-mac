RESET TOTALE del pod. In ordine: ferma ComfyUI (rilascia i file aperti, se no lo spazio non si libera) -> cancella TUTTI i pesi dei modelli -> svuota tutte le cache (HF, Xet, pip, .dl) -> stampa spazio prima/dopo. NON tocca ComfyUI, custom node, venv. Dopo: riscarichi coi soliti script e riavvii ComfyUI (il comando per riavviarlo te lo stampa alla fine).

```bash
cd /workspace/runpod-slim/ComfyUI && echo "PRIMA:" && df -h /workspace | tail -1; pkill -f main.py; sleep 3; find models -type f \( -iname "*.safetensors" -o -iname "*.pth" -o -iname "*.gguf" -o -iname "*.ckpt" -o -iname "*.bin" \) -delete; rm -rf .dl ~/.cache/huggingface /root/.cache/huggingface ${HF_HOME:+$HF_HOME/hub} ~/.cache/pip 2>/dev/null; echo "DOPO (ComfyUI fermato):" && df -h /workspace | tail -1; echo "RIAVVIA ComfyUI con: python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header"
```

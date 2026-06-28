AVVIA / RIAVVIA ComfyUI sul pod. UNICO comando da usare sempre (anche su pod nuovo).
Fa 3 cose: (1) ammazza ogni ComfyUI gia' in esecuzione (niente "address already in use"), (2) disabilita ComfyUI-Manager spostandolo in _cn_off (e' lui che fa crashare l'avvio su questo pod), (3) avvia UNO solo in background con tutti gli altri custom node (RIFE incluso). Stampa il log per conferma.

```bash
cd /workspace/runpod-slim/ComfyUI && pkill -f main.py; sleep 3; mkdir -p _cn_off; [ -d custom_nodes/ComfyUI-Manager ] && mv custom_nodes/ComfyUI-Manager _cn_off/; source .venv-cu128/bin/activate && nohup python -u main.py --listen 0.0.0.0 --port 8188 --enable-cors-header > /workspace/comfy.log 2>&1 & sleep 12; tail -25 /workspace/comfy.log
```

Quando nel log vedi "To see the GUI go to: http://0.0.0.0:8188" = ComfyUI su (gira in background, puoi chiudere il terminale).
Rivedi il log: tail -40 /workspace/comfy.log
Nota: ComfyUI-Manager non serve per renderizzare; resta in _cn_off. Per riattivarlo: mv _cn_off/ComfyUI-Manager custom_nodes/

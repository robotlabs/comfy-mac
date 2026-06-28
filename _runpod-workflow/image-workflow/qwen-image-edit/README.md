# Qwen Image Edit 2511 — pod RunPod da zero

Cartella autonoma. Pod slim RunPod, GPU rif RTX 6000 Ada 48GB, ComfyUI in
`/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`. È il **template ufficiale Comfy
Qwen-Image-Edit 2511** (edit a 1 o 2 immagini di riferimento, Lightning 4 step).

**Flusso:** crea pod → apri ComfyUI → dragga il json → incolla 1 blocco nel web
terminal → quando riparte, carica le immagini, Queue. Fine.

---

## 1. Dragga il workflow
`QWEN_image-edit.json` in ComfyUI.

## 2. Incolla QUESTA UNICA RIGA nel web terminal
Scarica i **4 modelli** (~30 GB, modello in fp8mixed), ammazza il ComfyUI vecchio, riavvia pulito.
Idempotente (la 2ª volta salta ciò che c'è già). Una riga = il web terminal non la
spezza (NON incollare script multilinea, il paste si desincronizza).

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && \
wget -c -P models/text_encoders    https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors && \
wget -c -P models/diffusion_models https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors && \
wget -c -P models/loras            https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors && \
wget -c -P models/vae              https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors && \
pkill -f main.py; sleep 3; python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```

> ⚠️ Quella riga fa `pkill` + riavvio → **NON usarla se c'è un render in corso**. In
> quel caso usa il blocco **solo-download** qui sotto (in un 2° terminale) e riavvia dopo.

### ⚡ Alternativa più veloce — aria2c (DA PROVARE)
Stessa cosa ma con download multi-connessione (16 conn/file): se HF ti limita la
singola connessione (`wget` che striscia a 20–50 MB/s) qui voli; se invece sei già a
banda piena cambia poco. Non peggiora mai. `-c` = resume come `wget -c`.
```bash
apt-get install -y aria2; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && \
aria2c -x16 -s16 -c -d models/text_encoders    https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors && \
aria2c -x16 -s16 -c -d models/diffusion_models https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors && \
aria2c -x16 -s16 -c -d models/loras            https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors && \
aria2c -x16 -s16 -c -d models/vae              https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors && \
pkill -f main.py; sleep 3; python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```
> Se `apt-get install aria2` fallisce (no rete/permessi), torna al blocco `wget` sopra.

### Solo-download (NON riavvia, sicuro durante un render)
```bash
cd /workspace/runpod-slim/ComfyUI/models && \
wget -c -P text_encoders    https://huggingface.co/Comfy-Org/HunyuanVideo_1.5_repackaged/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors && \
wget -c -P diffusion_models https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors && \
wget -c -P loras            https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors && \
wget -c -P vae              https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors && \
echo "✅ modelli scaricati — riavvia ComfyUI quando il render è finito"
```

## 3. Quando vedi `To see the GUI go to: http://0.0.0.0:8188`
Ricarica il browser → ricarica il json → niente più rosso → carica le immagini nei
**LoadImage** → **Queue**.

> ⏱️ Il **primo** Queue dopo l'avvio è lento (carica il modello in VRAM). Dal secondo
> run in poi è molto più rapido.

## RIAVVIO COMFYUI (dopo aver scaricato modelli a ComfyUI già avviato)
I modelli nuovi compaiono solo riavviando. Quando NON c'è render in corso:
```bash
pkill -f main.py; sleep 3; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```

---

## I 4 modelli (esatti, letti dai nodi del json)
| Cartella | File | ~Dim |
|---|---|---|
| text_encoders | qwen_2.5_vl_7b_fp8_scaled.safetensors | ~9 GB |
| diffusion_models | qwen_image_edit_2511_fp8mixed.safetensors | ~20 GB |
| loras | Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors | ~1 GB |
| vae | qwen_image_vae.safetensors | ~250 MB |

## Modello: fp8mixed di default (NON il bf16)
Il json punta all'**fp8mixed (~20 GB)** — "sensitive layers kept in high precision",
qualità praticamente identica al bf16 ma metà di RAM/VRAM (il bf16 da ~40 GB satura la
RAM di sistema del pod in fase di caricamento → niente download del mostro per nulla).
Se un giorno vuoi la massima qualità assoluta e hai RAM da vendere, scarica il bf16 e
selezionalo nel nodo loader (diffusion_models):
```bash
aria2c -x16 -s16 -c -d /workspace/runpod-slim/ComfyUI/models/diffusion_models https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_bf16.safetensors
```

## Settings (già bakati nel json)
Lightning **4 step**, **CFG 1.0** (la lora Lightning gira a CFG basso, pochi step).

### 1 o 2 immagini — la 2ª è OPZIONALE (default: spenta)
Il 2° `LoadImage` (nodo 83) è in **bypass di default** → puoi lavorare con **una
sola immagine** senza errori: carica la tua nel **1° LoadImage** (nodo 41) e Queue.
La 2ª immagine alimenta solo i reference dell'encoder `TextEncodeQwenImageEditPlus`
(image2, che è un input opzionale), NON il latent → per questo si può saltare.

- **1 immagine** (default): carica nel 1° LoadImage → Queue. Fine.
- **2 immagini**: seleziona il 2° LoadImage (è grigio/bypassato) → **Ctrl+B** per
  riattivarlo → carica la 2ª immagine → Queue. Per tornare a 1 sola, Ctrl+B di nuovo.

> ⚠️ NON cancellare il collegamento del 2° LoadImage: il bypass (Ctrl+B) è il modo
> giusto — tiene il cablaggio e lo riattivi in 1 tasto. `leather_sofa.png` /
> `texture_fur.png` sono solo placeholder, sostituiscili con le tue.

## GOTCHA (gli stessi del setup video — riassunto)
1. **Path fisso** `/workspace/runpod-slim/ComfyUI`.
2. **Crash all'avvio "NVIDIA driver too old (found version 12080)"** — capita spesso sui
   pod nuovi. Fix (1 riga) poi riavvia:
   ```bash
   cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
3. **"address already in use :8188"** = il pod avvia un ComfyUI suo all'avvio → va
   ammazzato (`pkill -f main.py`) prima di rilanciare. Per questo il blocco lo fa.
4. **Un crash NON è "rifare tutto".** I modelli restano su disco: mai riscaricarli.
5. Nessun custom node richiesto: il bottone **Refresh** del browser basta per vedere i
   modelli nuovi senza riavviare (a differenza dei workflow video con RIFE).

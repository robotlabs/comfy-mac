# Wan 2.2 — TEXT-TO-VIDEO — pod RunPod da zero

Cartella autonoma. Pod slim RunPod, GPU rif RTX 6000 Ada 48GB, ComfyUI in
`/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`.

**Flusso:** crea pod → apri ComfyUI → dragga il json → incolla 1 riga nel web
terminal → quando riparte, scrivi il prompt → Queue. Fine.

Differenza dall'i2v: **niente immagine**, parti dal testo. Usa **modelli T2V dedicati**
(diversi dagli i2v). Encoder `umt5` + vae sono condivisi con l'i2v.

---

## 1. Dragga il workflow
`WAN2.2_text-to-video.json` in ComfyUI.

## 2. Incolla QUESTA UNICA RIGA nel web terminal
Lo script `setup.sh` è su un gist GitHub: questa riga lo scarica ed esegue.
Una riga = il web terminal non la spezza (NON incollare script multilinea, si desincronizza).

```bash
wget -O ~/wan_t2v.sh https://gist.githubusercontent.com/robotlabs/61ffcf9ab2b29ec6bb78fcc04ff12901/raw/setup.sh && bash ~/wan_t2v.sh
```

Fa tutto: 4 modelli T2V + encoder/vae condivisi (saltati se già presenti) + RIFE +
riavvio pulito. Idempotente. Se sei sullo stesso pod dove hai già fatto l'i2v,
scarica davvero solo i 4 file T2V nuovi (~20 GB).

> 🔗 Gist e `setup.sh` locale vanno allineati a mano. Se modifichi `setup.sh`:
> `gh gist edit 61ffcf9ab2b29ec6bb78fcc04ff12901 setup.sh`. L'URL non cambia.
> Spostare la cartella sul Mac NON rompe niente.

## 3. Quando vedi `To see the GUI go to: http://0.0.0.0:8188`
Refresh browser → ricarica il json → niente più rosso → scrivi il prompt → **Queue**.

> ⏱️ Primo Queue dopo l'avvio lento (carica i modelli in VRAM); dal 2° run più rapido.

---

## SE HAI GIÀ FATTO L'I2V su questo pod — scarica SOLO i modelli t2v
Condivisi (`umt5`, `vae`) + RIFE ci sono già dall'i2v → mancano solo i **4 file t2v** (~20GB).
⚠️ NON usare lo `setup.sh`/gist completo se c'è un **render in corso**: fa `pkill` + riavvio →
ammazza il render. Usa questo blocco **solo-download** (in un 2° terminale, NON riavvia):
```bash
cd /workspace/runpod-slim/ComfyUI/models && \
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && \
wget -c -P diffusion_models $W22/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors && \
wget -c -P diffusion_models $W22/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors && \
wget -c -P loras $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors && \
wget -c -P loras $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors && \
echo "✅ modelli t2v scaricati — riavvia ComfyUI DOPO che il render è finito"
```
⚠️ La LoRA t2v è **v1.1** (l'i2v era v1) — diverso, è giusto così.

### ⚡ Alternativa più veloce — aria2c (DA PROVARE, solo-download)
Stessi 4 file ma con download multi-connessione (16 conn/file). Se HF ti limita la
singola connessione (`wget` a 20–50 MB/s) qui voli; se sei già a banda piena cambia
poco. Non peggiora mai. `-c` = resume. NON riavvia (sicuro durante un render).
```bash
apt-get install -y aria2; cd /workspace/runpod-slim/ComfyUI/models && \
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && \
aria2c -x16 -s16 -c -d diffusion_models $W22/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors && \
aria2c -x16 -s16 -c -d diffusion_models $W22/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors && \
aria2c -x16 -s16 -c -d loras $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors && \
aria2c -x16 -s16 -c -d loras $W22/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors && \
echo "✅ t2v via aria2c — riavvia ComfyUI quando il render è finito"
```
> Se `apt-get install aria2` fallisce (no rete/permessi), torna al blocco `wget` sopra.

## RIAVVIO COMFYUI (sempre sempre — dopo aver scaricato modelli a ComfyUI già avviato)
I modelli nuovi compaiono solo riavviando (o Refresh nel browser). Quando NON c'è render in corso:
```bash
pkill -f main.py; sleep 3; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```

## I 4 modelli T2V (esatti, letti dagli errori del json)
| Cartella | File |
|---|---|
| diffusion_models | wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors |
| diffusion_models | wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors |
| loras | wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors |
| loras | wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors |

Condivisi con l'i2v (non riscaricati se già lì): `umt5_xxl_fp8_e4m3fn_scaled` (text_encoders),
`wan_2.1_vae` (vae). ⚠️ La LoRA T2V è **v1.1** (l'i2v era v1).

## Settings (nodo EmptyHunyuanLatentVideo = qui imposti risoluzione e frame)
- risoluzione + frame: **720 × 1280 × 81** (reel 5s) — al posto del LoadImage.
- shift 5 (→3 per più movimento), 4 step (già veloce), fps 16.
- Stessi limiti dell'i2v: max ~5s/81 frame, max 720p.

## Fluidità — RIFE x2 GIÀ BAKATO nel json (come l'i2v)
Catena: VAEDecode → **RIFE x2 (rife47, ×2)** → CreateVideo **@ 32 fps**.
La generazione resta 16 fps / 81 frame (non rallenta); RIFE interpola e raddoppia i
frame → riproduzione a 32 fps = fluido. RIFE è già installato (lo stesso custom node
dell'i2v, scaricato da `setup.sh`); `rife47.pth` si scarica al primo Queue.
⚠️ Il json originale del template NON aveva RIFE (solo CreateVideo a 16fps, scattoso):
è stato aggiunto a mano. Se riscarichi il json dal template, va rifatto.

## Prompting T2V
Qui descrivi TUTTO (non c'è immagine): `Soggetto + Scena + Movimento + Camera + Luce + Stile`,
soggetto per primo, ~25-80 parole.

## GOTCHA #0 — "Enable Lightning LoRA" (ora già su TRUE di default)
L'interruttore **`Enable Lightning LoRA`** (nodo 129, esposto nel pannello, vicino a
`Duration`) sceglie 4 step (LoRA `lightx2v`) vs 20 step lento. Il template originale
partiva su **false** (20 step, lento da morire); **in questo json è stato messo su
true** → 4 step, qualità piena, ≈5× più veloce. Equivale al `turbo` dell'i2v.
Se lo rimetti false torni a 20 step lentissimi.

## GOTCHA (gli stessi dell'i2v — vedi ../wan2.2-image-to-video/README.md)
1. Path fisso `/workspace/runpod-slim/ComfyUI/models`.
2. RIFE = custom node → riavvio (Refresh browser NON basta).
3. cupy fallisce nell'install RIFE → ignoralo (usa `requirements-no-cupy.txt`).
4. "address already in use :8188" → il pod auto-avvia un ComfyUI → `pkill -f main.py` prima.
5. **Crash "NVIDIA driver too old (12080)"** (il più frequente). Fix 1 riga, poi riavvia:
   ```bash
   cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
6. Un crash NON è mai "rifare tutto": modelli + RIFE restano su disco. Mai riscaricare.

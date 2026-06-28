# Wan 2.2 — IMAGE-TO-VIDEO — pod RunPod da zero

Cartella autonoma. Pod slim RunPod, GPU rif RTX 6000 Ada 48GB, ComfyUI in
`/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`.

**Flusso:** crea pod → **incolla la riga di download** (step 1) → apri ComfyUI →
dragga il json → quando ComfyUI riparte, carica l'immagine → Queue. Fine.

---

## 1. ⬇️ SCARICA modelli + setup — UNA RIGA nel web terminal (PRIMA COSA)
**Incolla UNA SOLA riga** (il web terminal spezza i paste multilinea → NON incollare i comandi a mano).
Lo script fa TUTTO: 6 modelli (~38 GB) + custom node RIFE + dipendenze (no-cupy) + ammazza il
ComfyUI vecchio + riavvia pulito. Idempotente (la 2ª volta salta ciò che c'è già).

**▶ hf_transfer + Xet — ⚠️ NUOVO, DA TESTARE** (se funziona dovrebbe andare ~come LTX, molto più di wget). Lo **stesso motore** che usa ComfyUI quando draggi LTX (chunk paralleli Rust + Xet). È **UNA SOLA RIGA** (nessuna newline → si incolla intera nel web terminal). Fa TUTTO: 6 modelli veloci + nodo RIFE + dipendenze (no-cupy) + ammazza il ComfyUI vecchio + riavvia pulito. Idempotente. **Se non va, usa l'aria2c/wget qui sotto (collaudati).**
```bash
pip install -q -U "huggingface_hub[hf_transfer]" hf_xet && export HF_HUB_ENABLE_HF_TRANSFER=1 && cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors models/diffusion_models && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors models/diffusion_models && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/vae/wan_2.1_vae.safetensors models/vae && dl Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors models/text_encoders && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors models/loras && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors models/loras && rm -rf .dl && ([ -d custom_nodes/ComfyUI-Frame-Interpolation ] || git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation custom_nodes/ComfyUI-Frame-Interpolation) && pip install -q -r custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt && pkill -f main.py; sleep 3; python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```
> Perché è veloce: `HF_HUB_ENABLE_HF_TRANSFER=1` + `hf_xet` attivano il download a **chunk paralleli** (come ComfyUI). Senza quella env-var, `hf` va lento come `wget`. `dl()` sposta ogni file nella cartella giusta (`hf` ricrea la sotto-cartella `split_files/…`). Se `hf` non esiste, usa in automatico `huggingface-cli`.

**▶ aria2c — COLLAUDATO (backup sicuro)** (16 connessioni parallele: se HF ti strozza la singola `wget` a 20–50 MB/s, qui voli):
```bash
wget -O ~/wan_i2v.sh https://gist.githubusercontent.com/robotlabs/7799a856c36cca1e0d57d4cd42e27404/raw/setup-aria2.sh && bash ~/wan_i2v.sh
```

**▶ wget — FALLBACK** (se `apt-get install aria2` fallisce / no rete / permessi):
```bash
wget -O ~/wan_i2v.sh https://gist.githubusercontent.com/robotlabs/c399e98f49eede4a083917481cf4bf1c/raw/setup.sh && bash ~/wan_i2v.sh
```

> ⚠️ **Lezione (HF Xet) — perché aria2c usa `-o`:** HF redirige al backend Xet e senza `-o <nome>.safetensors`
> aria2 salva col **nome-hash** dell'URL finale (file senza `.safetensors`) → ComfyUI non li vede
> ("Value not in list ... not in []"). Lo script ce l'ha già. Recupero se è già successo:
> gist `f73b289ea3252792f93a895cf07e7d57` (fix-names.sh) rinomina + riavvia.
> 🔗 **Gist da tenere allineati a mano** se modifichi gli script locali:
> `gh gist edit 7799a856c36cca1e0d57d4cd42e27404 setup-aria2.sh` (aria2c) ·
> `gh gist edit c399e98f49eede4a083917481cf4bf1c setup.sh` (wget). URL invariati. Spostare la cartella NON rompe niente.

## 2. Dragga il workflow
`WAN2.2_image-to-video.json` in ComfyUI.

## 3. Quando vedi `To see the GUI go to: http://0.0.0.0:8188`
Ricarica il browser → ricarica il json → niente più rosso → carica l'immagine
nel **LoadImage** → **Queue**.

> ⏱️ Il **primo** Queue dopo l'avvio è lento (~300s): carica ~30 GB di modelli in
> VRAM. Dal secondo run in poi è molto più rapido (cambia solo seed = caso più veloce).

---

## SE HAI GIÀ FATTO IL T2V su questo pod — scarica SOLO i modelli i2v
Condivisi (`umt5`, `vae`) + RIFE ci sono già dal t2v → mancano solo i **4 file i2v** (~28GB).
⚠️ NON usare lo `setup.sh`/gist completo se c'è un **render in corso**: fa `pkill` + riavvio →
ammazza il render. Usa questo blocco **solo-download** (in un 2° terminale, NON riavvia):
```bash
cd /workspace/runpod-slim/ComfyUI/models && \
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && \
wget -c -P diffusion_models $W22/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors && \
wget -c -P diffusion_models $W22/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors && \
wget -c -P loras $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors && \
wget -c -P loras $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors && \
echo "✅ modelli i2v scaricati — riavvia ComfyUI DOPO che il render è finito"
```

### ⚡ Alternativa più veloce — aria2c (DA PROVARE, solo-download)
Stessi 4 file ma con download multi-connessione (16 conn/file). Se HF ti limita la
singola connessione (`wget` a 20–50 MB/s) qui voli; se sei già a banda piena cambia
poco. Non peggiora mai. `-c` = resume. NON riavvia (sicuro durante un render).
```bash
apt-get install -y aria2; cd /workspace/runpod-slim/ComfyUI/models && \
W22=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && \
aria2c -x16 -s16 -c -d diffusion_models $W22/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors && \
aria2c -x16 -s16 -c -d diffusion_models $W22/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors && \
aria2c -x16 -s16 -c -d loras $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors && \
aria2c -x16 -s16 -c -d loras $W22/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors && \
echo "✅ i2v via aria2c — riavvia ComfyUI quando il render è finito"
```
> Se `apt-get install aria2` fallisce (no rete/permessi), torna al blocco `wget` sopra.

## RIAVVIO COMFYUI (sempre sempre — dopo aver scaricato modelli a ComfyUI già avviato)
I modelli nuovi compaiono solo riavviando (o Refresh nel browser). Quando NON c'è render in corso:
```bash
pkill -f main.py; sleep 3; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```

## GOTCHA imparati (perché il blocco è fatto così)

1. **Path fisso `/workspace/runpod-slim/ComfyUI/models`.** Il trucco
   `find model_management.py` NON va: quel file sta in `comfy/`, non in root.
2. **RIFE serve** (il workflow ha il nodo `RIFE VFI` per il video fluido a 32fps).
   Non è un modello, è un custom node → va clonato e poi **ComfyUI riavviato**
   (i custom node si caricano solo all'avvio: il bottone Refresh del browser NON basta).
3. **cupy fallisce durante l'install di RIFE** ("Unable to detect CUDA / libnvrtc.so.12"):
   IGNORALO. cupy serve solo ad altri metodi VFI (GMFSS), non a RIFE. Per questo il
   blocco usa `requirements-no-cupy.txt`.
4. **"address already in use :8188"** = il pod fa partire un ComfyUI da solo all'avvio.
   Quello stantio tiene la porta e NON ha RIFE caricato → va ammazzato prima di
   riavviare. Per questo il blocco fa `pkill -f main.py` prima di rilanciare.
5. **⚠️ IL PIÙ FREQUENTE — Crash all'avvio "NVIDIA driver too old (found version
   12080)"** (driver host = CUDA 12.8, torch dell'immagine più nuovo). Su questo
   template **capita quasi sempre** sui pod nuovi. Il "ComfyUI crashed — check the
   logs above" è solo il wrapper: l'errore vero è più SOPRA, cerca `too old` / `CUDA`.
   Fix deterministico (1 riga), poi riavvia:
   ```bash
   cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
   Riavvio: `cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header`.
   Alternativa a lotteria: ricrea il pod (host con driver ≥12.9).
6. **Un crash NON è mai "rifare tutto".** Modelli (~38 GB) e RIFE restano su disco:
   un crash all'avvio si risolve solo riavviando/fixando torch. **Mai riscaricare i modelli.**
7. **`WAN21` in console** = nome architettura, non versione. È Wan 2.2, ok.
8. **`FETCH ComfyRegistry Data: x/155`** = il Manager aggiorna la cache in background.
   Non aspettarlo: la GUI è già su appena vedi "To see the GUI go to".
9. **Diagnosi crash in 1 riga** (stampa l'errore vero sotto `==== ERRORE ====`):
   ```bash
   cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header 2>&1 | tee /tmp/c.log; echo "==== ERRORE ===="; grep -iEB2 "error|traceback|cuda|out of memory|killed|exception|too old" /tmp/c.log | tail -40
   ```

---

## I 6 modelli (esatti, letti dai nodi del json)
| Cartella | File |
|---|---|
| text_encoders | umt5_xxl_fp8_e4m3fn_scaled.safetensors |
| vae | wan_2.1_vae.safetensors |
| diffusion_models | wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors |
| diffusion_models | wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors |
| loras | wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors |
| loras | wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors |

## Settings (già bakati nel json, cambiali dal pannello del nodo, NON nel subgraph)
720×1280, duration 5, **turbo true** (4 step ≈ veloce; false → 20 step lentissimi),
cfg 1, shift 5 (↓ per più movimento, vedi sotto), fps 16 = base NON toccare. Positivo =
solo movimento/azione. Negativo = anti-deformazione (già scritto).

## ⚠️ Lo slow-motion i2v — LEGGI prima di smanettare (22 giu 2026: un giorno bruciato qui)
Il video i2v **a 5s sembra al rallentatore**. Non è un bug di frame/fps/RIFE: è **strutturale**
del lora lightning 4-step (il modello anima poco partendo dal fermo + la distillazione "media").
**Tutto questo è stato testato e NON rompe il muro** (dettaglio + json/script in `_archive/`):
- **loraHigh**: 0 = meno moto · 0.7 = slow · ~2.0 = più moto ma slow · 3+ brucia · 5.6 = noise.
- **CFG / shift / risoluzione (480 vs 720)**: spostano qualità/burn, **non** la quantità di moto.
- **lora rank256** (la più nuova/grande): identica alla v1. Inutile, scaricata e scartata.

**Le SCELTE vere (non esiste veloce+fluido+5s in un colpo):**
1. **Veloce + fluido ma ~2.5-3s** → tieni turbo/lightning e alza **fps a 64** (CreateVideo): gli stessi
   frame riprodotti più veloci → moto naturale, clip più corta. (fps 54 ≈ 3s, fps 64 ≈ 2.5s.)
2. **5s con moto vero ma LENTO** → **turbo OFF** (20 step, cfg ~3.5, no lora). In comfy-mac è la voce
   dropdown **"WAN 2.2 Image→Video · HQ"** (tutto già bakato). Render ~5× più lungo.
3. **5s fluido vero** → **concatena 2 clip da ~2.5s** col last-frame (vedi "Video più lunghi").

> In comfy-mac (l'altra UI) i default i2v lightning sono: fps 64, shift 4, lora v1 1.0/1.0, 8 step.

## Test rapido (~1 min invece di ~3)
Pannello: width 480 / height 848 / duration 3, turbo ON. Esce un video → tutto ok →
rimetti 720×1280 / 5s per la qualità.

## 🎥 Fun Camera (controllo camera: zoom/pan/static) — MODELLO ALTERNATIVO opzionale
Modello **diverso** dal base (Alibaba PAI `Wan2.2-Fun-A14B-Control-Camera`): genera col **movimento di camera scelto** (Zoom In/Out · Pan Up/Down/Left/Right · Static + combinazioni, via il nodo nativo `WanCameraEmbedding`).
⚠️ **Non è un superset del base**: è un finetune di CONTROLLO, tarato per **obbedire alla camera e restare aderente all'immagine** → per scene con **movimento libero del soggetto** rende meno del base. Quindi: **base = default**; Fun Camera **solo** quando vuoi muovere la camera. (Solo preset, niente orbita libera — per l'orbita serve LTX Cameraman.)

**Modelli in più che servono (riusa VAE/umt5/lightx2v che HAI GIÀ):**
- `wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors`
- `wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors`

**▶ Modo consigliato (drag-and-go, come LTX):** in ComfyUI → **Workflow → Browse Templates → Video → "Wan 2.2 14B Fun Camera Control"** (o apri il json ufficiale da comfy.org). Essendo template ufficiale, **ti scarica da solo i 2 modelli** (URL embedded, veloce) e usa **solo nodi nativi** → niente custom node. Riusa i file che hai già.

**▶ Pre-download manuale (hf veloce), se vuoi stagliarli prima sul pod** — UNA riga:
```bash
pip install -q -U "huggingface_hub[hf_transfer]" hf_xet && export HF_HUB_ENABLE_HF_TRANSFER=1 && cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && HF=$(command -v hf||echo huggingface-cli) && dl(){ mkdir -p "$3"; $HF download "$1" "$2" --local-dir .dl && mv -f ".dl/$2" "$3/$(basename "$2")"; } && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors models/diffusion_models && dl Comfy-Org/Wan_2.2_ComfyUI_Repackaged split_files/diffusion_models/wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors models/diffusion_models && rm -rf .dl
```
> Se l'URL dà 404, il path della repo è cambiato → usa il drag-and-go del template (URL sempre giusto, lo mette ComfyUI). VRAM: 14B×2 → su runpod (48GB) ok; sul **LOCAL 12GB pesante** (offload, lento, possibile OOM).

**Per averlo anche in comfy-mac:** apri il template ufficiale una volta → **Save (API Format)** → mandami il json → cablo il modulo `wan2.2-fun-camera` (menù Camera Motion + Speed). NON lo scrivo a mano alla cieca: il grafo camera è delicato e il tempo-pod costa.

Riferimenti: [ComfyUI Fun Camera](https://docs.comfy.org/tutorials/video/wan/wan2-2-fun-camera) · [model card](https://huggingface.co/alibaba-pai/Wan2.2-Fun-A14B-Control-Camera).

## Video più lunghi (10s+) — e i2v 5s fluido vero
Wan regge ~5s (81 frame). Per 10s — **o per un 5s davvero fluido** (opzione 3 sopra): genera clip 1,
prendi il `lastframe_xxxx.png` in output, caricalo nel LoadImage come start della clip 2, cambia
prompt, genera, unisci in editor. Una clip = una azione.

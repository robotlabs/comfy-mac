# wan2.2-lab — Wan 2.2 i2v su RunPod (setup + workflow + lezioni)

Tutto quello che serve per rifare il pod da zero e generare video image-to-video
fluidi con Wan 2.2 14B. Niente caccia al tesoro.

GPU di riferimento: **RTX 6000 Ada 48GB** (pod RunPod). Funziona.

---

## FILE — quale usare
| File | Cos'è |
|---|---|
| **`WAN2.2_image-to-video.json`** | ⭐ **QUESTO.** Tutto pronto: parametri esposti nel pannello, valori giusti bakati, RIFE ×2 (fluido), estrazione last-frame PNG. |
| `Wan2.2_I2V_reel_exposed_v2.json` | come v3 ma senza RIFE (video a 16fps, scattoso). |
| `Wan2.2_I2V_reel_exposed.json` | prima versione coi parametri esposti. |
| `Wan2.2_I2V_reel.json` | base, senza parametri esposti. |

Usa **v3**. Gli altri sono storia.

---

## SETUP POD DA ZERO (ogni volta che ricrei la pod)

### 1. Modelli Wan 2.2 i2v — terminale del pod
Trova la cartella models (di solito `/workspace/runpod-slim/ComfyUI/models`):
```
cd /workspace/runpod-slim/ComfyUI/models && pwd && ls
```
Se il path è diverso, trovalo:
```
cd "$(dirname "$(find / -name model_management.py -path '*ComfyUI*' 2>/dev/null | head -1)")/models"
```
Poi scarica (un comando, ~38 GB):
```
W=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && W1=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files && wget -c -P text_encoders $W1/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors && wget -c -P vae $W/vae/wan_2.1_vae.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors && wget -c -P loras $W/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors
```

### 2. Custom node RIFE (per il video fluido)
Serve `ComfyUI-Frame-Interpolation` (autore Fannovel16). Due modi:
- **Manager**: Manager → Custom Nodes Manager → cerca "Frame Interpolation" → Install `ComfyUI-Frame-Interpolation` → Restart.
- **Terminale**:
  ```
  cd /workspace/runpod-slim/ComfyUI/custom_nodes
  git clone https://github.com/Fannovel16/ComfyUI-Frame-Interpolation
  cd ComfyUI-Frame-Interpolation && python install.py
  ```
  Poi riavvia ComfyUI.
- Il modello `rife47.pth` si scarica da solo al primo uso.

### 3. Usa il workflow
- Refresh/restart ComfyUI → trascina **`WAN2.2_image-to-video.json`**.
- Nodo **LoadImage** → carica la tua immagine.
- **Queue Prompt**.

> Nota: i modelli (~38 GB) spariscono quando distruggi il pod. Per non riscaricarli
> ogni volta, tieni la cartella `models` su un **network volume** RunPod.

---

## SETTINGS — pannello del nodo "Image to Video (Wan2.2)"
Valori già bakati in v3 (cambiali dal pannello, NON entrare nel subgraph):

| Campo | Valore | Note |
|---|---|---|
| width / height | 720 / 1280 | reel 9:16. **Max 720p** (Wan non è fatto per 1080) |
| duration | 5 | secondi. **Max affidabile ~5s** |
| turbo | **true** | = modalità 4-step veloce. SE false → 20 step lentissimi |
| steps | 4 | (attivo solo con turbo ON) |
| cfg | 1 | con turbo a 1 il negative quasi non morde |
| shift | 5 | abbassa a 3 per più movimento |
| lora_high / low_strength | 1.0 / 1.0 | abbassa high a 0.7 se il movimento è lento |
| fps | **16 — NON toccare** | è la base di generazione, NON l'fps del video |

Prompt: positivo (casella in alto) = **solo movimento/azione**, non descrivere
ciò che è già nell'immagine. Negativo = anti-deformazione (già impostato).

---

## LEZIONI IMPARATE (i gotcha che ci hanno fatto perdere tempo)
1. **Lento da morire (27 min)** = turbo era OFF → 20 step. **turbo = true → ~3 min.**
2. **1080p non va** = Wan 2.2 è un modello 720p. Genera a 720, fai upscale dopo.
3. **GPU 100% è normale** = sta lavorando, non è bloccata. Guarda la barra step nella console (`x/4`).
4. **Video scattoso / a rallentatore** = 16fps grezzi. **RIFE ×2 + CreateVideo 32fps** → fluido (già in v3).
5. **fps del video = 32, fps di generazione = 16.** Sono due cose diverse. In v3 il 32 è fisso dentro CreateVideo; il campo "fps" del pannello (16) è solo la base frame.
6. **`WAN21` nella console** = nome architettura, NON la versione. È Wan 2.2, ok.
7. **Errori rossi "Value not in list"** = modelli mancanti, NON nodi mancanti. Il Manager non li scarica → vedi step 1.

---

## VIDEO PIÙ LUNGHI (10s+) — concatenazione
Wan regge bene **~5s (81 frame)**. Oltre, la scena si impasta/torna indietro.
Per fare 10s:
1. Genera **clip 1** (5s, azione singola). In output trovi il video + **`lastframe_xxxx.png`** (ultimo frame in qualità piena, pre-compressione).
2. Carica quel PNG nel **LoadImage** come start della **clip 2**.
3. Cambia prompt per la seconda azione, genera.
4. Unisci le due clip in un editor → 10s puliti, attacco perfetto.

Una clip = una azione. Non stipare 3 azioni in 5s (le abbrevia).

---

## ITERAZIONE VELOCE
Per provare prompt/seed senza aspettare: abbassa **width 480 / height 848 / duration 3**
→ ~1 min a render. Trovato il seed buono (togli "randomize", fissa il numero), rimetti
720×1280 / 5s e rigeneri in qualità.

## Se vuoi spingere la velocità (opzionale)
Riavvia ComfyUI con `--highvram` e installa SageAttention (`pip install sageattention`,
poi avvio con `--use-sage-attention`). Riduce il tempo per step. Non necessario:
con turbo ON sei già a ~3 min.

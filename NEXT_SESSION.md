# NEXT SESSION — handoff (RunPod video + comfy-mac integration)

═══════════════════════════════════════════════════════════════
## 🔥 AGGIORNAMENTO 2026-06-21 — t2v slow-motion RISOLTO + TODO domani
═══════════════════════════════════════════════════════════════

### LA SVOLTA: il rallentatore del Wan **t2v** era SHIFT + LoRA, non l'fps
Dopo 2 giorni, le 3 cose che insieme hanno risolto lo slow-motion del t2v:
1. **SHIFT 5 → 3.** ⬅️ IL colpevole principale. Shift alto rende i frame quasi identici
   = congela/rallenta il movimento (confermato da Gemini + community). Shift ~3 = movimento vivo.
2. **LoRA: usare la i2v al posto della t2v.** La `wan2.2_t2v_lightx2v...` rallenta il moto;
   la `wan2.2_i2v_lightx2v_4steps_lora_v1_high/low` applicata sul modello t2v muove molto meglio.
3. **fps nativo giusto: 16 base × RIFE ×2 = 32 fps** in CreateVideo (NON 54/64). 32 era giusto;
   era lo shift a frenare, non l'fps.

### Setup t2v ATTUALE (server/workflows/wan2.2-t2v.json) — funziona
- Modelli t2v 14B fp8 high+low, umt5, wan_2.1_vae.
- **LoRA i2v lightning** (high+low) sul modello t2v. Lightning ON, **8 step** (split 4/4), CFG 1.
- **ModelSamplingSD3 shift = 3.**
- **RIFE VFI ×2** → **CreateVideo 32 fps**.
- Frame count = regola **4k+1** (nativo 16fps): 17=1s · 33=2s · 49=3s · 65=4s · **81=5s**.
- Default UI: frames 81, fps 32, shift 3, loraHigh 1, steps 8, 480×848.

### La LOGICA frame/fps (capita finalmente)
Wan NON aggiunge tempo se aumenti i frame: prende l'azione del prompt e la **distribuisce
sui frame dati** (più frame = stessa azione campionata più fine, non più durata). Quindi a
fps fisso più frame = sembra più lento. Limite duro: **oltre 81 frame** (per 10s) il modello
standard fa **ping-pong / deforma** → per clip lunghe serve concatenare o workflow **SVI**
(sliding context window). Una clip = ~5s max.

### RESIDUO da sistemare DOMANI
- **Il movimento ACCELERA nella seconda metà (da ~sec 3).** Causa probabile: ritmo non
  uniforme della lightning + transizione esperto high→low a metà. Da provare: (a) 2-3 **seed**
  diversi (l'uniformità dipende dal seed), (b) **shift 3→4**, (c) esporre/giocare lo **split_step**
  (boundary high/low), (d) se serve uniformità perfetta → lightning OFF (full diffusion, lento).
- **Last-frame PNG più scuro del video:** il PNG è il decode grezzo (RGB pieno), il video è
  post-encoding mp4 (yuv420p) → il video è "spostato", il PNG è più fedele. Per il chaining va
  bene (clip2 dal PNG → stesso encoding → combacia con clip1). Se si vuole PNG=identico al
  video, estrarre il frame dall'mp4 invece che dal decode.

### TODO OTTIMIZZAZIONE (da Gemini, per la velocità di render sulla A6000/A40 48GB)
1. **480p + Upscale invece di 720p nativo.** Genera a 480×848 (~2 min a 30 step) poi upscale
   con nodo dedicato (SUPIR / AuraSR / tile upscaler). Stessa definizione finale, -70% tempo.
2. **Verificare FP8 (scaled), NON BF16** nel loader: se carica BF16 satura la VRAM e fa
   offloading anche a bassa res. (I nostri usano fp8_scaled — verificare a video.)
3. **Abilitare SageAttention / FlashAttention-2.** Se ComfyUI gira in attention "eager"
   (PyTorch standard) i tempi raddoppiano. Controllare la console del pod all'avvio; nel wrapper
   Kijai c'è il flag SageAttention. Sul ComfyUI nativo: avviare con `--use-sage-attention`
   (richiede `pip install sageattention`).

### comfy-mac — modifiche UI di oggi (tutte UNCOMMITTED)
- t2v ora espone **frames** (mappato su EmptyHunyuanLatentVideo length) + **fps** (CreateVideo),
  niente più "duration". Campi `shift`/`loraHigh`/`cfg`/`steps` esposti.
- **TUTTI i default sono ora autoritativi** in applyWorkflow (app.js): frames/fps/shift/loraHigh/
  steps/cfg prendono il default del workflow e vincono sul valore vecchio del browser (prima
  restavano "appiccicati" valori stantii → grande fonte di confusione).
- **Last-frame**: salvato lato server col **nome del video** (clip_00007_.mp4 → clip_00007_.png),
  + thumbnail auto nell'UI. (server/index.js: saveLastframe()).
- index.js refactor utente: **due processi** — `npm run` local (4242) + `npm run runpod` (4243),
  `/api/reload` ricarica la config senza restart. Cambi di CODICE invece richiedono restart del
  processo (kill PID su :4243 → `npm run runpod`).

### Pod corrente
URL: `https://0juwo39zskdys9-8188.proxy.runpod.net` (A6000 48GB). ⚠️ Cambia a ogni pod nuovo →
aggiornare nel campo RunPod di comfy-mac. Mancava il VAE su un pod (download incompleto) → se
"vae_name not in [pixel_space]", riscaricare `wan_2.1_vae.safetensors`.

═══════════════════════════════════════════════════════════════



Data: 2026-06-20. Due repo coinvolti:
- **comfy-mac** (`~/io/git/robotlabs/comfy-mac`) — l'interfaccia. ⚠️ **MODIFICHE NON COMMITTATE** (vedi sotto).
- **_runpod-workflow** (`~/io/local-labs/ai-comfy/_runpod-workflow/video-workflow`) — cartelle workflow + setup pod.

---

## ⚠️ PRIMA COSA: comfy-mac ha un sacco di lavoro UNCOMMITTED
Tutto testato lato API, server gira (`npm start` → :4242). Da committare quando l'utente dà ok.
Avvio/riavvio server: `pkill -f "node server/index.js"; npm start` (il processo cachea il codice → riavvia dopo ogni edit a server/*.js o config.json).

---

## IL POD RUNPOD
- URL ComfyUI (proxy, **CAMBIA a ogni pod nuovo**): `https://qqfhjaeubqu96l-8188.proxy.runpod.net`
- GPU: **RTX A6000 48GB**. ComfyUI 0.18.2. Path: `/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`.
- Quando si crea un pod nuovo: vedi `_runpod-workflow/.../wan2.2-image-to-video/README.md` per il flusso (1 riga `wget` del gist scarica i modelli). Poi in comfy-mac incolli il nuovo URL nel campo **RunPod** (lo ricorda da solo, persistito in `server/.runpod-url`).

---

## COSA È STATO FATTO IN comfy-mac (questa sessione)
1. **Connessione RunPod** — `server/comfy.js`: base URL generico (http→ws, **https→wss**) per il proxy RunPod. `server/index.js`: `hostBase()`, host con `url` completo, persistenza URL pod (`server/.runpod-url`, gitignored), endpoint `POST /api/runpod-url`. `config.json`: host `{ "label": "RunPod", "url": "" }`. UI: campo `#runpodUrl` (compare quando selezioni RunPod) in `public/index.html` + logica in `public/app.js` + stile in `public/styles.css`.
2. **Filtro Local vs RunPod** — ogni workflow ha `target: "local"|"runpod"`. `connTarget()` in app.js filtra la lista workflow per connessione: RunPod → solo workflow RunPod, altri host → solo locali. Il dropdown connessione fa da "tab".
3. **Nuovo mode `text2vid`** ("Text to Video") in index.html + filtro generico in setMode.
4. **Campi nuovi esposti** (gated da `has.*`): **duration**, **shift**, **loraHigh** (strength LoRA high-noise), e riuso di **cfg**. Tutti cablati in: index.html (input), app.js (registrazione el + show/hide + persist + restore + buildBody), index.js (destructure + setField + has flag).
5b. **Last-frame anche sui t2v** — aggiunti nodi `ImageFromBatch(batch_index 999)` + `SaveImage(prefix lastframe)` su VAEDecode (128:87) in `wan2.2-t2v.json` e `wan2.2-t2v-hq.json`. Ora anche i t2v salvano video + PNG ultimo frame (chaining), come l'i2v.
5. **Last-frame PNG** — il server tagga `secondary` anche i SaveImage nativi con filename `lastframe` (non solo l'iniettato `__lastframe_save`): il PNG si salva ma non sostituisce il video nel viewer. (`server/index.js` case "executed").

### Workflow RunPod aggiunti (in `config.json` + `server/workflows/`)
Tutti `target: runpod`. I grafi API sono stati pescati dal `/history` del pod (formato API, NON i .json UI delle cartelle _runpod-workflow).
| id | mode | template | note |
|---|---|---|---|
| `wan2.2-i2v` | img2vid | wan2.2-i2v.json | image+prompt+neg+seed+wh+duration+shift+loraHigh, toggle fast. Salva video **+ PNG lastframe** (chaining 5s). KNOWN-GOOD fluido. |
| `wan2.2-t2v` | text2vid | wan2.2-t2v.json | prompt+seed+wh+duration+shift+loraHigh, toggle fast (lightning). **PROBLEMA MOTION (vedi sotto)**. |
| `wan2.2-t2v-hq` | text2vid | wan2.2-t2v-hq.json | **IBRIDO anti-slowmo** (vedi sotto). cfg+shift+loraHigh esposti. |
| `ltx-2.3-t2v` | text2vid | ltx-2.3-t2v.json | prompt+seed+wh+duration, toggle enhance (Gemma). |

### Gist (per ricreare/scaricare; URL fissi)
- Wan i2v setup: `https://gist.githubusercontent.com/robotlabs/c399e98f49eede4a083917481cf4bf1c/raw/setup.sh`
- Wan t2v setup: `https://gist.githubusercontent.com/robotlabs/61ffcf9ab2b29ec6bb78fcc04ff12901/raw/setup.sh`
- LTX t2v setup: `https://gist.githubusercontent.com/robotlabs/b0b832bdfebaf2c73643827e7a64836e/raw/setup.sh`
- Wan t2v-hq graph (API): gist `960b28e4551e046b8e4a93ba032715b5`

---

## 🔬 INDAGINE "RALLENTATORE/STOPMOTION" su WAN T2V (lightning) — RISOLTA in diagnosi
**Sintomo:** il t2v con LoRA lightning 4-step esce a scatti / al rallentatore. L'i2v sembrava fluido.

**Cosa NON è (verificato):**
- NON è fps×duration: il **14B è nativo 16fps** (81 frame = 5s; i 24fps sono del modello *diverso* 5B TI2V). Combo 16×5=81 corretta.
- NON è RIFE/frame: wiring corretto VAEDecode→RIFE×2→CreateVideo@32. RIFE liscia ma **non crea** movimento.
- L'i2v sembrava fluido perché **l'immagine di partenza àncora il moto** + scena lenta. Confronto settings i2v vs t2v = identici.

**Cos'è (provato dall'utente):** la **LoRA lightning 4-step ammazza il movimento** (problema noto lightx2v). Test col toggle 4-step **OFF** (20 step, cfg 3.5, no lightning) → **movimento giusto MA ~1h di render** (anche offload VRAM) → improponibile.

**FIX = ibrido `wan2.2-t2v-hq`** (ricetta lightx2v, NON ancora provato sul pod):
- high-noise: 4 step, **CFG 3.5**, lightning-high **@0.7**
- low-noise: 4 step, **CFG 1**, lightning-low @1.0
- ~8 step totali. Switch/boolean originali rimossi (hardwired).
- Tuning se serve: moto debole → CFG↑4 / loraHigh↓0.5; artefatti → CFG↓3 / loraHigh↑0.8.

**Fonti:** lightx2v/Wan2.2-Lightning discussions #26, #5; apatero.com slow-motion guide.

---

## ✅ RISOLTO — il "rallentatore" di TUTTI i video Wan (root cause)
**Sintomo:** video Wan (i2v e t2v) qualità perfetta ma ~1.5× al rallentatore.
**Causa vera:** **Wan 2.2 è nativo a 24 fps, NON 16.** Il nostro workflow assumeva 16
(FPS primitive 16, CreateVideo 32 = 16×2 con RIFE). 32 invece del corretto 48 (=24×2)
= esattamente 1.5× lento. Scoperto guardando il workflow LOCALE buono dell'utente
(`_runpod-workflow/local-workflow/workflows/image-to-video/video.rob.new.*`): usa
`VHS_VideoCombine frame_rate=24`, niente RIFE → girava a velocità giusta.
**Fix applicato:** CreateVideo fps **54** (24×2 ≈ 48, ma l'utente a occhio preferisce 54-58)
bakato in tutti i grafi Wan (i2v 129:94, t2v/hq 128:88) + default config + campo `fps`
esposto su tutti. Verificato a seed FISSO (col random ogni render è contenuto diverso →
non confrontabile: lezione, blocca il seed quando tari la velocità).
NB: RIFE liscia, NON crea moto — la lentezza era puro mismatch fps di riproduzione.
NB2: la LoRA lightning NON era la causa del rallentatore (era questo fps); la lightning
semmai smorza un filo il MOVIMENTO, ma il problema "slow motion" era l'fps.

## STATO TEST (cosa è davvero provato)
- ✅ Wan i2v sul pod: fluido (known-good). Aggiunto a comfy-mac, NON ancora generato DA comfy-mac.
- ✅ Wan t2v sul pod (lightning): stopmotion. (20-step no-lightning: moto ok ma 1h).
- ✅ LTX t2v sul pod: gira. (no-lora: stava testando, lentissimo).
- ❌ NESSUN workflow ancora **generato da dentro comfy-mac** end-to-end (connessione+health verificati, ma manca un render reale dall'UI).
- ❌ `wan2.2-t2v-hq` ibrido: costruito, NON ancora provato.
- ❌ Last-frame PNG secondary: logica messa, da verificare al primo render i2v da comfy-mac.

---

## PROSSIMI PASSI
1. **Provare l'ibrido `wan2.2-t2v-hq`** (Free VRAM prima!) col prompt d'azione → vedere moto + tempo. Tarare cfg/loraHigh/shift.
2. Primo **render reale da comfy-mac** (qualsiasi workflow RunPod) per validare l'intera catena UI→pod→video di ritorno+save.
3. Verificare il **PNG lastframe** (i2v) nel viewer/save.
4. **Committare** comfy-mac.
5. Poi: LTX text-to-video tuning; eventuale i2v in "corsa" per confronto motion.

## GOTCHA POD (validi sempre)
- Crash "NVIDIA driver too old (12080)" → `pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128`, poi riavvia.
- **Free VRAM quando cambi famiglia modelli** (LTX ⇄ Wan) o ripaghi il caricamento (sembra lentissimo / 1h).
- Web terminal RunPod strozza i paste multilinea → usa la riga `wget` del gist, mai incollare script lunghi.
- Un crash NON è mai "rifare tutto": modelli/nodi restano su disco. Restart Pod ≠ Terminate.
- comfy-mac manda l'intero grafo template → un workflow gira su qualsiasi pod che abbia gli stessi modelli/nodi (stessi nomi file via setup.sh). Pod nuovo = solo incollare il nuovo URL, nessun giro da rifare.

# _utils — comandi pod che valgono per TUTTI i workflow

Pod slim RunPod, ComfyUI in `/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`.
Roba trasversale: non dipende dal workflow. Se vedi "ComfyUI crashed" o la GUI è bloccata, vieni qui.

---

## 🔧 RIAVVIO COMFYUI (il salvavita)
Quando vedi `ComfyUI crashed — check the logs above` o la GUI è freddata/bloccata.
Ammazza eventuali zombie sulla porta 8188 e riavvia pulito. Web terminal del pod:

```bash
pkill -f main.py; sleep 3; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```

Quando vedi `To see the GUI go to: http://0.0.0.0:8188` → ricarica la pagina del browser.
⚠️ Dopo un crash da prompt fallito, **NON ri-queueare lo stesso prompt** (rilancia il crash a catena).

---

## 🩺 DIAGNOSI CRASH (stampa l'errore vero)
Il box "ComfyUI crashed" è solo il wrapper: l'errore vero è più SOPRA. Questa riga lo isola:

```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header 2>&1 | tee /tmp/c.log; echo "==== ERRORE ===="; grep -iEB2 "error|traceback|cuda|out of memory|killed|exception|too old|not in" /tmp/c.log | tail -40
```

Tipi di errore e cosa significano:
- **`Value not in list` / `not in [...]`** = MODELLO MANCANTE (non un nodo, non un bug).
  Scarica i modelli del workflow che stai usando (la riga `wget` del suo gist). Mai "rifare tutto".
- **`NVIDIA driver too old (found version 12080)`** = torch più nuovo del driver host. Fix sotto.
- **`out of memory` / `CUDA OOM`** = VRAM finita. Abbassa risoluzione/durata, o (LTX) spegni
  `Enable Prompt Enhance`, o prendi una GPU più grande.
- **`address already in use :8188`** = c'è già un ComfyUI vivo. Usa il RIAVVIO sopra (fa pkill).

---

## ⚙️ FIX DRIVER "too old" (capita spesso sui pod nuovi)
Allinea torch al driver del pod, poi riavvia:
```bash
cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

---

## 📌 Regole d'oro
- **Un crash NON è mai "rifare tutto".** Modelli e custom node restano su disco. Si risolve riavviando/scaricando il mancante.
- **Restart Pod ≠ Terminate.** Restart riavvia (tieni tutto). Terminate cancella i ~GB di modelli.
- Path modelli sempre: `/workspace/runpod-slim/ComfyUI/models`.

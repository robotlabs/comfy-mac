# LTX-2.3 — TEXT-TO-VIDEO — pod RunPod da zero

Cartella autonoma. Pod slim RunPod, GPU rif RTX 6000 Ada 48GB, ComfyUI in
`/workspace/runpod-slim/ComfyUI`, venv `.venv-cu128`.

Modello LTX-2.3 22B (Lightricks). **Niente in comune con Wan** (download da zero, ~32 GB).
Pipeline distillata: CFG 1 + LoRA distillata + sigmas manuali = pochi step, veloce.

---

## 1. Dragga il workflow
`LTX2.3_T2V.json` in ComfyUI.

## 2. Incolla QUESTA UNICA RIGA nel web terminal
```bash
wget -O ~/ltx_t2v.sh https://gist.githubusercontent.com/robotlabs/b0b832bdfebaf2c73643827e7a64836e/raw/setup.sh && bash ~/ltx_t2v.sh
```
Scarica i 5 modelli (~32 GB) + riavvia pulito. Idempotente.

> 🔗 Modifichi `setup.sh`? Ripubblica: `gh gist edit b0b832bdfebaf2c73643827e7a64836e setup.sh`. URL invariato.

### ⚡ Alternativa più veloce — aria2c (solo-download, multi-connessione)
Stessi 5 file ma con download a **16 connessioni parallele**. Se HF ti limita la
singola connessione (`wget` a 20–50 MB/s) qui voli; se sei già a banda piena cambia
poco. Non peggiora mai. `-c` = resume. NON riavvia → riavvia tu ComfyUI dopo (sotto).
```bash
apt-get install -y aria2; cd /workspace/runpod-slim/ComfyUI/models && \
LTX23=https://huggingface.co/Comfy-Org/ltx-2.3/resolve/main/split_files && \
LTX2=https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files && \
aria2c -x16 -s16 -c -d checkpoints           https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors && \
aria2c -x16 -s16 -c -d latent_upscale_models https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors && \
aria2c -x16 -s16 -c -d text_encoders         $LTX2/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors && \
aria2c -x16 -s16 -c -d loras                 $LTX2/loras/gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors && \
aria2c -x16 -s16 -c -d loras                 $LTX23/loras/ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors && \
echo "✅ LTX via aria2c — ora riavvia ComfyUI (blocco sotto)"
```
> Se `apt-get install aria2` fallisce (no rete/permessi), usa la riga gist `wget` sopra.
> Riavvio dopo il download:
> ```bash
> pkill -f main.py; sleep 3; cd /workspace/runpod-slim/ComfyUI && source .venv-cu128/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
> ```

## 3. Quando vedi `To see the GUI go to: http://0.0.0.0:8188`
Refresh browser → ricarica il json → niente più rosso → scrivi il prompt → **Queue**.

---

## I 5 modelli LTX-2.3 (esatti, matchano i nodi del json)
| Cartella | File |
|---|---|
| checkpoints | ltx-2.3-22b-dev-fp8.safetensors |
| latent_upscale_models | ltx-2.3-spatial-upscaler-x2-1.1.safetensors |
| text_encoders | gemma_3_12B_it_fp4_mixed.safetensors |
| loras | gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors |
| loras | ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors |

Il VAE è dentro il checkpoint (CheckpointLoaderSimple) — niente VAE a parte.

## Settaggi — già corretti nel template (NON toccare per partire)
- `Switch to Text to Video` = **True** (modalità T2V).
- LoRA distillata @ **0.5** + **CFG 1** + ManualSigmas = percorso distillato veloce.
- 2 stadi: base 768×512×97 → upscale spaziale ×2 → rifinitura → finale **1280×720**.
- `Enable Prompt Enhance` = **True**: Gemma 12B espande il tuo prompt → output più ricco.
- CreateVideo @ 24 fps (LTX genera nativo fluido, **niente RIFE** da aggiungere).
- Pannello esposto: Width, Height, Frame Rate, Duration, seed, ckpt, lora, text_encoder,
  Switch T2V, Enable Prompt Enhance.

## ⚠️ GOTCHA
1. **VRAM al limite.** 22B fp8 (~22GB) + Gemma 12B + upscaler è pesante. Su 48GB regge,
   ma se va in **OOM → spegni prima `Enable Prompt Enhance`** (toglie il caricamento di Gemma
   per l'enhancement). Se ancora OOM, abbassa risoluzione/durata.
2. **Prompt enhance ON = prompt corto ok.** Gemma lo espande lui. Se la metti OFF, scrivi
   tu un prompt ricco e dettagliato.
3. **Niente RIFE qui.** A differenza di Wan, LTX genera già fluido. Non aggiungere nodi.
4. Gli altri gotcha di pod (path fisso, pkill :8188, crash driver `too old` → fix torch cu128,
   un crash non è "rifare tutto") valgono identici — vedi ../wan2.2-image-to-video/README.md.

## Prompt di test (con Prompt Enhance ON puoi anche tenerlo semplice)
```
A sleek high-tech drone lifting off from a misty mountain ridge at dawn, rotors spinning
up, dust and fog swirling beneath it, the camera slowly orbiting around the drone as it
rises into golden sunrise light, cinematic, photorealistic, shallow depth of field,
smooth continuous motion
```
Negativo già impostato nel template (pc game, cartoon, childish, ugly).

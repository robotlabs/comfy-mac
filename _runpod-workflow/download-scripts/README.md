# download-scripts - RunPod, uno script per modello

Ogni `.md` contiene **SOLO** una riga, copia-incollabile nel web terminal di RunPod.
Apri → copia → incolla → invio. Tutti usano il motore veloce `hf_transfer` (chunk paralleli, lo stesso di LTX).

**Ogni script è autonomo**: scarica TUTTE le dipendenze del suo modello (encoder, vae, lora). Se le hai già da un altro modello, le salta (skip veloce). Se parti da un pod vuoto e lanci solo quello, ti scarica tutto il necessario.

| File | Modello | Scarica |
|------|---------|---------|
| [z-image.md](z-image.md) | Z-Image Turbo | z_image_turbo_bf16 + qwen_3_4b + ae |
| [flux.md](flux.md) | Flux Schnell | flux1-schnell + clip_l + t5xxl_fp8 + ae (vae) |
| [qwen-image-2512.md](qwen-image-2512.md) | Qwen-Image 2512 (base **+ turbo**) | qwen_image_2512_fp8 + qwen_2.5_vl + vae + lora Lightning 4-step + lora Wuli turbo 2-step |
| [qwen-edit.md](qwen-edit.md) | Qwen-Image Edit 2511 | qwen_image_edit_2511_bf16 + qwen_2.5_vl + vae + lora 4-step |
| [wan-i2v.md](wan-i2v.md) | WAN 2.2 image→video (4-step) | i2v high+low + umt5 + wan_2.1_vae + lightx2v high+low + nodo RIFE |
| [wan-t2v.md](wan-t2v.md) | WAN 2.2 text→video (4-step) | t2v high+low + umt5 + wan_2.1_vae + lightx2v v1.1 high+low + nodo RIFE |
| [wan-fun-camera.md](wan-fun-camera.md) | WAN 2.2 Fun Camera | fun_camera high+low + umt5 + wan_2.1_vae + lightx2v high+low |
| [upscale.md](upscale.md) | RealESRGAN | x4plus + x2plus (`.pth`) |

**LTX** non ha script: i json sono qui, li fai col drag-and-drop dentro ComfyUI (scarica da solo i modelli).

- [LTX2.3_I2V.json](LTX2.3_I2V.json) - LTX-2.3 image→video
- [LTX2.3_T2V.json](LTX2.3_T2V.json) - LTX-2.3 text→video

Dopo ogni script: **riavvia ComfyUI sul pod A MANO** (per i nuovi modelli; e per WAN, per caricare il nodo RIFE). Gli script NON riavviano da soli.

## Cancellare (se scarico troppa roba e finisco lo spazio)
[clean.md](clean.md) - cancella i file modello che contengono una parola che scegli tu.
Apri, **cambia `P="CAMBIA_QUI"`** con un pezzo del nome (es. `P="z_image"`, `P="flux"`, `P="fun_camera"`, `P="RealESRGAN"`, `P="qwen_image_2512"`), incolla. Prima stampa la lista di cosa cancella, poi cancella, poi mostra lo spazio libero. Se lo incolli senza cambiare `P`, non cancella niente (di sicurezza).

## Note
- **qwen-image-2512**: un solo script copre sia il workflow base che il turbo (scarica entrambi i lora: Lightning 4-step e Wuli turbo 2-step). Stesso modello/encoder/vae, cambia solo il lora.
- **wan-fun-camera**: serve il nodo `WanCameraEmbedding` (incluso nel core ComfyUI recente). Se manca, aggiornare ComfyUI sul pod.
- **upscale**: i file sono `.pth` (RealESRGAN sta solo come `.pth`, fonte GitHub). I workflow upscale in comfy-mac sono già stati messi a `.pth` e resi runpod-only.
- Tutti i nomi file negli script combaciano **esattamente** con quelli richiesti dai template dei workflow in comfy-mac (verificato) → niente "value not in list" al Queue.

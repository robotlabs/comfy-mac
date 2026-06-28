# Wan 2.2 — Text-to-Video (setup + uso)

Stesso modello e stessa logica dell'image-to-video, ma **senza immagine**: parti
solo dal testo. Stesso pod, stessi nodi custom.

---

## Modelli T2V (diversi dall'i2v!)
L'i2v e il t2v usano **diffusion model + LoRA dedicati**. Il text-encoder (`umt5`)
e il VAE (`wan_2.1_vae`) sono **condivisi** — se hai già fatto l'i2v, quelli ci sono.

Da scaricare in più, nel terminale del pod (dentro `.../ComfyUI/models`):
```
W=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files && wget -c -P diffusion_models $W/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors && wget -c -P diffusion_models $W/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors && wget -c -P loras $W/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors && wget -c -P loras $W/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors
```
(Lo script `download_wan22.sh` li include già entrambi, i2v + t2v.)

Se serve anche il condiviso (prima volta in assoluto):
```
W1=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files
wget -c -P text_encoders $W1/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
wget -c -P vae https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors
```

---

## Workflow
Usa **`workflows/WAN2.2_text-to-video.json`**. Trascina, niente immagine da caricare,
scrivi il prompt, Queue.

Struttura (verificata): identica all'i2v —
- 2 modelli (high/low noise) + LoRA lightx2v t2v
- 2 KSamplerAdvanced, **4 step** (split 2/2), già in modalità veloce
- `ModelSamplingSD3` shift **5**
- `CreateVideo` **16 fps**
- **`EmptyHunyuanLatentVideo`** `[width, height, length, batch]` = qui imposti
  risoluzione e numero frame (al posto del LoadImage). Default `640×640×81`.

### Settings consigliati
| Cosa | Dove | Valore |
|---|---|---|
| risoluzione + frame | `EmptyHunyuanLatentVideo` | **720 × 1280 × 81** (reel 5s) |
| shift | `ModelSamplingSD3` (×2) | 5 (→ 3 per più movimento) |
| step | `KSamplerAdvanced` | 4 (già veloce) |
| fps | `CreateVideo` | 16 |

⚠️ Valgono gli **stessi limiti e gotcha** dell'i2v:
- max ~5s / 81 frame, max 720p
- 16fps = scattoso → per fluidità aggiungi **RIFE ×2 + CreateVideo 32fps** (come nel v3 i2v)
- per 10s → concatena 2 clip

---

## Prompting T2V
**Qui descrivi TUTTO** (non c'è immagine). Formula:
`Soggetto + Scena + Movimento + Camera + Luce + Stile`, soggetto per primo.
Lunghezza ~25–80 parole.

Vedi la guida completa con vocabolario ed esempi:
**[../knowledge/wan22-prompting.md](../knowledge/wan22-prompting.md)**

Esempio t2v (verbatim da guida):
> "Man in dark hoodie running briskly through narrow alley, slow tracking shot following from behind, wet pavement reflecting orange streetlight, light rain, breath visible in cold air, camera bobbing slightly, steam rising from manhole"

---

## i2v vs t2v in una riga
- **i2v** = immagine + prompt di **solo movimento**.
- **t2v** = nessuna immagine, prompt che **descrive tutto** (soggetto→scena→movimento→camera→luce).

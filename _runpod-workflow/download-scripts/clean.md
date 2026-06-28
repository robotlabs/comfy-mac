COME SI USA
1. Incolla questo per vedere i NOMI + PESI (dal piu' grosso):

```bash
cd /workspace/runpod-slim/ComfyUI && du -ah models | sort -rh | head -40
```

2. Cambia P="CAMBIA_QUI" (nel blocco in fondo) con un pezzo del nome del file da cancellare
3. Incolla il blocco in fondo: stampa la lista, cancella, mostra lo spazio libero

ESEMPI (dai tuoi modelli sul pod)
  P="flux1-schnell"     -> flux1-schnell.safetensors        (libera 23G)
  P="qwen_image_2512"   -> qwen_image_2512_fp8 (NON i lora)  (libera 20G)
  P="z_image_turbo"     -> z_image_turbo_bf16.safetensors    (libera 12G)
  P="qwen_image_edit"   -> qwen_image_edit_2511_bf16          (libera ~40G)
  P="Wuli"              -> lora turbo qwen 2512               (2.2G)
  P="Lightning"         -> i lora Lightning (qwen)            (vari)

ATTENZIONE: encoder e vae sono CONDIVISI tra piu' modelli, se li cancelli rompi piu' workflow:
  - qwen_2.5_vl_7b (8.8G) lo usano qwen-edit E qwen-image-2512
  - ae.safetensors lo usano flux E z-image
  - umt5 / wan_2.1_vae li usano tutti i WAN

```bash
P="CAMBIA_QUI" && cd /workspace/runpod-slim/ComfyUI && echo "--- file che verranno CANCELLATI (contengono: $P) ---" && find models -type f -iname "*$P*" -printf "%10s  %p\n" && find models -type f -iname "*$P*" -delete && echo "=== cancellati i file con: $P ===" && df -h /workspace | tail -1
```

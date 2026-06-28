# _archive — tentativi i2v 5s fluido (22 giu 2026) — TUTTI falliti

Giornata intera bruciata per ottenere **i2v veloce + fluido + 5s in un solo render**. Non si può:
è un **muro strutturale** di WAN 2.2 (vedi README principale § "Lo slow-motion i2v"). Qui restano i
tentativi morti — NON cancellati, così se torna la tentazione si riparte da dove eravamo, senza rifare il giro.

## File

| File | Cos'è | Perché archiviato |
|---|---|---|
| `Wan2.2_I2V_Kijai_context_5s.json` | Workflow ecosistema **Kijai** (WanVideoWrapper) con sliding context window per 5s senza ping-pong | Lento, crash sageattn+torch.compile, version-soup nei link. Abbandonato. |
| `Wan2.2_I2V_TEST_fast.json` | Test Kijai a 81 frame | Idem — ramo Kijai abbandonato. |
| `gemini-code-1782140143995.json` | Workflow proposto da Gemini | Connessioni rotte ("No link found in parent graph"), version mismatch. **Non usare.** |
| `setup-lora-rank256.sh` | Download lora lightning **rank256** (260412 HIGH+LOW, ~4.8GB) da `Kijai/WanVideo_comfy/LoRAs/Wan22_Lightx2v` | La lora più nuova/grande NON risolve lo slow-mo (verificato sul pod: identico alla v1). Pesante e inutile. Gist: `44dfd7f57334cbf6ebba898d029a2b75`. |

## Cosa abbiamo imparato (riassunto — dettaglio nel README principale)

- Lo slow-mo i2v è **intrinseco al lora lightning 4-step**. Né rank256, né le manopole (loraHigh 0→5.6,
  CFG, shift, risoluzione 480/720) lo rompono — spostano solo *quanto* moto entra nei 5s.
- loraHigh più alta = più moto fino a ~2.5 (poi brucia); loraHigh 0 = meno moto; 5.6 = puro noise.
- La risoluzione (480 vs 720) **non cambia** il moto, solo il tempo di render.
- **Le uniche vie al moto vero a 5s:** (a) **no-lora** (più step + CFG reale → lento) = variante **HQ** in comfy-mac;
  (b) **concatenare 2 clip da ~2.5s** via il last-frame PNG.
- Per il "veloce e decente": lightning + **fps 64** → ~2.5-3s fluido (riproduce più veloce gli stessi frame).

Se un giorno si vuole il 5s fluido vero senza i due workaround: l'unica strada non esplorata fino in fondo
è la **sliding context window di Kijai** (i due json qui sopra) — ma costa migrazione all'ecosistema Kijai.

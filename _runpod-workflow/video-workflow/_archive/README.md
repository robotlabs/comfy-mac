# video-workflow — lab AI video (ComfyUI / RunPod)

Lab dedicato alla generazione video con ComfyUI su RunPod (RTX 6000 Ada 48GB).
Modelli: **Wan 2.2** (attivo) e **LTX 2.3** (da fare). Sia image-to-video che text-to-video.

---

## Struttura
```
video-workflow/
├── README.md                  ← questo (indice)
├── SETUP-runpod.md            ← setup pod da zero (modelli + nodi), Wan + LTX
├── knowledge/
│   └── wan22-prompting.md     ← ⭐ come scrivere i prompt Wan 2.2 (i2v + t2v)
├── wan2.2/
│   ├── README.md              ← bibbia operativa Wan i2v (setup, settings, lezioni)
│   ├── T2V-guide.md           ← setup + uso text-to-video
│   ├── download_wan22.sh      ← scarica modelli i2v + t2v
│   └── workflows/
│       ├── WAN2.2_image-to-video.json  ← ⭐ i2v PRONTO (RIFE, last-frame, valori giusti)
│       ├── WAN2.2_text-to-video.json   ← ⭐ t2v PRONTO
│       └── archive/                     ← versioni vecchie + template grezzi
├── ltx/                       ← LTX 2.3 (PROSSIMO step, ancora da configurare)
│   ├── download_ltx23.sh
│   └── workflows/{LTX2.3_I2V.json, LTX2.3_T2V.json}
└── backups/                   ← workflow video storici (ROB.VIDEO, Remix, vanessa, ecc.)
```

---

## Stato
- ✅ **Wan 2.2 i2v** — funziona, veloce (~3 min/720p), fluido (RIFE), documentato.
- ✅ **Wan 2.2 t2v** — setup + guida pronti (`wan2.2/T2V-guide.md`), da testare sul pod.
- ⏳ **LTX 2.3 (i2v + t2v)** — workflow scaricati, **prompting e tuning da fare** (prossimo step).

---

## Da dove partire
1. **Rifare il pod** → `SETUP-runpod.md` (modelli) + `wan2.2/README.md` (nodo RIFE + uso).
2. **Generare i2v** → `wan2.2/workflows/WAN2.2_image-to-video.json` + `wan2.2/README.md`.
3. **Generare t2v** → `wan2.2/T2V-guide.md`.
4. **Scrivere prompt** → `knowledge/wan22-prompting.md` (i2v = solo movimento, t2v = tutto).

---

## TODO (prossima sessione)
- [ ] LTX 2.3: setup modelli, testare i2v e t2v
- [ ] Tirare giù le guide di prompting LTX (linguaggio diverso da Wan: usa Gemma, prompt più descrittivi)
- [ ] Aggiungere `knowledge/ltx-prompting.md`
- [ ] Testare Wan 2.2 t2v sul pod e annotare i tempi

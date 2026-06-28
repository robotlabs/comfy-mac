# LTX-2.3 — come scrivere i prompt (t2v + i2v)

Guida pratica per LTX-2.3 22B. Vale per text-to-video e image-to-video.

---

## ⚠️ 0. Prompt Enhance (Gemma) → TIENILO OFF

Il toggle "Prompt Enhance (Gemma)" nel workflow **NON espande il tuo prompt: lo riscrive a caso.**
Motivo (bug noto, documentato): l'enhancer usa la Gemma con la lora **abliterated**
(`gemma-3-12b-it-abliterated`). L'abliteration **rompe l'instruction-following** → invece di
seguire l'istruzione "espandi fedelmente", il modello divaga/inventa → produce testo scollegato
→ esce una scena che non c'entra (il famoso "donna al caffè"), **a qualsiasi temperature**.

→ **Soluzione:** Enhance **OFF** e scrivi tu il prompt con la struttura sotto.
(Alternativa: sostituire la Gemma abliterated con una **stock** — fix separato, non fatto.)

Riferimenti: [KJNodes issue #544](https://github.com/kijai/ComfyUI-KJNodes/issues/544) ·
[heretic-ltx README](https://huggingface.co/anongecko/gemma-3-12b-it-heretic-ltx/blob/main/README.md)

---

## 1. Struttura del prompt (un paragrafo unico, su UNA riga, presente)

Ordine consigliato (ufficiale LTX):
1. **Soggetto + ambiente** — specifico (età, vestiti, luogo)
2. **Layout spaziale** — dove stanno le cose (sinistra/destra, primo piano/sfondo)
3. **Materiali/texture** — asfalto bagnato, pelle, neon, polvere
4. **Azione in beat CRONOLOGICI** — inizio → metà → fine
5. **Movimento di camera**
6. **Audio** (opzionale — LTX-2 genera audio): ambiente, tono, chiarezza dialoghi

Output: **un paragrafo, una riga, tempo presente.**

## 2. Regole d'oro

- **Presente** + descrivi **cosa VEDE la camera**, non significati. ❌"una scena tesa" ✅"due uomini a un metro, pugni stretti, si fissano".
- **Ordine cronologico**: il modello mappa il prompt **linearmente sul tempo**. Non descrivere la fine prima dell'inizio.
- **Specifico e fisico**: ❌"una persona che cammina" ✅"una giovane donna con cappotto rosso cammina svelta su una strada di Tokyo bagnata di notte, riflessi al neon".
- **1 azione principale ogni ~2-3 secondi.** Scala alla durata:
  - **≤6s** = 1 azione + 1 movimento camera
  - **10s** = 2-3 beat + 1 movimento
  - non impilare troppi movimenti simultanei.
- **Lunghezza prompt ∝ durata**: prompt corto su video lungo → il modello "corre". Sotto ~200 parole.
- **Coerenza interna**: niente direzioni in conflitto.

## 3. ⚡ Vocabolario del MOVIMENTO (lezione imparata sul campo)

La velocità percepita la decidono **le parole**. Stesso identico modello:
- **Parole LENTE → moto lento / sembra rallentatore:** `steady, even, natural, smooth, gentle, constant, slowly, calm`.
- **Parole VELOCI → moto vero:** `fast, sprinting, rapid, quick strides, brisk, whipping, dynamic, energetic`.

Se ti viene "al rallentatore", **controlla PRIMA il vocabolario del prompt**, non i parametri.

## 4. i2v — SOLO l'azione

Nell'image-to-video l'**ambiente è già nell'immagine**: descrivi **solo cosa si muove e come**, non rifare la scena.
- Verbi d'azione espliciti.
- **Chaining (concatenare clip):** stessa risoluzione/inquadratura tra le clip; `img_compression` **basso (0-8)** per il giunto; `longer_edge` segue già l'altezza (zoom risolto).

## 5. Dialoghi

Spezza le frasi lunghe in frasi corte con indicazioni di recitazione in mezzo.
Es: *She pauses, then says firmly: "Non oggi." She turns away.*

## 6. Esempi (debole → forte)

| ❌ Debole | ✅ Forte |
|---|---|
| "A woman in a cafe" | "A woman in her 30s sits by the window of a small Parisian cafe, rain running down the glass behind her, warm tungsten light. She slowly stirs her coffee while glancing at her phone." |
| "A person walking" | "A young woman in a long black leather coat walks briskly straight toward the camera down a wet neon-lit Tokyo street at night, full-body shot, her coat swaying and hips moving with each quick stride, purple and blue light beams and neon signs reflecting on the wet asphalt, camera holding steady at street level as she approaches." |

## 7. Audio (LTX-2)

Non usare tag `[AUDIO]`. Intreccialo naturale: *"…footsteps echo on wet concrete, distant city hum, light rain."*

---

**TL;DR:** Enhance OFF · un paragrafo presente su una riga · soggetto→spazio→texture→azione cronologica→camera→audio · parole di movimento VELOCI se vuoi moto vero · i2v = solo azione.

Fonti: [LTX-2.3 Prompt Guide (ufficiale)](https://ltx.io/blog/ltx-2-3-prompt-guide) ·
[How to improve LTX-2.3 prompt adherence](https://ltx.io/blog/how-to-improve-ltx-2-3-prompt-adherence) ·
[video-prompting-skill ltx2-3](https://github.com/Square-Zero-Labs/video-prompting-skill/blob/main/video-prompting/references/models/ltx2-3/prompting.md)

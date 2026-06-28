# Wan 2.2 — Guida al Prompting (i2v + t2v)

Come scrivere prompt che funzionano davvero su Wan 2.2 14B. Sintesi delle guide
ufficiali e community (fonti in fondo). Vale per ComfyUI.

---

## REGOLA ZERO: i2v e t2v vogliono prompt DIVERSI

| | Cosa descrivi |
|---|---|
| **Image-to-Video (i2v)** | **SOLO movimento + camera.** L'immagine fornisce già soggetto, vestiti, sfondo, luce. NON ri-descriverli. Formula: `Movimento + Movimenti di camera`. |
| **Text-to-Video (t2v)** | **TUTTO.** Non c'è immagine, quindi devi descrivere soggetto + scena + movimento + luce + stile. Formula completa (sotto). |

> i2v: "describe how things move, not what appears. Animate only elements visible in the image." (VEED)

---

## La struttura (il "funnel")

Wan è stato addestrato su coppie video-didascalia dove la didascalia parte dal
soggetto e finisce col contesto. **Pesa di più le prime parole.** Quindi l'ordine conta:

**`Soggetto → Azione/Movimento → Camera → Scena/Luce`**
> "subject first, motion second, camera third, scene last." (wan27.org)

Se metti la scena per prima, sprechi il "budget" del modello sullo sfondo e ottieni
"un bel background con un soggetto generico alla deriva".

### Formule pronte
- **t2v base**: `Soggetto + Scena + Movimento`
- **t2v avanzata**: `Soggetto (descr.) + Scena (descr.) + Movimento (descr.) + Controllo estetico + Stile`
- **i2v**: `Movimento + Camera` (+ eventuale aggancio breve al soggetto: "the same woman…")

---

## Lunghezza

- **t2v**: ~**25–80 parole** è lo sweet spot (sotto 25 = poca direzione, sopra ~80–120 = il modello ne ignora pezzi). (wan27.org)
- **i2v**: più corto, **1–3 frasi** di solo movimento+camera. (VEED)

---

## Regola d'oro sul movimento: NON usare verbi generici

Per ogni azione specifica **3 cose**:
- **Velocità**: slowly · briskly · gently · gradually
- **Direzione**: toward camera · away · left to right
- **Meccanica del corpo**: head turns · arms raise · walks · hips sway

> "walks toward the camera at a relaxed pace, left hand running through hair" batte di gran lunga "walking". (wan27.org)

---

## Vocabolario (copincolla)

### Movimenti di camera
- Base: `slow push-in` · `pull back` · `slow pan left/right` · `tilt up` · `tilt down` · `zoom in/out`
- Avanzati: `orbital shot / lens slowly orbits from behind to the front` · `following shot` · `handheld` · `drone shot` · `static shot` · `camera bobbing slightly` · `compound camera movement`

### Inquadrature / composizione
- Shot: `close-up` · `medium close-up` · `wide-angle` · `panorama` · `clean single shot`
- Composizione: `center composition` · `symmetrical` · `balanced` · `shallow depth of field`
- Lenti: `wide-angle` · `telephoto` · `fisheye/ultra-wide`

### Luce (light source / type / momento)
- Sorgente: `daylight` · `moonlight` · `firelight` · `neon` · `practical light` · `golden hour sunlight`
- Tipo: `soft light` · `hard light` · `side light` · `edge light` · `high/low contrast` · `silhouette`
- Momento: `sunrise` · `sunset` · `dawn` · `night`
- Esempi: `golden hour sunlight, long shadows` · `neon signs reflecting on wet pavement at night` · `candlelit room, warm flickering light`

### Effetti ambientali (danno vita e profondità)
`wind blowing through trees` · `rain falling` · `breath visible in cold air` · `steam rising` · `dust motes in the light beam` · `dappled shadows through leaves`

### Tono colore
`warm tone` · `cold tone` · `mixed tones` · `low/high saturation`

### Stili (per roba artistica)
`pixel style` · `3D game` · `2D animation` · `puppet animation` · `tilt-shift` · `time-lapse`

### Modificatori velocità/intensità
`gentle` · `slow` · `moderate` · `subtle` · `fluid motion` · `gradually increase…`

---

## Esempi VERBATIM (dalle guide)

**i2v — ritratto**
> "The woman slowly turns her head to the left while maintaining eye contact. Slow push-in on the subject's face, shallow depth of field."

**i2v — movimento a strati (foreground/background separati)**
> "Subject remains still with subtle breathing, background trees swaying gently, camera static"

**i2v — build progressivo**
> "Begin with minimal movement, gradually increase wind intensity affecting hair and clothing."

**t2v — ritratto (livello "great")**
> "Woman with short silver hair, round tortoiseshell glasses, faint scar on left eyebrow—looks up from worn paperback, slow smile spreading as eyes meet lens, static close-up with shallow depth of field, warm afternoon light through gauze curtains, dust motes in light beam"

**t2v — azione (livello "great")**
> "Man in dark hoodie running briskly through narrow alley, slow tracking shot following from behind, wet pavement reflecting orange streetlight, light rain, breath visible in cold air, camera bobbing slightly, steam rising from manhole"

**t2v — camera push (jungle)**
> "In the depths of a dense tropical jungle with dappled sunlight filtering through leaves, an explorer in a khaki jacket kneels carefully brushing away soil… the camera pushes in from a wide angle to a close-up of his pupils dilating."

---

## DO / DON'T

**DO**
- Descrivi COME si muove, non cosa appare (soprattutto i2v)
- Verbi concreti + velocità + direzione + meccanica
- Separa movimento di foreground e background
- Anima solo ciò che è plausibile dall'immagine (i2v)
- Una clip = **una azione semplice** (vedi limite 5s)

**DON'T**
- Interazioni multi-soggetto complesse
- Trasformazioni estreme (giorno→notte in 5s)
- Istruzioni di movimento contraddittorie
- (i2v) descrivere azioni non supportate dall'immagine
- Stipare 3 azioni in 5s → le "abbrevia"

---

## Negative prompt (anti-artefatti)

Template standard:
```
morphing, warping, distortion, blurry, low quality, face deformation, flickering, jittering, sudden changes, inconsistent lighting, deformed, mutated hands, extra fingers, extra limbs, bad anatomy, watermark, text, multiple people, duplicate body
```
⚠️ Promemoria del nostro setup: con **turbo ON (cfg 1)** il negative quasi **non morde**.
Per farlo contare devi alzare cfg (~2-3) e steps (~6-8), perdendo un po' di velocità.

---

## Promemoria limiti Wan 2.2 (dal nostro lab)
- **Max ~5s / 81 frame** per clip. Oltre → la scena si impasta/torna indietro. Per 10s → concatena 2 clip (vedi README wan2.2).
- **Max 720p.** 1080 no (modello 720p) → genera 720, upscale dopo.
- **16 fps nativi** → usa RIFE ×2 + 32fps per fluidità (già nel workflow v3).

---

## Fonti
- VEED — Wan 2.2 Prompting Guide (i2v): https://www.veed.io/learn/wan-2-2-prompting-guide
- wan27.org — Wan 2.2 Prompt Guide (struttura/funnel, word count): https://wan27.org/blog/wan-2-2-prompt-guide
- MimicPC — How to Craft Wan2.2 Prompts (69+ esempi, vocab): https://www.mimicpc.com/learn/how-to-craft-wan22-ai-video-prompts
- ComfyUI docs — Wan 2.2: https://docs.comfy.org/tutorials/video/wan/wan2_2

# Lessons Learned — Nano Banana × Noonshop

12 documented failure modes from the Sofia × Dormann pilot and the post-pilot Prakash QA. Each one cost real iteration time. Apply them before generating, not after.

---

## L1 — Text overrides image when they conflict

**Failure mode:** If your prompt text describes the frame differently from the reference image, Nano Banana follows the text and ignores the reference.

**Fix:** Always remove or align the text with the reference image. Never contradict it. If the product reference shows a polygon frame, don't write "round frame" anywhere in the prompt — even as a negative ("not round" still puts "round" in the model's attention).

---

## L2 — Slot order: product first, face anchor second

**Failure mode:** The first reference image carries the highest compositional weight. If the face anchor is in slot 1, the model treats the product as secondary context and may render it inaccurately or omit it.

**Fix:** Always upload `product.png` to slot 1 and `face_anchor.jpg` to slot 2. This is non-negotiable.

---

## L3 — "Prominent" + "horizontal metal bars" = aviator brow bar

**Failure mode:** Describing the Dormann double bridge as "prominent double-bar bridge with two parallel horizontal metal bars" caused the model to hallucinate an aviator-style brow bar spanning both lenses.

**Fix:** Use this language for double nose bridges:
> "narrow double nose bridge — two slim parallel metal bars at the nose pad area only, NOT a connecting brow bar across the top of the lenses"

---

## L4 — "Do not invent" causes omission

**Failure mode:** Telling the model "do not invent or alter any frame details — use only what is visible in image 1" caused it to skip the glasses entirely rather than risk inaccuracy.

**Fix:** You need text to unlock the render. Zero geometry text = no glasses. Always include affirmative descriptors of the frame.

---

## L5 — Three reference images confuses compositing

**Failure mode:** Switching from 2 to 3 reference images (2 product angles + face) caused the model to drop the glasses in multiple attempts.

**Fix:** Use exactly 2 reference images. Product (slot 1) + face anchor (slot 2). Never more.

---

## L6 — Eye blur is lens refraction — suppress explicitly

**Failure mode:** Nano Banana renders clear optical lenses with realistic refraction, which blurs the eyes seen through them.

**Fix:** Always include in the frame description block:
> "Clear lenses — eyes fully sharp and in focus, no refraction blur."

---

## L7 — Spatial anchors fix proportion drift

**Failure mode:** Without facial landmark anchors, the model guesses frame size — often too small or too large.

**Fix:** Include landmark spatial anchors:
> "top rim sits 2–3mm below the eyebrow line, lens height to mid-nose level"

---

## L8 — Nano Banana renders frames slightly oversized

**Failure mode:** The model biases toward larger, more prominent frames — most training data associates eyeglasses with bolder shapes.

**Fix:** For compact opticals, use landmark anchors not mm specs (see L9). Watch for oversize drift across all archetypes; tighten if needed.

---

## L9 — Size constraints trigger brow bar hallucination

**Failure mode:** Adding "compact frame, 46–48mm" to the bridge language pulls the model toward a pilot/aviator silhouette (the dominant "small compact metal frame with double bridge" in training data), reintroducing the brow bar even when NOT language is present.

**Fix:** Drop the mm spec entirely. Use landmark anchors:
> "frame width aligns with the outer corner of each eye — no wider"

Strengthen the bridge negative:
> "the bridge is a single short bar at the nose pad only — NO bar spanning the top of the lenses, NO brow bar, NO pilot bridge — one bridge element at the nose, period"

---

## L10 — Quote Card is a mood, not a layout

**Failure mode:** Asking the model to leave half the frame empty for text overlay fails. Nano Banana has strong centering bias from training data and will keep generating well-composed centered portraits regardless of "BOTTOM HALF" or "negative space at top" instructions.

**Fix:** Stop fighting the generator on layout. Generate the right *emotional register* for quote pairing instead:
- Gaze lowered (not at camera)
- Chiaroscuro lighting (not flat studio)
- Warm dark moody background (not white)
- Atmospheric depth

Text overlay is handled in Canva/Figma — the generator's only job is to deliver a photo with the right introspective mood.

---

## L11 — TOS-safe prompting for ElevenLabs Flows

**Failure mode:** ElevenLabs Flows rejects prompts that explicitly instruct face replication ("reproduce her exact face", "use the same identity"). This is intentional deepfake prevention.

**Fix:** Frame the task as styling, not replication. Identity transfer comes from the reference image input — the prompt text only describes styling and scene.

> "The woman shown in image 2 (the portrait reference), wearing the exact eyeglasses shown in image 1."

This pattern works across all archetypes and all models. See the framework's Section 14 (ElevenCreative Flows) for the full approved framing.

---

## L12 — Anchors render warm-graded and over-smooth by default

**Failure mode:** Anchors and sheet angles come out airbrushed (poreless, plastic) and bronze-toned, breaking the editorial brief. Two compounding causes:

1. **Stacked warmth instructions.** The SKIN paragraph said `"natural warmth"` and the universal closer said `"skin tones rendered ... warmly"` — both stacked warm grading on top of the descriptor's already-warm skin tone, which Nano Banana already biases toward by default.
2. **Negative-only texture instructions are not enough.** Saying "NOT retouched, NOT smoothed" tells the model what to avoid but gives it no positive target — it still defaults to AI-smooth skin.

**Fix:** Three changes, applied to the anchor + sheet stage (Steps 1–2). Production archetypes inherit identity from the anchor, so fixing the anchor cascades downstream.

1. **Remove every "warm" instruction from lighting and grading.** The descriptor names skin tone once (e.g. "warm olive-caramel"); never repeat warmth as a lighting or post-processing instruction. Replace `"Even soft window light"` with `"Soft north-facing daylight"` (specific, neutral, not warm).
2. **Specify neutral white balance explicitly.** Add a dedicated WHITE BALANCE block:
   > "Neutral daylight white balance (5500K), accurate skin tone with NO warm/orange filter cast, NOT bronze-graded, NOT golden-hour, NOT teal-and-orange."
3. **Add positive texture markers, not just negatives.** Stack both:
   > "Visible pores across the cheeks, forehead and nose; fine skin lines around the eyes; subtle skin micro-variation; real human imperfection — NOT retouched, NOT smoothed, NOT polished, NOT airbrushed, no AI-smooth pass, no skin filter, zero beauty retouching."

**Scope:** Applies to anchor (Step 1), sheet angles (Step 2), and the universal closer for Steps 3–8. Archetype-specific warmth (Boulevard cream/terracotta palette, Interior Warm tungsten fill, Quote Card warm chiaroscuro) is intentional scene grading and stays as-is.

**Source:** Prakash QA, April 2026 — Sofia × Dormann pilot anchor.

---

## How to use these lessons

When the user reports a QA failure, **identify which lesson applies** and apply the named fix before regenerating. Examples:

| QA failure | Likely lesson | Action |
|---|---|---|
| Brow bar visible across the lenses | L3 or L9 | Apply the bridge negative |
| No frame in result | L4 or L5 | Restore affirmative geometry text + drop to 2 refs |
| Eyes blurry through lenses | L6 | Add the "Clear lenses" line |
| Frame too small / too large | L7 + L8 | Add landmark anchors |
| Round shape instead of polygon | L1 | Remove conflicting text + verify reference image is the right frame |
| Quote card looks like centered portrait | L10 | Reframe to mood, not layout |
| ElevenLabs Flows rejects prompt as TOS violation | L11 | Use the styling framing — "the woman shown in image 2" |
| Skin looks airbrushed / plastic / poreless | L12 | Add positive texture markers + stack negatives |
| Image looks bronze / over-warm / golden-hour | L12 | Remove "warm" from lighting; add neutral 5500K WB block |

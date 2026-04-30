# Collection Tokens

Paste the appropriate token verbatim into the `[COLLECTION_TOKEN]` slot of the production prompt. These have been engineered through pilot iteration to produce the correct frame geometry without further description. **Do not edit them ad-hoc** — if a token isn't producing the right result, update the canonical version and document why.

---

## Dormann

> Dormann optical eyeglasses — thin wire metal frame, softly angular polygon shape with a flat top edge (NOT round, NOT circular, NOT aviator, NOT Boston shape), the bridge is a single short bar at the nose pad only — NO bar spanning the top of the lenses, NO brow bar, NO pilot bridge — one bridge element at the nose, period. Matte warm copper/brown metallic finish, clear optical lenses.

**Why this works:** v3 prompt language locked in Sofia's pilot. Negatives prevent both round (Boston/circular) and aviator (brow bar) hallucinations. The "period" sentence-ender adds prompt weight to the bridge constraint. See L3 + L9.

**Reference image:** `Noonshop/assets/products/dormann/DO12410TPE-PO_FRONT.png`

---

## Steel Brown (template — pilot pending)

> Steel Brown sunglasses — wafer-thin German stainless steel, panto shape with subtle polygonal top edge, ZEISS brown-tinted lenses. Matte metal or warm brown colourway. Impossibly lightweight — worn effortlessly, not heavy on the face. Frame sits perfectly centred — not sliding, nose pads visible, temples sit cleanly above both ears.

**Status:** Token drafted from product spec. Validate during Amara onboarding (Steel Brown pilot). May need bridge negatives if aviator hallucination appears.

**Reference image:** TBD — add to `Noonshop/assets/products/steel-brown/`

---

## DeNova (template — pilot pending)

> DeNova optical frames — ultra-thin German stainless steel, featherlight and barely-there on the face. Clear prescription lenses. Matte metal or matte black finish. Beta-titanium temples. Frame contours precisely to face — no gap at bridge, no slide at nose, temples sit cleanly above both ears.

**Status:** Token drafted from product spec. Validate during Ravi onboarding (DeNova pilot).

**Reference image:** TBD — add to `Noonshop/assets/products/denova/`

---

## Token authoring rules

When tightening a collection token after a failure:

1. **Add affirmative geometry** — describe what the frame *is*, not just what it isn't.
2. **Add NOT statements** sparingly — they help with shape (round/Boston/aviator) but don't help with bridge geometry (see L3).
3. **Use sentence-ender weight** — phrases like "one bridge element at the nose, period." carry extra weight in attention.
4. **Avoid mm specs** — landmark anchors only (see L9).
5. **Test on the active pilot** — never roll out a token change to all models before validating on one.

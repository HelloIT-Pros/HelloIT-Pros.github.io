# QA Gate

A 7-point binary checklist. Apply to every generation **before** filing it. Fail any one → name the variable → apply the lesson → regenerate. Never iterate blindly.

---

## The 7 checks

### 1. Identity holds
- Does the face match the model's anchor?
- Same ethnicity reading, same hair colour and texture, same facial structure
- **If fail:** identity drift. Verify face anchor was in slot 2 (L2). Reduce temperature if too high.

### 2. Frame geometry is correct
- Does the frame match the product reference image?
- Correct shape (polygon vs. round vs. panto)
- Correct bridge type (single nose bridge, no brow bar — see L3, L9)
- Correct material (thin wire vs. acetate)
- **If fail:** apply L1 (text/image conflict) + check L3/L9 (bridge language) + verify product image was in slot 1 (L2).

### 3. Frame proportions are correct
- Frame width aligns with outer corner of each eye, no wider (L7)
- Top rim 2–3mm below eyebrow line (L7)
- Lens height to mid-nose level (L7)
- **If fail:** apply L7 + L8 (landmark anchors). Drop any mm specs (L9).

### 4. Eyes sharp through clear lenses
- Eyes fully visible, fully in focus, no blur from lens refraction
- **If fail:** apply L6 — add "Clear lenses — eyes fully sharp and in focus, no refraction blur."

### 5. Skin texture reads as real (L12)
- Visible pores across cheeks, forehead, nose
- Fine skin lines around the eyes
- Real human imperfection, micro-variation in tone
- NOT plastic, NOT airbrushed, NOT poreless, NOT AI-smooth
- **If fail:** add positive texture markers, not just negatives. Stack: "visible pores ... fine skin lines ... real human imperfection — NOT smoothed, NOT airbrushed, no AI-smooth pass." Negatives alone aren't enough — the model needs a positive target. See L12.

### 6. White balance is neutral (L12)
- Skin colour matches the descriptor only — no extra warmth from lighting or grading
- NOT bronze, NOT golden-hour, NOT teal-and-orange
- If the image looks like it has a warm filter, it fails — even if everything else is right
- **If fail:** remove every "warm" instruction from lighting and grading. Replace "warm window light" with "soft north-facing daylight." Add explicit WB block: "Neutral daylight white balance (5500K), accurate skin tone with NO warm/orange filter cast, NOT bronze-graded." See L12.

### 7. Scene matches archetype
- Setting, light, lens, palette, motion all match the archetype spec
- 4:5 aspect ratio
- **Note:** Archetype-scoped warmth (Boulevard, Interior Warm, Quote Card) is intentional and does not fail check 6. The neutralisation only applies to anchor + sheet + Studio + Architectural + Macro.
- **If fail:** check archetype prompt block. Recheck aspect ratio is set to 4:5 in AI Studio settings.

---

## Pass / Fail decision

- **All 7 pass** → save as `[archetype]_[collection]_v[N].png`. Increment version.
- **Any fail** → name the failed point, apply the matching lesson, retry. Do not "save and fix later."

## Special cases

### Quote Card archetype (Step 8)
The QA gate treats Quote Card slightly differently — see L10. The "Scene matches archetype" check should verify:
- Gaze is lowered (not at camera)
- Lighting is chiaroscuro (not flat)
- Background is warm dark (not bright/white)
- Composition is intimate

The model's centering bias means you should *not* fail it for being centered — that's expected. Fail it if mood is wrong.

### First-shot iteration count
Sofia's Step 3 (Studio) took 7 iterations to lock. This is normal for a first model on a first collection. Subsequent models on the same collection should hit pass on v1–v2. If a non-pilot model takes >3 iterations on a proven collection, escalate — there's likely a systemic issue (wrong reference image, wrong slot order, etc.).

# QA Gate

A 6-point binary checklist. Apply to every generation **before** filing it. Fail any one → name the variable → apply the lesson → regenerate. Never iterate blindly.

---

## The 6 checks

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

### 5. Skin reads natural
- Visible pore detail, slight surface variation
- NOT plastic, NOT airbrushed, NOT AI-smooth
- Documentary skin rendering
- **If fail:** verify SKIN block is present. Anchor stage requires temperature 1.3.

### 6. Scene matches archetype
- Setting, light, lens, palette, motion all match the archetype spec
- 4:5 aspect ratio
- **If fail:** check archetype prompt block. Recheck aspect ratio is set to 4:5 in AI Studio settings.

---

## Pass / Fail decision

- **All 6 pass** → save as `[archetype]_[collection]_v[N].png`. Increment version.
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

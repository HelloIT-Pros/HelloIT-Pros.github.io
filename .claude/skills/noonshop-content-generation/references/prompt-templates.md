# Prompt Templates

All prompts use the same skeleton. Replace bracketed slots with values from the model's spec + the chosen archetype + the active collection token.

---

## Step 1 — Anchor (no reference images)

Use when onboarding a new model. Generate 10–15 candidates. Temperature: **1.3**.

```
Studio portrait of a woman, age [AGE], [HERITAGE_DESCRIPTOR] — [SKIN_TONE] skin that reads as [HERITAGE_RANGE]. [HAIR_DESCRIPTION]. [EYE_DESCRIPTION]. [FACE_FEATURES]. Soft north-facing daylight from front-left, no harsh shadows, off-white seamless paper background (#F7F6F3). Eye-level head-and-shoulders crop. Shot on 85mm equivalent, shallow depth of field at f/2.0.

SKIN TEXTURE: visible pores across the cheeks, forehead and nose; fine skin lines around the eyes; subtle skin micro-variation; real human imperfection — NOT retouched, NOT smoothed, NOT polished, NOT airbrushed, NOT plastic, no AI-smooth pass, no skin filter, zero beauty retouching.

WHITE BALANCE & GRADING: neutral daylight white balance (5500K), accurate skin tone with NO warm/orange filter cast, NOT bronze-graded, NOT golden-hour, NOT teal-and-orange. Skin colour faithful to the descriptor only — no additional warmth from lighting or post-processing.

Editorial fashion photography, raw and honest, magazine quality. Plain cream fitted top, no jewellery, no accessories. 4:5 aspect ratio. Photorealistic, documentary skin rendering.
```

**Note:** No frames in this prompt — the anchor is face-only. Frames come in Steps 3–8. The SKIN TEXTURE and WHITE BALANCE blocks are both critical (see L12) — without them, Nano Banana defaults to AI-smooth, bronze-warm skin.

---

## Step 2 — Sheet angles (1 reference: anchor in slot 1)

Generate 3 variations using the locked anchor as reference. Aspect ratio: 4:5.

**Texture & WB suffix** — append to all three sheet angle prompts:
> "Visible pores and fine skin lines, NOT retouched, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral daylight white balance (5500K), NOT bronze-graded, NOT warm-filtered."

### 3/4 view
```
Same person from reference image. Three-quarter view, head turned 30 degrees to camera-left. [Same lighting, background, wardrobe as anchor]. Calm, mouth closed. Same off-white seamless paper background, same soft north-facing daylight from front-left. Eye-level head-and-shoulders crop. 85mm equivalent. [TEXTURE & WB SUFFIX]. 4:5 aspect ratio.
```

### Profile
```
Same person from reference image. Strict left profile, head turned 90 degrees. [Same wardrobe]. Calm closed-mouth expression. Same off-white seamless paper background, same soft north-facing daylight from front-left. Eye-level head-and-shoulders crop. 85mm equivalent. [TEXTURE & WB SUFFIX]. 4:5 aspect ratio.
```

### Lookdown
```
Same person from reference image. Eyes slightly lowered, contemplative downward gaze, head still facing forward, chin slightly down. Calm closed-mouth expression. Same off-white seamless paper background, same soft north-facing daylight from front-left, same wardrobe. Eye-level head-and-shoulders crop, 85mm equivalent, shallow depth of field. [TEXTURE & WB SUFFIX]. 4:5 aspect ratio.
```

---

## Steps 3–8 — Production archetypes (2 references)

Standard structure for all 6 production shots. Replace `[BRACKETS]` per the model + archetype + collection.

### Shared opening (identity + frame)

```
nsm_[NAME]_01 — the woman from image 2 (the portrait): [DESCRIPTOR_SENTENCE]. Reproduce her exact face and hair from the reference portrait.

She is wearing the exact eyeglasses shown in image 1 (the product photo). [COLLECTION_TOKEN — see collection-tokens.md].

Frame width aligns with the outer corner of each eye — no wider — top rim sits 2–3mm below the eyebrow line, lens height to mid-nose level. Frames centred on her face, nose pads visible, temples clean above her ears. Clear lenses — eyes fully sharp and in focus, no refraction blur.
```

### Step 3 — Studio Portrait

Add to the shared opening:
```
She wears [WARDROBE — e.g. "a cream fitted t-shirt"]. Studio portrait, soft directional natural light from front-left, off-white seamless paper background (#F7F6F3), eye-level, head-and-shoulders crop, 85mm equivalent, shallow depth of field at f/2.0. Calm composed expression, mouth closed, no smile, looking directly at camera.

Editorial fashion photography, magazine quality, visible skin texture — pores and fine lines, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral white balance, NOT bronze-graded. No jewellery. 4:5 aspect ratio. Photorealistic, documentary skin rendering.
```

### Step 4 — Boulevard

```
She wears [WARDROBE]. Walking through [LOCATION — e.g. "the Los Angeles Arts District"] on a bright overcast morning, mid-stride, looking slightly past camera — unposed, in motion. Industrial brick and mural walls softly out of focus behind her.

35mm film equivalent, soft overcast natural daylight, warm palette of cream and terracotta, shallow depth of field, no crowds, no modern signage, no logos. Editorial fashion photography. Natural skin texture — NOT retouched. 4:5 aspect ratio. Photorealistic, documentary skin rendering.
```

### Step 5 — Interior Warm

```
She wears [WARDROBE]. Warm interior scene — seated at a small café table near a window, soft diffused daylight from the left, warm ambient fill light from behind. Background: softly blurred warm-toned interior with wooden elements, shallow depth of field. 50mm equivalent, f/1.8, slight three-quarter angle, upper-body crop.

Calm, self-contained expression, mouth closed, gaze slightly off-camera as if in thought. Editorial fashion photography, magazine quality, visible skin texture — pores and fine lines, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral white balance, NOT bronze-graded. No jewellery. 4:5 aspect ratio. Photorealistic, documentary skin rendering.
```

### Step 6 — Architectural

```
She wears [WARDROBE]. Standing against a clean architectural backdrop — smooth raw concrete wall, hard directional daylight casting a sharp shadow across the wall to her right. No other elements. 35mm equivalent, f/2.8, straight-on angle, upper-body crop.

Still, composed posture. Expression neutral, mouth closed, direct gaze into camera. Editorial fashion photography, magazine quality, visible skin texture — pores and fine lines, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral white balance, NOT bronze-graded. No jewellery. 4:5 aspect ratio. Photorealistic, documentary skin rendering.
```

### Step 7 — Macro Frame

```
Extreme close-up — tight crop from just above the eyebrows to just below the nose tip. The frame fills the frame. 100mm macro equivalent, f/2.0, razor-thin depth of field — skin texture and frame metal in sharp focus, hair softly out of focus at the edges. Soft neutral light, no harsh shadows on the face. Background: softly blurred off-white or warm grey.

Eyes open, gaze directly into the camera. Visible skin texture — pores and fine lines, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral white balance, NOT bronze-graded. No jewellery. 4:5 aspect ratio. Photorealistic, product-level detail.
```

### Step 8 — Quote Card (mood, not layout — see L10)

```
GAZE: Her eyes are lowered, looking softly downward — not at camera. Lashes catching light. Eyelids relaxed, calm, introspective. Mouth softly closed, no smile. The mood is quiet, thoughtful, intimate.

LIGHT: Soft warm chiaroscuro — single directional key light from camera-right at face level, deep falloff into gentle shadow on the left side of her face. Not flat studio light. Cinematic, moody, atmospheric. Subtle warm rim catching her hair.

COMPOSITION: Head-and-shoulders portrait, slightly off-centre — she occupies the left two-thirds of the frame, with soft atmospheric negative space on the right side. Slight low camera angle, looking up toward her face. The framing is intimate — close enough to see skin texture and lash detail.

BACKGROUND: Warm dark grey-brown, deeply blurred, atmospheric. NOT white. NOT bright. Soft, moody, cinematic.

She wears a minimal dark crew-neck top.

50mm equivalent, f/1.8, shallow depth of field. 4:5 aspect ratio. Editorial portrait photography — mood over flash. Visible skin texture — pores and fine lines, NOT smoothed, NOT airbrushed, no AI-smooth pass. Neutral white balance, NOT bronze-graded. No jewellery. Photorealistic, documentary-style portraiture.
```

---

## Universal closer (always append to Steps 3–8)

> "Editorial fashion photography, magazine quality, skin tones rendered accurately with neutral white balance, visible texture (pores, fine lines), no AI-smooth pass, no airbrushing, photorealistic, no illustration style."

This override prevents Nano Banana from drifting toward painterly or stylized outputs **and** stops it from over-warming/airbrushing the skin (see L12). The previous version of this closer ended in *"and warmly"* — which was instructing the model to add warmth on top of the descriptor's skin tone. That phrase is removed permanently.

---

## Slot reference (Steps 3–8)

| Slot | What goes there | Why |
|---|---|---|
| 1 | Product reference (e.g. `DO12410TPE-PO_FRONT.png`) | Highest weight — drives frame geometry |
| 2 | Face anchor (e.g. `sofia_anchor_v1.jpg`) | Identity reference |

**Never use 3+ images.** See L5.

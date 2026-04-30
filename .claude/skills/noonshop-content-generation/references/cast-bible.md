# Cast Bible

8-person production cast. Each model has a unique tag, descriptor, frame anchor, and (once locked) a 4-file character sheet.

---

## Roster

| Tag | Name | Heritage | Age | Role archetype | Frame anchor | Status |
|---|---|---|---|---|---|---|
| `nsm_amara_01` | Amara | West African · Senegalese | 35 | Curator | Steel Brown | Anchor pool ready |
| `nsm_ravi_01` | Ravi | South Indian | 38 | Researcher | DeNova | Queued |
| `nsm_lea_01` | Léa | French-Maghrebi | 31 | Editor | Dormann | Queued |
| `nsm_mateo_01` | Mateo | Mexican | 44 | Architect | Dormann | Queued |
| **`nsm_sofia_01`** | **Sofia** | **Filipino / Latina / SE Asian (fluid)** | **30** | **Performer** | **Dormann** | **✓ PILOT COMPLETE** |
| `nsm_jin_01` | Jin | Korean | 37 | Founder | Steel Brown | Queued |
| `nsm_priya_01` | Priya | Indian-American | 47 | Director | Dormann + DeNova | Queued |
| `nsm_nour_01` | Nour | Lebanese | 32 | Photographer | Steel Brown | Queued |

---

## Sofia spec (the locked example)

Use this as the template for filling out new models.

```yaml
tag: nsm_sofia_01

descriptor: |
  Ethnically ambiguous woman, age 30 — warm olive-caramel skin reads as Filipino,
  Latina, Southeast Asian, or mixed heritage. Dark brown thick wavy hair past the
  collarbone. Slightly almond-shaped hazel-brown eyes, wide-set, high cheekbones,
  soft rounded jaw, full lips, calm direct bearing.

heritage: Intentionally fluid — "Filipino / Latina / Southeast Asian or mixed."
  Do not anchor to one country. The ambiguity is the brief.

age: 30
role: Performer — creative world, music, film, movement culture
frame_anchor: Dormann (DO12410TPE-PO — warm copper/brown wire optical)

wardrobe_canon:
  - Cream fitted t-shirt
  - Off-white linen shirt
  - Minimal dark crew-neck
  - High-waist wide-leg trousers (boulevard)

sheet_files:
  anchor: assets/models/sofia/sheet/sofia_anchor_v1.jpg
  three_quarter: assets/models/sofia/sheet/sofia_sheet_3q.png
  profile: assets/models/sofia/sheet/sofia_sheet_profile.png
  lookdown: assets/models/sofia/sheet/sofia_sheet_lookdown.png

production_files:
  studio: assets/output/pilot-sofia/sofia/studio_dormann_v2.png
  boulevard: assets/output/pilot-sofia/sofia/boulevard_dormann_v1.png
  interior: assets/output/pilot-sofia/sofia/interior_dormann_v1.png
  architectural: assets/output/pilot-sofia/sofia/architectural_dormann_v1.png
  macro: assets/output/pilot-sofia/sofia/macro_dormann_v1.png
  quote_card: assets/output/pilot-sofia/sofia/quote_dormann_v1.png
```

---

## How to fill out a new model spec

When onboarding a new model:

1. **Copy the YAML structure above.**
2. **Heritage** — write a fluid heritage range, not a single country. Sofia's pilot proved that ambiguity produces better skin realism than pinned ethnicity.
3. **Descriptor** — one paragraph, ~50 words. Cover: ethnicity range, age, skin tone, hair colour/texture, eye shape/colour, facial features, bearing.
4. **Wardrobe canon** — 3–5 outfits the model can wear across archetypes. Keep it consistent in palette and silhouette.
5. **Frame anchor** — assign one collection. Some models (e.g. Priya) carry two.
6. **Once anchor is locked,** fill in the `sheet_files` paths. Once production shots are locked, fill in `production_files`.

---

## Texture & white balance discipline (L12)

The descriptor names a skin tone (e.g. Sofia's "warm olive-caramel"). That is the **only** place warmth is allowed to appear in the prompt. Do not repeat warmth in lighting or grading instructions — Nano Banana already biases warm by default, and repeated warmth instructions stack into a bronze cast.

**Anchor + sheet prompts must include both blocks:**

```
SKIN TEXTURE: visible pores across the cheeks, forehead and nose;
fine skin lines around the eyes; subtle skin micro-variation;
real human imperfection — NOT retouched, NOT smoothed, NOT polished,
NOT airbrushed, no AI-smooth pass, no skin filter,
zero beauty retouching.

WHITE BALANCE & GRADING: neutral daylight white balance (5500K),
accurate skin tone with NO warm/orange filter cast,
NOT bronze-graded, NOT golden-hour, NOT teal-and-orange.
Skin colour faithful to the descriptor only — no additional
warmth from lighting or post-processing.
```

**Lighting language:** Use `"Soft north-facing daylight from front-left"` — specific, neutral, not warm. Do NOT use `"warm window light"`, `"warm fill"`, or any phrasing that implies a warm light source for anchor and sheet stage.

**Archetype-scoped warmth is fine.** Boulevard's cream/terracotta palette, Interior Warm's tungsten fill, and Quote Card's warm chiaroscuro are intentional scene grading and stay as-is. The neutralisation only applies to anchor + sheet + Studio + Architectural + Macro.

---

## Why fluid heritage is the canon

The pilot tested two anchor strategies:
- **Pinned ethnicity** (e.g. "Senegalese woman, 35") — Amara's original anchor pool
- **Fluid ethnicity range** (e.g. "Filipino, Latina, SE Asian, or mixed") — Sofia's anchor pool

Result: the fluid range produced **better skin realism** from Nano Banana, with less plastic AI-smooth output and broader audience resonance. The model has more latitude to find a natural rendering when the heritage isn't pinned to a single training-data cluster.

**Lesson:** for any new model, prefer the fluid spec. Single-country specs are reserved for cases where heritage must be unambiguous (e.g. specific cultural campaigns).

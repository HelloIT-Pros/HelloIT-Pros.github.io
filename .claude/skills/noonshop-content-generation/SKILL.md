---
name: noonshop-content-generation
description: Generate brand-consistent visual content for Noonshop using Gemini 2.5 Flash Image (Nano Banana). Use when the user asks to (a) onboard a new model into the Noonshop cast, (b) generate a production shot for an existing model in any of the 6 archetypes (studio, boulevard, interior, architectural, macro, quote card), (c) extend the cast with a new collection (Steel Brown, Dormann, DeNova). Encodes the 10 hard-won lessons from the Sofia × Dormann pilot — apply them every time to avoid relearning failure modes.
---

# Noonshop Content Generation

You are the operator running Noonshop's manual content generation pipeline. The full framework reference is documented at `Noonshop/content-framework.html`. This skill is the executable companion — it tells you what to do and protects you from the failure modes documented in the pilot.

## When to use this skill

- **New model onboarding** — "onboard Amara", "build Ravi's character sheet"
- **Production shot generation** — "generate Sofia's interior shot", "make Léa's boulevard"
- **New collection rollout** — "add Steel Brown to Amara"

## The 6-layer framework

Every generation follows this pipeline. Skipping a layer = drift.

1. **Cast Bible** — locked identity per model (anchor + 3 angle sheet)
2. **Scene Archetype Library** — 6 universal setups (studio, boulevard, interior, architectural, macro, quote card)
3. **Prompt Template** — fixed slot order: `[model_tag] + [descriptor] + [collection_token] + [archetype] + [aspect_ratio] + [mood]`
4. **Input Pattern** — 2 reference images: product (slot 1) + face anchor (slot 2)
5. **QA Gate** — 6-point binary checklist before saving
6. **File Discipline** — `assets/output/[campaign]/[name]/[archetype]_[collection]_v[N].png`

## The non-negotiable rules

These are the L1–L10 lessons. Read `references/lessons.md` for full detail. Summary:

- **L1** Text > image. If text contradicts the reference image, model follows text. Never let prompt language describe the frame differently from the reference.
- **L2** Slot 1 = product, slot 2 = face anchor. Never swap.
- **L3** Avoid "prominent" + "horizontal metal bars" — triggers aviator brow bar hallucination.
- **L4** Never say "do not invent" — model omits the entire product instead of risking inaccuracy.
- **L5** Use exactly 2 reference images. 3+ images causes the model to drop the product entirely.
- **L6** Always include "Clear lenses — eyes fully sharp and in focus, no refraction blur" or eyes will blur through the lens.
- **L7** Use spatial landmark anchors (eyebrow line, nose level), not mm specs.
- **L8** Frames render slightly oversized — use landmark anchors not numerical sizes.
- **L9** Avoid mm specs in bridge language — they pull toward pilot/aviator silhouettes. Strengthen the bridge negative: "single short bar at the nose pad only — NO bar spanning the top, NO brow bar, NO pilot bridge — one bridge element at the nose, period."
- **L10** Quote Card is a **mood**, not a layout. Don't ask the model to leave half the frame empty. Generate gaze-lowered chiaroscuro mood; text overlay is a Canva/Figma step.

## Workflow: generating a single production shot

For **Steps 3–8** (production archetypes):

1. **Confirm inputs are present:**
   - Product reference: `Noonshop/assets/products/[collection]/[FRAME_CODE]_FRONT.png`
   - Face anchor: `Noonshop/assets/models/[name]/sheet/[name]_anchor_v1.jpg`
   - If either is missing, stop and tell the user.

2. **Open a new AI Studio conversation.** Each generation = fresh conversation. Set aspect ratio to **4:5**.

3. **Build the prompt** by filling these slots from `references/prompt-templates.md` for the chosen archetype:
   - `nsm_[name]_01` (the model tag)
   - The model's descriptor sentence (from cast bible)
   - The collection token (from `references/collection-tokens.md`)
   - The archetype scene block (from `references/prompt-templates.md`)
   - Mood + aspect ratio closer

4. **Upload the 2 references in this order** — product first, face second. Slot order is critical.

5. **Run.** Don't iterate blindly. If the result fails QA, name which of the 6 QA points failed, look up the matching lesson (L1–L10), tighten the prompt, regenerate.

6. **QA Gate** — apply all 6 checks (see `references/qa-gate.md`). Pass = save. Fail = name → fix → retry.

7. **File the winner** at `Noonshop/assets/output/pilot-[name]/[name]/[archetype]_[collection]_v[N].png`. Increment version, never overwrite.

## Workflow: onboarding a new model

For **Steps 1–2** (anchor + sheet):

1. **Anchor stage** (Step 1) — generate 10–15 candidates with no reference images. Use the anchor prompt template from `references/prompt-templates.md`. Temperature: **1.3** (the documentary skin renderer requires this). Pick the winner using the accept/reject criteria.

2. **Sheet stage** (Step 2) — using the locked anchor as slot 1, generate 3 angle variations: 3/4 view, profile, lookdown. Save as `[name]_sheet_3q.png` etc.

3. Result: a 4-file character sheet. The model is now "locked" — never generate their face cold again, always start from the anchor.

## Output expectations

When the user asks you to do something with this skill, **return**:

- The status of inputs (present / missing)
- The full prompt you'd run, with all slots filled
- The exact file paths the user should upload to slots 1 and 2
- A QA Gate check after the user reports the result
- The save path for the winner

Do **not** generate the image yourself — Nano Banana lives in AI Studio (`https://aistudio.google.com/`) and the user runs it manually. Your job is to assemble the right prompt, brief the user on what to upload, and validate the output.

## References

- `references/lessons.md` — L1–L10 with examples and fixes
- `references/prompt-templates.md` — Step 1 anchor + Steps 3–8 production templates
- `references/collection-tokens.md` — Steel Brown / Dormann / DeNova frame language
- `references/qa-gate.md` — 6-point checklist + named fixes per failure
- `references/cast-bible.md` — the 8-model cast format + Sofia's locked spec as example
- `references/file-discipline.md` — folder structure + naming convention

## Pilot proof

Sofia × Dormann pilot is complete (April 2026). 4 sheet angles + 6 production archetypes locked. Outputs at `Noonshop/assets/output/pilot-sofia/sofia/`. Use as visual reference for what each archetype should look like.

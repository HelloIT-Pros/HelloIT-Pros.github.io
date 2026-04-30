# File Discipline

A consistent folder structure makes the framework portable across models, collections, and campaigns. Version-numbered, never overwritten.

---

## Folder structure

```
Noonshop/assets/
├── models/
│   └── [name]/
│       └── sheet/
│           ├── [name]_anchor_v1.jpg       ← canonical face lock
│           ├── [name]_sheet_3q.png        ← three-quarter view
│           ├── [name]_sheet_profile.png   ← strict left profile
│           └── [name]_sheet_lookdown.png  ← contemplative downward gaze
│
├── products/
│   ├── dormann/
│   │   ├── DO12410TPE-PO_FRONT.png        ← active reference (warm copper/brown)
│   │   └── …
│   ├── steel-brown/                       ← TBD
│   └── denova/                            ← TBD
│
├── scenes/
│   ├── arch_boulevard/        reference.jpg
│   ├── arch_interior_warm/    reference.jpg
│   ├── arch_architectural/    reference.jpg
│   ├── arch_studio_portrait/  reference.jpg
│   ├── arch_macro_frame/      reference.jpg
│   └── arch_quote_card/       reference.jpg
│
└── output/
    └── pilot-[name]/
        └── [name]/
            ├── studio_[collection]_v[N].png
            ├── boulevard_[collection]_v[N].png
            ├── interior_[collection]_v[N].png
            ├── architectural_[collection]_v[N].png
            ├── macro_[collection]_v[N].png
            └── quote_[collection]_v[N].png
```

---

## Naming rules

### Model files (`models/[name]/sheet/`)
- `[name]_anchor_v1.jpg` — the locked anchor. Lowercase name, `v1` suffix.
- `[name]_sheet_[angle].png` — angle is one of: `3q`, `profile`, `lookdown`. No version suffix on sheet angles.

### Product files (`products/[collection]/`)
- `[FRAME_CODE]_FRONT.png` — frame code uppercase, FRONT view.
- Optionally `_HALF.jpg`, `_SIDE.png` for additional angles (rarely used — see L5).

### Output files (`output/pilot-[name]/[name]/`)
- `[archetype]_[collection]_v[N].png` — archetype lowercase, collection lowercase, N is incrementing integer starting at 1.
- Examples: `studio_dormann_v2.png`, `quote_dormann_v3.png`

---

## Versioning

**Never overwrite.** Always increment `v[N]`. This creates a natural record of which prompt adjustments improved quality.

When you supersede a version, leave the old file in place and add a comment in the framework HTML noting which version is canonical:

```
studio_dormann_v1.png    ← Step 3 · superseded (acetate hallucination, wrong frame)
studio_dormann_v2.png    ← Step 3 · ✓ locked April 2026 (v7 prompt)
```

---

## What goes where — quick reference

| File type | Where | Naming |
|---|---|---|
| Anchor portrait (locked) | `models/[name]/sheet/` | `[name]_anchor_v1.jpg` |
| Sheet angle | `models/[name]/sheet/` | `[name]_sheet_[angle].png` |
| Product reference | `products/[collection]/` | `[FRAME_CODE]_FRONT.png` |
| Scene reference | `scenes/[arch_id]/` | `reference.jpg` |
| Production output | `output/pilot-[name]/[name]/` | `[archetype]_[collection]_v[N].png` |

---

## What NOT to do

- ❌ Do not rename files after they're filed. The framework HTML and other docs may reference the old name.
- ❌ Do not delete superseded versions. They are the iteration record.
- ❌ Do not put outputs at the root of `output/`. Always inside a `pilot-[name]/[name]/` folder.
- ❌ Do not mix archetypes in one filename. `studio_macro_v1.png` is invalid.
- ❌ Do not invent new archetype names. Use only: studio, boulevard, interior, architectural, macro, quote.

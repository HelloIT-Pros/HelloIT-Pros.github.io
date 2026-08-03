# Noon Shop Website — Project Handoff

A working prototype for **Noon Shop Eyewear**, an ophthalmologist-founded, fit-first
eyewear brand. This doc captures everything needed to continue the project in a fresh
session/account. The code is the source of truth; this is the context around it.

---

## What this is
A navy/white "v2" redesign of the Noon Shop storefront, built as a client-review
prototype (static HTML/CSS/JS, no framework). It will eventually become a **custom
Shopify theme**. Noon Shop sells **frames only** (not lenses) — frames ship with demo
lenses; customers take them to their own optician.

Live site (GitHub Pages): **https://helloit-pros.github.io/noonshopwebsite/index-v2.html**

## The pages (all in `noonshopwebsite/`)
- `index-v2.html` — Home (full-bleed hero, value props, featured frames, interactive
  face pressure-point map, one-question-at-a-time fit interview, virtual try-on promo,
  reviews, founder section)
- `shop-v2.html` — Product listing (collection tabs + multi-select filters + views)
- `product-v2.html` — Product detail (gallery, colour variants, virtual try-on, related)
- `cart-v2.html` — Shopping bag
- `checkout-v2.html` — Shopify-style checkout + confirmation
- `story-v2.html` — Our Story (founder, timeline, collections)
- `fit-guide-v2.html` — The Science of Fit
- The old **gold-themed** pages (`index.html`, `shop.html`, etc.) are the previous
  version — left intact for comparison. All new work is the `-v2` set.

## Design system (navy / white)
- Palette: white `#FFFFFF`, cool `#F4F5F5`, ink `#1C1C1C`, **navy accent `#202A44`**
  (+ `#3D4F72` light, `#111828` dark). Whites over creams; navy as accent, used
  sparingly as full-dark sections (founder, fit interview).
- Type: Bebas Neue (display), Outfit (body), Playfair Display (italic accents).
- Tokens are duplicated as CSS `:root` vars at the top of every page (no shared CSS file).

## Key product/brand decisions
- **Frames named after cities**, grouped by region:
  - **Dormann** (Europe): Milano, Vienna, Copenhagen, Lisbon, Oslo
  - **Steel Brown** (Asia): Tokyo, Kyoto, Seoul, Singapore, Osaka
  - **DeNova** (Americas): Manhattan, Toronto, Austin, Vancouver, Savannah
- **DeNova is the most luxurious / most expensive line** ($385–$420), above Steel Brown
  ($320–$345) and Dormann ($275–$295).
- **SKUs**: format `<prefix><5 digits>` — Dormann=`DO`, DeNova=`DR`, Steel Brown=`SB`
  (e.g. `DO12408`). These are **placeholders**; swap for the client's real SKUs.
- **Value props**: lightweight/featherweight (8–12g, "as light as two sheets of paper"),
  thin ("as thin as a coin's edge"), fit-is-fundamental (bridge/cheekbone/width), and
  Anna Park's ophthalmologist story woven throughout.
- Founder is written as **"Anna Park, MD"** — never "Dr." prefix (client preference),
  but "MD"/"ophthalmologist" keep it clear she's a doctor.
- No em dashes in copy (client preference).

## Navigation & global UI
- Top nav: **Shop · Bestsellers · Find Your Fit · Our Story** (+ Cart). Collections live
  inside Shop (tabs) and the footer, not the top nav.
- **Announcement bar** (navy) on every storefront page (not checkout): free shipping +
  promo code `NOON10` (display-only placeholder).
- Mobile: hamburger → full-screen slide-in menu.

## How things work (JS notes)
- **Cart** is `localStorage` (`noonCart`) — cart count + line items shared across pages.
  This is a mock; the real Shopify build replaces it.
- **Shop filters** are multi-select. Groups: bridge, cheekbone, width, shape, material,
  color, weight, price. Weight buckets: Featherlight(8g)/So Light(9–10g)/Light(11–12g);
  price buckets: <$300 / $300–$360 / $360+. URL `?view=bestsellers` and `?view=light`
  (featherweight, sorted lightest-first) drive the nav views. `?collection=` for tabs.
- **Virtual try-on** (`product-v2.html`): browser webcam via `getUserMedia` with a frame
  overlay + size/position sliders; falls back to a model photo if no camera. Deep-linked
  from shop/featured cards via `?frame=<name>&tryon=1`. NOT a real AR fit — a convincing
  demo. Real face-tracking would be a paid SDK in production.
- **Product data** is duplicated in two catalogs (keep in sync): `PRODUCTS` in
  `shop-v2.html` and `CATALOG` in `product-v2.html`.

## Local preview (important gotcha)
Product images live in `../Noonshop/assets/` (one level up from `noonshopwebsite/`).
So you MUST serve from the **repo root**, not from inside `noonshopwebsite/`, or images
404. Example:
```
python3 -m http.server 4600 --directory .   # run from repo root
# then open http://localhost:4600/noonshopwebsite/index-v2.html
```
`qlmanage -t -s 1200 -o <dir> index-v2.html` (run from `noonshopwebsite/`) renders a
static PNG preview if you want a quick visual check.

## Deploy / git
- Repo: `HelloIT-Pros/HelloIT-Pros.github.io`, branch `main` = GitHub Pages (auto-deploys
  in ~1–2 min after push). New files don't overwrite the old prototype.
- Note: the stored `git remote` URL has an **expired token** — plain `git push` fails.
  Push using the authenticated gh CLI token instead:
  `git push "https://x-access-token:$(gh auth token)@github.com/HelloIT-Pros/HelloIT-Pros.github.io.git" main`

## Open items / TODO
- **Timeline dates on Our Story are DRAFT** (Steel Brown 2016, Dormann 2021, Noon Shop
  2023). There's an amber "DRAFT — verify" **review flag** on `story-v2.html` (HTML
  comment `<!-- REVIEW FLAG — remove before launch -->`). Kevin to confirm dates, then
  remove the flag.
- Photography is **stand-in** — on-face shots aren't the literal frame. Production needs
  per-frame on-model + in-hand/on-surface shots. (A `noonshop-content-generation` skill
  exists for generating brand-consistent shots.)
- Real SKUs, real inventory/variants, real Shopify cart & checkout (this is mocked).
- Some deeper sections are still navy-dark (founder, fit interview) — intentional accent,
  but could be lightened if the client wants an even brighter feel.
- Client asked for feedback on: filtering, product names, SKU placement, shopping
  experience, and overall branding/UX (placement over copy).

## Assets
Shared assets: `Noonshop/assets/` (referenced as `../Noonshop/assets/` from the
`-v2` pages) — `product/`, `editorial/`, `faces/`, `refined/`, `anna-park-headshot.png`.

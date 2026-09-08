# Homespire 360: Developer Handoff

Prepared 8 September 2026. Current deployed build: **v21**.

This document is written for a developer who has never seen the project. It covers
what it is, what is built, why it is built the way it is, what must not be broken,
and what to do next. The "why" sections matter more than the "what": several
decisions here look wrong until you know what went wrong before them.

---

## 1. What this is

**Homespire 360** is an installable PWA for Homespire Mortgage loan officers. It is
a single home screen icon that holds every link, portal, and tool an LO needs, plus
the LO's own live loan pipeline and a pre-approval letter generator.

**The problem it exists to solve.** An LO's working day is spread across a dozen
unrelated web portals: Encompass, Total Expert, SharePoint, Paycom, CompenSafe,
benefits vendors. Nobody remembers the URLs, new hires never find them, and the
company has no way to push a new tool to the field.

**The hypothesis under test.** That a "shared links everyone gets, plus custom links
unique to each LO" model is enough to be worth installing. Shared links are company
wide and centrally managed. Custom links are per LO, mostly their own branded
application and business card URLs.

**Success criteria for the prototype.** An LO installs it, keeps it on their home
screen, and opens it without being asked to. Amy LeBlanc is the live test user.

**What it is not.** Not a production system. No backend, no auth, no database. Those
are deliberate omissions, discussed in section 11.

---

## 2. Where it lives

| Thing | Location |
| --- | --- |
| Live app | `https://helloit-pros.github.io/homespire360/index.html?lo=amy-leblanc` |
| Admin | `https://helloit-pros.github.io/homespire360/admin.html` |
| Repo | `github.com/HelloIT-Pros/HelloIT-Pros.github.io`, subfolder `homespire360/` |
| Local clone | `~/Library/CloudStorage/OneDrive-HomespireMortgage/Claude Projects/HelloIT-Pros.github.io` |
| Hosting | GitHub Pages, public, static |
| Brand palette source | `https://helloit-pros.github.io/homespire/2026-2027-roadmap/` |

An LO is identified by the `?lo=<slug>` query parameter. There is no login. The
slug is remembered in `localStorage` so the installed app opens to the right person.
An unknown slug falls back to a picker.

**The host is public and unauthenticated.** Every file in the repo is world readable
and git history is permanent. This single fact drives most of the data decisions
below.

---

## 3. What works today

- Installable on iOS and Android, offline capable, launches from the home screen.
- Home screen with four production tiles, category chips, and grouped link rows.
- Four bottom tabs: Home, Favorites, Search, Profile.
- Per link share buttons via the Web Share API, admin controlled per link.
- Full screen QR code an LO can show a customer in person.
- Favorites, per device and per LO.
- **My Pipeline**: import an Encompass CSV on the device, see your own loans, tap
  into a loan for detail.
- **Pre-approval letter**: generated from a loan, edited on screen, previewed as a
  real PDF, shared to Mail or Messages through the native iOS share sheet.
- Admin master detail screen: manage categories, shared links, and up to 50 LOs,
  with template driven LO creation, draft conflict protection, and JSON export.
- Branded launch screen.

---

## 4. Architecture

Static site. No build step, no bundler, no framework, no npm at runtime. Plain
scripts loaded in order in `index.html`, sharing globals. This is intentional for a
prototype that has to be editable by anyone in a browser, and it is the first thing
to change if this becomes a product.

```
homespire360/
  index.html              LO app shell, inline splash CSS and markup
  admin.html              admin shell
  manifest.webmanifest    PWA manifest
  service-worker.js       caching, network first
  css/styles.css          all styles, ~2260 lines
  js/
    icons.js              inline SVG line icon set (no icon font, no emoji)
    data.js               config load, draft state, fingerprinting, link grouping
    pipeline.js           CSV parse, loan semantics, device storage
    letter.js             pre-approval PDF renderer (pdf-lib)
    pipeline-view.js      pipeline and letter UI, sheet stack
    app.js               LO app render and wiring, splash dismissal
    admin.js              admin master detail, ~1290 lines
  data/
    config.json           the source of truth for all content
    pipeline-sample.json  synthetic demo pipeline, safe to publish
  brand/                  letter artwork, app mark, white glyph for the splash
  icons/                  PWA icons, 192 and 512, any and maskable
  photos/, qr/            committed LO headshots and QR codes
  vendor/pdf-lib.min.js   pinned 1.17.1, vendored, no CDN
  scripts/                one off Python generators, not part of the runtime
```

Script load order in `index.html` matters, because these are globals, not modules:
`icons.js`, `data.js`, `vendor/pdf-lib.min.js`, `pipeline.js`, `letter.js`,
`pipeline-view.js`, `app.js`.

---

## 5. Data model

`data/config.json` is the whole content model.

```jsonc
{
  "appName": "Homespire 360",
  "org": "Homespire Mortgage",
  "templateSlug": "amy-leblanc",       // which LO new LOs are cloned from
  "pipelineCategoryId": "my-business", // which category My Pipeline appears in
  "categories": [
    { "id": "my-business", "label": "My Business", "order": 1 }
  ],
  "genericLinks": [                    // shared, every LO gets these
    { "id": "paycom", "categoryId": "payroll", "label": "Paycom",
      "url": "https://...", "order": 5, "shareable": false }
  ],
  "los": [
    {
      "slug": "amy-leblanc",
      "name": "Amy LeBlanc",
      "title": "Loan Officer",
      "nmls": "1405094",              // the join key to pipeline data
      "phone": "...",
      "email": "...",
      "photo": "photos/amy-leblanc.png",  // or an https URL
      "customLinks": [ /* same shape as genericLinks */ ]
    }
  ]
}
```

Current content: 7 categories, 11 shared links, 3 LOs (Amy LeBlanc, Edwin Oquendo,
Demo LO).

Notes that will save you time:

- Link ids only need to be unique within one LO, not globally.
- `shareable: true` is what draws the share button. When it is switched off the key
  is deleted rather than set to false, so absent and false are the same thing.
- `photo` may be a relative repo path or an absolute https URL. A URL that fails to
  load falls back to initials, never a broken image.
- `nmls` is how a loan is matched to an LO. Display name is the fallback and it is
  fragile. If an LO's pipeline is unexpectedly empty, check NMLS first.
- **A link with a blank URL is invisible in the app.** `hasUrl()` in `data.js`
  treats `""`, `"https://"` and `"http://"` as empty. This is what lets a new LO be
  created from the full template and filled in over time without half built rows
  leaking to the LO. Three separate bugs came from code that did not apply this
  test, so apply it anywhere you count or render links.

---

## 6. Config editing and publishing

There is no backend, so publishing is a git commit. The flow:

1. Open `admin.html`. It loads the published `data/config.json`.
2. Edits are held in `localStorage` as a working draft, so a refresh does not lose
   work.
3. Export downloads a new `config.json`.
4. That file replaces `data/config.json` in the repo, and is committed and pushed.

### The draft conflict system, and why it exists

A saved draft used to be loaded in preference to the published config, always. That
produced a live data loss trap: the admin showed one LO while the app was serving
three, and the Export button would have published a file that silently deleted two
LOs and three shared links.

The fix, in `data.js` and `admin.js`:

- `fingerprint(obj)` produces a cheap content hash (length plus rolling hash).
- When a draft is saved, the fingerprint of the config it was **based on** is stored
  under `DRAFT_BASE_KEY`.
- On boot, a draft is trusted only if its recorded base matches the fingerprint of
  what is published right now.
- A draft that does not match is not loaded and not discarded. It is moved to
  `DRAFT_STASH_KEY` and a conflict bar appears offering to review it.
- Export runs `configDiff(state, publishedConfig)` first and, if anything would
  disappear, names the LOs, shared links and categories by label before letting you
  continue.

Do not simplify this back into "prefer the draft". It was a real incident.

---

## 7. Service worker and staleness

`service-worker.js`. Bump `CACHE_VERSION` and `BUILD` in `js/data.js` together on
every deploy. `BUILD` is displayed in Profile so a phone can be identified as stale
by looking at it.

The worker is **network first with cache as offline fallback only**. It was cache
first for fast launches, which meant an installed phone kept booting a build from
days earlier with nothing on screen to reveal it.

Three staleness bugs were fixed in sequence, and the third is the non obvious one:

1. Cache first meant deploys never reached phones. Now network first.
2. GitHub Pages serves assets with `max-age=600`, and a plain `fetch()` inside the
   worker is answered from the browser's own HTTP cache. So "network first" was
   still handing back a build up to ten minutes old: the worker asked the network,
   the network never got asked. Fixed with `cache: "no-cache"` on the worker's own
   request, which forces a conditional request that an ETag makes nearly free.
3. A navigation request cannot be cloned with a different cache mode, so the Request
   is **rebuilt from `url.href`** rather than derived from `event.request`. Cache
   writes still key off the original request.

Other rules encoded there:

- Only cache `res.ok` responses. Caching a 404 outlives whatever caused it and is
  exactly how a moved folder becomes a permanently broken install.
- A cross origin image response is opaque, reporting status 0 and `ok: false` even
  when it is fine, so those are judged on `res.type === "opaque"` instead.
- Cross origin requests bypass the worker **except images**, so an LO's headshot
  hosted on the company site still appears offline.

Note that the same `max-age=600` affects the app's own first load after a deploy.
A phone can briefly hold a new `index.html` with an old `js/app.js`. This was
observed live during the v21 splash verification and it resolves on the next launch.

---

## 8. My Pipeline

The flagship feature. `js/pipeline.js` (data) and `js/pipeline-view.js` (UI).

### The privacy position, which is not negotiable

The Encompass export used in testing contained 312 named borrowers, $95.9M in loan
amounts, 31 named loan officers, real loan numbers and real interest rates. The host
is public and git history is permanent. Therefore:

- **The CSV is never committed.** `*.csv` is gitignored repo wide.
- **Import happens on the device.** The parsed pipeline lives in that browser's
  `localStorage` and nothing is uploaded. The app works with no pipeline at all.
- **The interest rate column is dropped at parse time, not hidden.** See
  `DROPPED_COLUMNS` in `pipeline.js`. A value that is never stored cannot leak
  through a feature someone adds later.
- **The shipped sample is synthetic**, generated by
  `scripts/make_sample_pipeline.py`. It is fitted to the real book's shape (lognormal
  amounts, median around $280k) but every name and number is invented. It is flagged
  `sample: true` and labelled on every screen, because a demo that cannot be told
  from real data is how someone quotes a fake number in a real meeting.
- `no-pii-check.py` runs before every deploy and refuses to ship if a CSV, an
  Encompass header, or a rate column reaches the repo, or if the sample is not
  flagged synthetic.

The cost of this is real: refreshing the pipeline means importing again. That is the
correct trade for a prototype. The production answer is the same screens reading from
a database behind SSO, at which point only `loadPipeline()` changes.

### Encompass data semantics, learned the hard way

- `CurrentMilestone` still reads "Funding" after the money has been released. A UI
  that trusts the milestone shows finished loans as in flight and, worse, as overdue.
  Completion therefore keys off `FundingFundsReleased`. See `isFunded()`.
- `ClosedDate` is not a closed date. It equalled `EstClosingDate` on 306 of 313 rows.
  It is carried but never labelled as closed anywhere in the UI.
- The CSV parser is quote aware. Encompass wraps headers in square brackets and a
  borrower named `"Smith, Jr., Robert"` would otherwise shift every column after it.
  BOM is stripped.
- `parsePipelineCsv` returns `{ loans, problems, columns }`. A partly malformed file
  reports itself rather than quietly losing loans.

### Fields not yet surfaced

Compared to the realtor portal screenshot that inspired the screen, the export has
no property address and no purchase price. Those two start blank on the letter and
the LO fills them in. There is also no year to date funded data in the export: the
sample funding window spans three days, and only 7 of 313 real rows had funds
released. The funded tiles are therefore labelled by the period they actually cover,
not as YTD. Real YTD needs a separate funded loans report out of Encompass.

---

## 9. Pre-approval letter

`js/letter.js` renders the PDF, `js/pipeline-view.js` drives the editor.

Field rules, set by the business owner:

| Field | Behavior |
| --- | --- |
| Purchase price, loan amount, property address, expiration date | Editable |
| Down payment, LTV | Derived, read only |
| Borrower name, loan type | Locked, from the loan record |
| **Interest rate** | **Excluded entirely. It is not on the letter and there is no field for it.** |

Implementation notes:

- The letter is **drawn in code**, not filled into a supplied template. The original
  plan was to fill an AcroForm PDF. Inspection showed the template had no form
  fields, and drawing it produced a better letter with less machinery. Reversing that
  decision was the right call and is worth remembering if someone proposes going back
  to template filling.
- pdf-lib 1.17.1, vendored locally at `vendor/pdf-lib.min.js`. The CDN is blocked
  from some environments. Do not switch it to a CDN import.
- Fonts are `StandardFonts.TimesRoman` and `TimesRomanBold`. There is no
  `TimesBold`; that typo costs ten minutes.
- Text wrapping is greedy using `widthOfTextAtSize`.
- `letterDerived()` returns `valid: false` when down payment would be negative, which
  blocks preview rather than producing a nonsense letter.
- The agreement sentence is phrased "Homespire Home Loans has pre-approved X" so
  there is no subject verb agreement to get wrong when the borrower is a couple.

### Sharing, and the one rule that matters

Delivery is the **Web Share API with a file**. `mailto:` cannot carry an attachment,
which is why this route exists.

`navigator.canShare({ files })` gates the button. `navigator.share({ files })`
delivers. An `AbortError` means the user dismissed the share sheet; it is not a
failure and must not be reported as one.

**The shared File must be the exact bytes that were previewed.** Any edit to a field
marks the preview stale and requires regenerating before sharing. A letter that says
something different from what the LO just looked at is the worst possible bug in this
feature.

This route was verified on a real iPhone across seven variants (share a pre made PDF,
share one made on tap, share a text file, download, new tab, inline iframe, replace
page), in both Safari and the installed PWA. All worked, and all offered a choice of
destination app. `share-test.html` is the probe page and is worth keeping.

---

## 10. Launch screen

Inline `<style id="splash-style">` in `<head>` and `<div id="splash">` as the first
child of `<body>`, so it paints before `styles.css` and the app scripts arrive. The
house glyph is a base64 data URI, so the splash never waits on a network request.

Palette read directly off the roadmap deck:

```
--deep    #160329    --dark  #2E0A5A    --mid    #6B21A8
--bright  #9333EA    --fuchsia #D946EF  --pink   #F472B6    --gold #F5C842
ground: linear-gradient(160deg, #160329 0%, #370C66 100%)
type:   linear-gradient(150deg, #ffffff 0%, #E9D5FF 42%, #F472B6 100%)
```

Dismissal is tied to `init()` via `Promise.resolve(init()).finally(hideSplash)`, with
`SPLASH_MIN_MS = 550` so it does not flash, and `SPLASH_MAX_MS = 4000` as a hard
release so a hanging config fetch can never trap the user behind it. The element is
**removed from the DOM** after the fade, because a transparent fixed layer left in
place swallows taps.

CSS gotcha worth internalising: a class selector that sets `display` beats the user
agent `[hidden]` rule. Every full screen overlay in this app therefore needs an
explicit `[hidden] { display: none !important }`. Skipping it produces an invisible
layer over the whole app.

---

## 11. Native app handoff: investigated, closed

The question asked was whether tapping a link could open the vendor's native iOS app
instead of the website. The finding, so nobody re-runs it:

- **There is no way to detect whether an app is installed on iOS.**
  `getInstalledRelatedApps()` is Chrome and Android only, and only reports apps you
  own and declare in your own manifest.
- The mechanism that produces the desired behavior is **Universal Links**, and it is
  owned entirely by the vendor. If the vendor publishes an
  `apple-app-site-association` file with an `applinks` key claiming the URL's path,
  tapping their https link opens their app, and falls back to the website when the app
  is absent. No code on our side is involved.
- **Paycom** does not do this. Tapping their login shows a Smart App Banner, which is
  a meta tag on their page rendered by Safari, and it routes through the App Store.
  Not a handoff.
- **Principal** publishes an association file at `principal.com` containing only
  `webcredentials` and no `applinks`. They built the file and deliberately omitted
  the handoff. The `webcredentials` key does mean the site and app share iCloud
  Keychain credentials, so password autofill works across both.
- Custom URL schemes (`paycom://`) are the only way to force an app open and were
  rejected: iOS shows an undetectable "Cannot Open Page" error for anyone without the
  app installed.

Conclusion: enterprise HR and benefits vendors generally do not implement this.
Treat the question as answered.

Two things do fall out of it and are worth doing:

1. **Open external links in real Safari rather than the in app browser view.** Smart
   App Banners and Keychain autofill only work in Safari proper. This helps every
   vendor link, not just one. Not yet implemented.
2. **Verify every shared link as a non admin user.** Three URLs handed over during
   this session were wrong in the same way: they worked for an executive and would not
   work for a loan officer. Paycom's link is the public marketing homepage. A
   replacement offered was Paycom's `/v4/cl/` client and administrator login, not the
   employee self service login. A 401k link offered was an Okta bookmark tile
   (`accounts.principal.com/app/bookmark/<okta-app-id>/login`), which is a per user
   assigned redirector, not a destination. **The shared links have not been validated
   by an actual LO. Do this before rollout.** It is the highest value ten minutes
   available and it needs no code.

---

## 12. Tests

Playwright suites, run against a local static server on port 8099. They live outside
the repo and should be moved into it.

| Suite | Checks | Covers |
| --- | --- | --- |
| `app-smoke.mjs` | 48 | LO app, every LO in config, expectations derived from config.json |
| `pipeline-test.mjs` | 55 | CSV parse, loan semantics, pipeline and letter UI |
| `admin-test.mjs` | 76 | master detail, template derivation, share switch, export guard |
| `draft-conflict-test.mjs` | 19 | the fingerprint and stash system |
| `sw-test.mjs` | 11 | service worker source contract |
| `splash-test.mjs` | 13 | paints immediately, removes itself, releases on a hung fetch |
| `no-pii-check.py` | gate | refuses to ship real data |

All green as of v21.

Two testing rules this project learned:

- **Every new test was verified to fail when the bug it covers is reintroduced.** A
  test that has never failed is not evidence of anything. The first `sw-test.mjs`
  passed with the bug deliberately put back, because Chromium under automation
  revalidates everything regardless. It was rewritten to assert the source contract
  and the reason is documented in the file.
- Expectations are derived from `data/config.json` rather than hardcoded, so adding
  an LO does not break the suite.

---

## 13. Deploy procedure

1. Bump `CACHE_VERSION` in `service-worker.js` and `BUILD` in `js/data.js` together.
2. Run all suites plus `no-pii-check.py`.
3. Copy changed files into `homespire360/` in the local clone of
   `HelloIT-Pros.github.io`.
4. Commit and push. GitHub Pages takes roughly 60 to 120 seconds.
5. Verify live in a clean browser with the service worker unregistered and caches
   cleared. This is the only way to tell "the site is wrong" from "this device is
   wrong", and it caught a false alarm during the v21 verification.

---

## 14. Landmines

Read this section before changing anything.

1. **Never commit a CSV.** `noonshopwebsite/2026-08-03HomespireMTDEstClose.csv`
   currently sits untracked inside the repo working tree: 279 named borrowers,
   $89.8M, 29 named officers. It is gitignored and confirmed absent from history, but
   it is one `git add -f` or one ignore rule edit away from being permanent on a
   public site. **Move it out of the repo entirely rather than relying on the ignore
   rule.**
2. **A GitHub personal access token is embedded in the remote URL of the separate
   `Homespire/homespire.github.io` clone.** It appears to be expired. Rotate it and
   switch that remote to SSH or a credential helper. Do not echo it anywhere.
3. **No emojis and no em dashes** anywhere in the UI or in written material for this
   project. Use the inline SVG line icons in `js/icons.js`.
4. Do not reintroduce cache first in the service worker.
5. Do not make a draft load in preference to the published config.
6. Do not put an interest rate on the letter or in storage.
7. Do not share a letter file that was not the previewed bytes.
8. Do not count or render a link without the `hasUrl()` test.
9. Do not make the production tiles clickable. That was an explicit product decision.
10. Every full screen overlay needs `[hidden] { display: none !important }`.
11. Inputs must be at least 16px or iOS zooms on focus.

---

## 15. Open items and recommended next steps

**Immediate, no code required**

- Validate all 11 shared links as a loan officer, not as an administrator (section 11).
- Move the stray CSV out of the repo (section 14).
- Rotate the leaked PAT (section 14).

**Small and worth doing**

- Search on the pipeline list. It is the next thing an LO will ask for.
- Open external links in Safari rather than the in app view.
- Add `id` to the manifest. It is the only absent field and is a plausible
  mitigation for an unresolved Android Play Protect "Unsafe app blocked" dialog seen
  on one device. The manifest is otherwise valid, with all four icons and a maskable
  pair. WebAPK `targetSdkVersion` is set by Google's minting service, not by anything
  on the site, so there is no site side fix for that part.
- Move the test suites into the repo and wire them to a script.

**The real migration, in order**

1. **Get off public GitHub Pages first.** Everything else is blocked by this. As long
   as the host is public and unauthenticated, no real data can ever live server side,
   and the current device local design is the only responsible option.
2. **Then add auth.** Homespire uses Microsoft 365, so Entra ID SSO is the natural
   choice and LOs are already signed in.
3. **Then add the database.** Supabase was proposed and is a reasonable fit, but note
   that the Supabase anon key is public by design and row level security is the only
   thing protecting the data. Putting borrower level pipeline data behind an anon key
   without auth and RLS in place would be worse than the current device local
   approach, not better. Auth is a prerequisite, not a follow up.
4. **Then automate ingestion.** A nightly Encompass export into the database replaces
   the manual CSV import, and only `loadPipeline()` changes.
5. **Then consider a build step.** Globals and script tags are fine for a prototype
   and will not survive a team.

**On tooling.** This codebase is at the size where a coding agent working directly in
the repo is more efficient than file by file handoff. The natural moment to move is
when secrets arrive, meaning step 2 above, because at that point local environment
files and real credentials enter the picture.

---

## 16. Decision log

Short version of why things are the way they are, for anyone tempted to "fix" them.

| Decision | Reason |
| --- | --- |
| No backend | Prototype validating a content model, not a system |
| Config in a single committed JSON | One file to review, one commit to publish, no infrastructure |
| Draft in localStorage, export to publish | Refresh safety without a server |
| Network first service worker | Being current beats saving a round trip while shipping daily |
| Pipeline on the device only | Public host, permanent history, real borrower names |
| Rate dropped at parse time | Cannot leak what was never stored |
| Synthetic sample, not anonymised real | Stripping names still publishes every named officer's real book |
| Letter drawn in code | Supplied template had no form fields, and drawing it is better |
| pdf-lib vendored, not CDN | CDN unreachable in some environments, and pinning is safer |
| Web Share with a file | `mailto:` cannot attach |
| Template driven LO creation | Creating an LO from nothing was too much work in practice |
| Blank URL means invisible | A half configured LO is a normal state, not an error |
| Amy as the template LO | She is the most complete real record |
| Production tiles not clickable | Explicit product decision |
| Line icons, no emoji | House style |

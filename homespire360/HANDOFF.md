# Homespire 360: Developer Handoff

**Revision 2. Prepared 9 September 2026. Current deployed build: v28.**
Revision 1 was prepared 8 September at build v21.

This document is written for a developer who has never seen the project. It covers
what it is, what is built, why it is built the way it is, what must not be broken,
and what to do next. The "why" sections matter more than the "what": several
decisions here look wrong until you know what went wrong before them.

**Section 2 is the changelog since revision 1.** If you read revision 1, read that
section and then skip to whatever it points you at.

---

## 1. What this is

**Homespire 360** is an installable PWA for Homespire Mortgage loan officers. It is
a single home screen icon holding every link, portal, and tool an LO needs, plus the
LO's own loan pipeline and a pre-approval letter generator.

**The problem it exists to solve.** An LO's working day is spread across a dozen
unrelated web portals: Encompass, Total Expert, SharePoint, Paycom, CompenSafe,
benefits vendors. Nobody remembers the URLs, new hires never find them, and the
company has no way to push a new tool to the field.

**The hypothesis under test.** That a "shared links everyone gets, plus custom links
unique to each LO" model is enough to be worth installing.

**Success criteria for the prototype.** An LO installs it, keeps it on their home
screen, and opens it without being asked to. Amy LeBlanc is the live test user.

**What it is not.** Not a production system. No backend, no auth, no database. Those
are deliberate omissions, discussed in section 16.

---

## 2. What changed since revision 1

Seven deploys, v22 through v28. Roughly a thousand lines added, almost all of it in
the pipeline and letter feature.

### 2.1 The funded tiles flip between month and year (v22, v24)

The two non-purple production tiles on Home now carry two periods: month to date on
the front, year to date on the back. Tapping either one turns **both**, so the pair
can never show one period for units and another for volume.

- `fundedTotals(loans, today)` in `js/pipeline.js` returns
  `{ month: {units, volume}, year: {units, volume} }`, matching on ISO date prefix.
- Both faces are rendered up front and the flip is a single class on `.tile-grid`,
  so the animation is not cut short by a re-render and the chosen period survives a
  category chip changing the view. `fundedPeriod` holds it, defaulting to month on
  every launch.
- The flip runs at 0.95s. At 0.55s it read as the numbers being swapped rather than
  as one card turning over.
- The pipeline screen's funded card is month to date too, and says so in its label.
  Two screens showing different periods under the same word "Funded" is how a number
  gets quoted wrongly.

**A real export barely carries any funded history**, so month and year would have
read the same. `scripts/make_sample_pipeline.py` now generates loans funded earlier
in the year, and anchors the recent ones to a *day of the current month* rather than
to a day offset, because "six days ago" is last month if you open the app on the
3rd, and the month face would have read zero through the first week of every month.
See `monthDayToIso` in `js/pipeline.js`.

### 2.2 The launch screen holds longer (v23)

`SPLASH_MIN_MS` is 1500, up from 550, and the fade is 700ms. It was released the
moment `init()` resolved, which on a warm cache is under a second, so the launch
screen was a flash. `SPLASH_MAX_MS` is 4500 as the hard release.

### 2.3 Purchase price and down payment on the loan detail (v23, v25)

`loanEquity(loan)` computes price, down payment and LTV, returning null when there is
no price or when the loan exceeds the price.

**The purchase price row is always rendered, even when empty.** It was originally
dropped along with every other empty row, and the result was a screen that looked
like it had forgotten the field. It came back as a bug report. Empty now says why:
"Not applicable on a refinance", or "Not on file yet" on a purchase. Down payment
stays derived and so appears only when there is a price to derive it from, because
two placeholder rows saying the same thing is noise.

### 2.4 Team members on the file (v23, v25, v27)

The loan detail carries a collapsed strip of initials labelled "Team members".
Opened, it lists the processor and the loan officer assistant, each with a call
button, and two icons at the bottom that message whoever is ticked: an envelope for
email, a bubble for a text.

- Everyone starts ticked, so reaching the whole file is one tap and selection is only
  work when a subset is wanted.
- With nobody ticked both icons lose their `href` and are marked `aria-disabled`. A
  mail button that opens an empty compose window is worse than one that is visibly
  unavailable.
- Calling stays on the person, since there is no group call. That also keeps a second
  envelope off each row.
- **Nothing is sent by the app.** Both icons are plain `mailto:` and `sms:` links
  that hand off to Mail and Messages with recipients and a subject filled in.

**Where the contact details come from** is the part worth understanding. See 5.3.

### 2.5 The pipeline tiles navigate (v25, v26)

The two purple tiles are buttons that open My Pipeline, the screen they summarise,
and carry a chevron so they read as somewhere to go. They also bring the My Pipeline
row into view on the page behind the sheet, so dismissing the sheet lands on that
section rather than the top of Home.

This **reverses** an earlier decision that the production tiles be read only. The
funded pair still does not navigate, because tapping those turns them over.

### 2.6 No pre-approval letter on a refinance (v26)

A refinance has no purchase to be pre-approved for. The button is gone on those loans
and a line says why, rather than the button silently vanishing. The guard is also
inside `startLetter`, so another route to the letter cannot make a refinance
reachable by accident.

### 2.7 Revision 2 letter copy, and an editor that gates nothing (v28)

**The app was still rendering revision 1 copy.** Revision 2 had been written into the
spec document and the sample PDF and never into `js/letter.js`. That is fixed. Full
field rules are in section 9.

The editor no longer gates anything:

- Every field is optional. An LO reissuing after a price change should not have to
  retype an address, and one switching FHA to conventional may change nothing else.
- **The preview is always available.** It was blocked until every box was full, which
  made a partial letter impossible to even look at.
- A value left empty is **left off the letter**, not printed as `$0` or as an empty
  `Property:` line.
- Loan type is now editable, as a select.
- **Valid through has no field at all.** It is stated as 60 days from the day the
  letter is made and computed inside the renderer, so it cannot arrive stale from an
  editor left open.
- A loan larger than its purchase price now **warns** instead of blocking. The LO
  decides what to send.
- The fields were reading as a locked summary rather than a form: labels, borders and
  values were all within a shade of each other. Real field edges, darker labels and a
  focus ring fix that.
- The button reads "Modify pre-approval letter".

---

## 3. Where it lives

| Thing | Location |
| --- | --- |
| Live app | `https://helloit-pros.github.io/homespire360/index.html?lo=amy-leblanc` |
| Admin | `https://helloit-pros.github.io/homespire360/admin.html` |
| Repo | `github.com/HelloIT-Pros/HelloIT-Pros.github.io`, subfolder `homespire360/` |
| Local clone | `~/Library/CloudStorage/OneDrive-HomespireMortgage/Claude Projects/HelloIT-Pros.github.io` |
| Hosting | GitHub Pages, public, static |
| Brand palette source | `https://helloit-pros.github.io/homespire/2026-2027-roadmap/` |

An LO is identified by the `?lo=<slug>` query parameter. There is no login. The slug
is remembered in `localStorage`. An unknown slug falls back to a picker.

**The host is public and unauthenticated.** Every file in the repo is world readable
and git history is permanent. This single fact drives most of the data decisions
below.

---

## 4. Architecture

Static site. No build step, no bundler, no framework, no npm at runtime. Plain
scripts loaded in order in `index.html`, sharing globals. Intentional for a prototype
that has to be editable by anyone in a browser, and the first thing to change if this
becomes a product.

```
homespire360/
  index.html              LO app shell, inline splash CSS and markup
  admin.html              admin shell
  manifest.webmanifest    PWA manifest
  service-worker.js       caching, network first
  css/styles.css          all styles, ~2700 lines
  js/
    icons.js              inline SVG line icon set (no icon font, no emoji)
    data.js               config load, draft state, fingerprinting, link grouping
    pipeline.js           CSV parse, loan semantics, equity, team, device storage
    letter.js             pre-approval PDF renderer (pdf-lib)
    pipeline-view.js      pipeline, loan detail, team strip, letter editor
    app.js                LO app render and wiring, splash dismissal
    admin.js              admin master detail
  data/
    config.json           the source of truth for all content
    pipeline-sample.json  synthetic demo pipeline, safe to publish
  brand/                  letter artwork, app mark, white glyph for the splash
  icons/                  PWA icons, 192 and 512, any and maskable
  vendor/pdf-lib.min.js   pinned 1.17.1, vendored, no CDN
  scripts/                one off Python generators, not part of the runtime
```

Script load order in `index.html` matters, because these are globals, not modules:
`icons.js`, `data.js`, `vendor/pdf-lib.min.js`, `pipeline.js`, `letter.js`,
`pipeline-view.js`, `app.js`.

---

## 5. Data model

### 5.1 config.json

```jsonc
{
  "appName": "Homespire 360",
  "org": "Homespire Mortgage",
  "templateSlug": "amy-leblanc",       // which LO new LOs are cloned from
  "pipelineCategoryId": "my-business", // which category My Pipeline appears in
  "categories": [ { "id": "my-business", "label": "My Business", "order": 1 } ],
  "genericLinks": [                    // shared, every LO gets these
    { "id": "paycom", "categoryId": "payroll", "label": "Paycom",
      "url": "https://...", "order": 5, "shareable": false }
  ],
  "los": [
    { "slug": "amy-leblanc", "name": "Amy LeBlanc", "title": "Loan Officer",
      "nmls": "1405094",              // the join key to pipeline data
      "phone": "...", "email": "...",
      "photo": "photos/amy-leblanc.png",  // or an https URL
      "customLinks": [ /* same shape as genericLinks */ ] }
  ],
  "team": {                            // NEW in revision 2, see 5.3
    "r-alvarez": { "phone": "(225) 555-0142", "email": "ralvarez@..." }
  }
}
```

Current content: 7 categories, 11 shared links, 3 LOs, 7 team directory entries.

Notes that will save you time:

- Link ids only need to be unique within one LO, not globally.
- `shareable: true` draws the share button. Switching it off **deletes** the key, so
  absent and false are the same thing.
- `photo` may be a repo path or an absolute https URL. A URL that fails to load falls
  back to initials, never a broken image.
- `nmls` is how a loan is matched to an LO. Display name is the fallback and it is
  fragile. If a pipeline is unexpectedly empty, check NMLS first.
- **A link with a blank URL is invisible in the app.** `hasUrl()` in `data.js` treats
  `""`, `"https://"` and `"http://"` as empty. This lets a new LO be created from the
  full template and filled in over time. Three separate bugs came from code that did
  not apply this test, so apply it anywhere you count or render links.

### 5.2 Columns the export does not carry yet

`FUTURE_COLUMNS` in `js/pipeline.js` reads six columns that today's Encompass export
does not have: `PurchasePrice`, `LoanProcessorEmail`, `LoanProcessorPhone`,
`LoanOfficerAssistant`, `LoanOfficerAssistantEmail`, `LoanOfficerAssistantPhone`.

They are read now so that the day those columns appear, no code changes. Unlike
`COLUMNS` they are never reported as missing, because their absence is the normal
case rather than a malformed file.

**The names are provisional.** Whoever builds the export decides the real headers;
check these against the first file that has them.

### 5.3 How a name becomes something tappable

`teamForLoan(loan, directory)` resolves each person in three steps, in order:

1. the loan's own columns, once the export carries them
2. the `team` directory in `config.json`, keyed by a slug of the person's name
3. nothing, in which case the person is still listed by name with no contact actions

Step 2 is the bridge. A real export today gives a processor name and nothing else, so
the directory is what makes that name tappable without waiting on the export.

**There is no admin UI for the directory yet.** Adding people means editing
`config.json`. That is the obvious next admin task.

---

## 6. Config editing and publishing

No backend, so publishing is a git commit:

1. Open `admin.html`. It loads the published `data/config.json`.
2. Edits are held in `localStorage` as a working draft.
3. Export downloads a new `config.json`.
4. That file replaces `data/config.json` in the repo, committed and pushed.

### The draft conflict system, and why it exists

A saved draft used to be loaded in preference to the published config, always. That
produced a live data loss trap: the admin showed one LO while the app served three,
and Export would have published a file that silently deleted two LOs and three
shared links.

The fix, in `data.js` and `admin.js`:

- `fingerprint(obj)` produces a cheap content hash.
- A saved draft records the fingerprint of the config it was **based on**.
- On boot, a draft is trusted only if that base matches what is published now.
- A mismatched draft is not loaded and not discarded. It moves to `DRAFT_STASH_KEY`
  and a conflict bar offers to review it.
- Export runs `configDiff(state, publishedConfig)` and names anything that would
  disappear before letting you continue.

Do not simplify this back into "prefer the draft". It was a real incident.

---

## 7. Service worker and staleness

`service-worker.js`. Bump `CACHE_VERSION` and `BUILD` in `js/data.js` together on
every deploy. `BUILD` shows in Profile so a phone can be identified as stale.

**Network first, cache as offline fallback only.** Three staleness bugs were fixed in
sequence, and the third is the non-obvious one:

1. Cache first meant deploys never reached phones. Now network first.
2. GitHub Pages serves `max-age=600`, and a plain `fetch()` inside the worker is
   answered from the browser's own HTTP cache, so "network first" still handed back a
   build up to ten minutes old: the worker asked the network, the network never got
   asked. Fixed with `cache: "no-cache"`, forcing a conditional request.
3. A navigation request cannot be cloned with a different cache mode, so the Request
   is **rebuilt from `url.href`**. Cache writes still key off the original request.

Other rules encoded there:

- Only cache `res.ok`. Caching a 404 outlives whatever caused it.
- A cross origin image response is opaque, reporting status 0 and `ok: false` even
  when fine, so those are judged on `res.type === "opaque"`.
- Cross origin requests bypass the worker **except images**, so a headshot hosted on
  the company site still appears offline.

The same `max-age=600` affects the app's own first load after a deploy: a phone can
briefly hold a new `index.html` with an old `js/app.js`. Observed live. It resolves
on the next launch.

---

## 8. My Pipeline

The flagship feature. `js/pipeline.js` (data) and `js/pipeline-view.js` (UI).

### The privacy position, which is not negotiable

The export used in testing contained 312 named borrowers, $95.9M in loan amounts, 31
named loan officers, real loan numbers and real interest rates. The host is public
and git history is permanent. Therefore:

- **The CSV is never committed.** `*.csv` is gitignored repo wide.
- **Import happens on the device.** The parsed pipeline lives in that browser's
  `localStorage`. Nothing is uploaded. The app works with no pipeline at all.
- **The interest rate column is dropped at parse time, not hidden.** See
  `DROPPED_COLUMNS`. A value never stored cannot leak through a later feature.
- **The shipped sample is synthetic**, from `scripts/make_sample_pipeline.py`, fitted
  to the real book's shape but with every name and number invented. Flagged
  `sample: true` and labelled on every screen, because a demo that cannot be told
  from real data is how someone quotes a fake number in a real meeting.
- `no-pii-check.py` runs before every deploy and refuses to ship if a CSV, an
  Encompass header, or a rate column reaches the repo, or if the sample is not
  flagged synthetic.

The cost is real: refreshing means importing again. Correct for a prototype. The
production answer is the same screens reading from a database behind SSO, at which
point only `loadPipeline()` changes.

### Encompass data semantics, learned the hard way

- `CurrentMilestone` still reads "Funding" after the money has been released. A UI
  that trusts the milestone shows finished loans as in flight and as overdue.
  Completion keys off `FundingFundsReleased`. See `isFunded()`.
- `ClosedDate` is not a closed date. It equalled `EstClosingDate` on 306 of 313 rows.
  Carried but never labelled as closed anywhere.
- The parser is quote aware. Encompass wraps headers in square brackets and a borrower
  named `"Smith, Jr., Robert"` would otherwise shift every column after it. BOM
  stripped.
- `parsePipelineCsv` returns `{ loans, problems, columns }`. A partly malformed file
  reports itself rather than quietly losing loans.

### Still absent from the export

No property address. No year to date funded history worth the name: the sample
funding window in the real file spanned three days, and only 7 of 313 rows had funds
released. **The year face of the funded tiles will read the same as the month until a
funded loans report covering the year is imported.** That is a data problem, not a
display one, and the product owner has accepted it.

---

## 9. Pre-approval letter

`js/letter.js` renders the PDF. `js/pipeline-view.js` drives the editor.

**Revision 2 copy, approved 8 September 2026.** The authoritative copy specification
is the Word document `Homespire360-PreApproval-Letter-Copy-v2.docx`, which colour
codes every dynamic value by where it comes from. A rendered sample is
`Homespire360-PreApproval-Sample-Letter.pdf`. Both were handed over separately.

| Field | Behaviour |
| --- | --- |
| Purchase price, loan amount, property address, loan type | Editable, all optional |
| Two extra conditions | Editable, optional, 140 chars each |
| Borrower name | Locked, from the loan record |
| Valid through | Computed, `letterDate + 60` calendar days, no field, no override |
| Down payment, LTV | Computed, shown in the editor only, never on the letter |
| **Interest rate** | **Excluded entirely. No field, no label, no stored value.** |

Copy rules the code enforces:

- The loan type is followed by the fixed word **loan**, appended in the copy and not
  part of the value. Do not store the word in the data, or a record already
  containing it renders "Conventional loan loan".
- The opening sentence leads with the lender, deliberately. A borrower value can hold
  two names and guessing has/have from a name is unreliable, so the sentence is built
  to have no agreement to get wrong. Do not restructure it.
- **Four standing conditions**, always present, always first, in order: satisfactory
  appraisal, clear title, executed contract, verified assets and cash to close.
- A blank extra condition produces no bullet, no empty bullet, no placeholder.
- **An empty field is omitted, not printed.** No `$0` rows, no empty `Property:`
  line. A letter with nothing filled in still renders and still carries the borrower
  and the expiry.

Implementation notes:

- The letter is **drawn in code**, not filled into a template. The original plan was
  to fill an AcroForm PDF; inspection showed the template had no form fields, and
  drawing it produced a better letter with less machinery. Worth remembering if
  someone proposes going back.
- pdf-lib 1.17.1, vendored at `vendor/pdf-lib.min.js`. Do not switch to a CDN.
- Fonts are `StandardFonts.TimesRoman` and `TimesRomanBold`. There is no `TimesBold`.
- `letterOmissions()` is **advisory**. Nothing it returns blocks a preview or a send.

### Sharing, and the one rule that matters

Delivery is the **Web Share API with a file**. `mailto:` cannot carry an attachment,
which is why this route exists.

`navigator.canShare({ files })` gates the button, `navigator.share({ files })`
delivers, and an `AbortError` means the user dismissed the sheet: not a failure, and
it must not be reported as one.

**The shared File must be the exact bytes that were previewed.** Any edit marks the
preview stale and requires regenerating. A letter that says something different from
what the LO just looked at is the worst possible bug in this feature.

Verified on a real iPhone across seven variants, in Safari and in the installed PWA.
`share-test.html` is the probe page and is worth keeping.

---

## 10. Launch screen

Inline `<style id="splash-style">` in `<head>` and `<div id="splash">` as the first
child of `<body>`, so it paints before `styles.css` and the app scripts. The glyph is
a base64 data URI, so the splash never waits on a network request.

Palette read directly off the roadmap deck:

```
--deep #160329  --dark #2E0A5A  --mid #6B21A8  --bright #9333EA
--fuchsia #D946EF  --pink #F472B6  --gold #F5C842
ground: linear-gradient(160deg, #160329 0%, #370C66 100%)
type:   linear-gradient(150deg, #ffffff 0%, #E9D5FF 42%, #F472B6 100%)
```

Dismissal is tied to `init()` via `Promise.resolve(init()).finally(hideSplash)`, with
`SPLASH_MIN_MS = 1500` so it does not flash and `SPLASH_MAX_MS = 4500` as a hard
release. The element is **removed from the DOM** after the fade, because a
transparent fixed layer left in place swallows taps.

CSS gotcha worth internalising: a class selector that sets `display` beats the user
agent `[hidden]` rule. Every full screen overlay and every hideable block in this app
therefore needs an explicit `[hidden] { display: none !important }`.

---

## 11. Native app handoff: investigated, closed

Whether tapping a link can open the vendor's native iOS app. The finding, so nobody
re-runs it:

- **There is no way to detect whether an app is installed on iOS.**
  `getInstalledRelatedApps()` is Chrome and Android only and only reports apps you own
  and declare in your own manifest.
- The mechanism is **Universal Links**, owned entirely by the vendor. If the vendor
  publishes an `apple-app-site-association` file with an `applinks` key claiming the
  URL's path, their https link opens their app and falls back to the website when it
  is absent. No code on our side is involved.
- **Paycom** does not do this. Their login shows a Smart App Banner, a meta tag on
  their own page, which routes through the App Store. Not a handoff.
- **Principal** publishes an association file containing only `webcredentials` and no
  `applinks`. They built the file and deliberately omitted the handoff. The
  `webcredentials` key does mean site and app share iCloud Keychain credentials.
- Custom URL schemes were rejected: iOS shows an undetectable "Cannot Open Page"
  error for anyone without the app installed.

Two things fall out of it and are still worth doing:

1. **Open external links in real Safari rather than the in-app browser view.** Smart
   App Banners and Keychain autofill only work in Safari proper. Helps every vendor
   link. Not yet implemented.
2. **Verify every shared link as a non-admin user.** Three URLs handed over during
   this work were wrong the same way: they worked for an executive and would not work
   for a loan officer. Paycom's link is the public marketing homepage; a replacement
   offered was Paycom's `/v4/cl/` client and administrator login, not employee self
   service; a 401k link offered was an Okta bookmark tile
   (`accounts.principal.com/app/bookmark/<okta-app-id>/login`), a per user assigned
   redirector rather than a destination. **The shared links have not been validated by
   an actual LO. Do this before rollout.** Highest value ten minutes available, and it
   needs no code.

---

## 12. Tests

Playwright suites against a local static server on port 8099. They live outside the
repo and should be moved into it.

| Suite | Checks | Covers |
| --- | --- | --- |
| `app-smoke.mjs` | 48 | LO app, every LO in config, expectations derived from config.json |
| `pipeline-test.mjs` | 139 | CSV parse, loan semantics, tiles, flip, equity rows, team strip, letter |
| `admin-test.mjs` | 76 | master detail, template derivation, share switch, export guard |
| `draft-conflict-test.mjs` | 19 | the fingerprint and stash system |
| `sw-test.mjs` | 11 | service worker source contract |
| `splash-test.mjs` | 19 | paints immediately, holds, removes itself, releases on a hung fetch |
| `no-pii-check.py` | gate | refuses to ship real data |

All green at v28.

Three testing rules this project learned the hard way:

- **Every new test is verified to fail when the bug it covers is reintroduced.** A
  test that has never failed is not evidence of anything. The first `sw-test.mjs`
  passed with the bug deliberately put back, because Chromium under automation
  revalidates everything regardless. The first version of the "tile brings the row
  into view" test passed with the code deleted, because on a tall viewport the row was
  already visible; it now runs on a short viewport. Both are documented in the files.
- **Assert on the artefact, not the source, wherever possible.** Letter copy is
  verified by rendering the real PDF in the browser, handing the bytes back to Node
  and running `pdftotext` over them. pdf-lib compresses its content streams, so the
  copy is not greppable in the file, and asserting on the source of `letter.js` would
  only prove the code says what it says.
- Expectations come from `data/config.json` rather than being hardcoded, so adding an
  LO does not break the suite.

---

## 13. Deploy procedure

1. Bump `CACHE_VERSION` in `service-worker.js` and `BUILD` in `js/data.js` together.
2. Run all suites plus `no-pii-check.py`.
3. Copy changed files into `homespire360/` in the local clone.
4. Commit and push. GitHub Pages takes roughly 60 to 120 seconds.
5. Verify live in a clean browser with the service worker unregistered and caches
   cleared. This is the only way to tell "the site is wrong" from "this device is
   wrong", and it caught a false alarm during the v21 verification.

---

## 14. Landmines

Read this before changing anything. Every rule here exists because something already
went wrong.

1. **Never commit a CSV.** `noonshopwebsite/2026-08-03HomespireMTDEstClose.csv` still
   sits untracked in the repo working tree: 279 named borrowers, $89.8M, 29 named
   officers. Gitignored and confirmed absent from history, but one `git add -f` from
   being permanent on a public site. **Move it out of the repo entirely.**
2. **A GitHub personal access token is embedded in the remote URL of the separate
   `Homespire/homespire.github.io` clone.** Appears expired. Rotate it and switch that
   remote to SSH or a credential helper. Do not echo it anywhere.
3. **No emojis and no em dashes** anywhere in the UI or in written material for this
   project. Use the inline SVG line icons in `js/icons.js`.
4. Do not reintroduce cache first in the service worker.
5. Do not make a draft load in preference to the published config.
6. Do not put an interest rate on the letter or in storage.
7. Do not share a letter file that was not the previewed bytes.
8. Do not count or render a link without the `hasUrl()` test.
9. **Do not silently omit a field the user expects to see.** This happened twice: the
   purchase price row and the letter button on refinances. Both came back as bug
   reports. An absent thing should say why it is absent.
10. Do not re-gate the letter preview. Every field is optional by design.
11. Do not make the funded tiles navigate, or the pipeline tiles flip.
12. Every full screen overlay and hideable block needs `[hidden] { display: none !important }`.
13. Inputs must be at least 16px or iOS zooms on focus.
14. A form field must not look like a read only row. That is what the letter editor
    got wrong.

---

## 15. Open items

**Immediate, no code required**

- Validate all 11 shared links as a loan officer, not as an administrator (11.2).
- Move the stray CSV out of the repo (14.1).
- Rotate the leaked PAT (14.2).
- Decide whether down payment and LTV should appear on the letter. They are computed
  and shown in the editor but appear nowhere in the copy.

**Small and worth doing**

- Search on the pipeline list. The next thing an LO will ask for.
- A Team section in the admin, so people and contact details can be added without
  editing `config.json`.
- Open external links in Safari rather than the in-app view.
- Add `id` to the manifest. The only absent field, and a plausible mitigation for an
  unresolved Android Play Protect "Unsafe app blocked" dialog seen on one device. The
  manifest is otherwise valid. WebAPK `targetSdkVersion` is set by Google's minting
  service, so there is no site side fix for that part.
- Move the test suites into the repo and wire them to a script.
- Confirm the provisional `FUTURE_COLUMNS` names against the first export that has
  them (5.2).

**The real migration, in order**

1. **Get off public GitHub Pages first.** Everything else is blocked by this. As long
   as the host is public and unauthenticated, no real data can live server side and
   the current device local design is the only responsible option.
2. **Then add auth.** Homespire uses Microsoft 365, so Entra ID SSO is the natural
   choice and LOs are already signed in.
3. **Then add the database.** Supabase is a reasonable fit, but the anon key is public
   by design and row level security is the only thing protecting the data. Putting
   borrower level pipeline data behind an anon key without auth and RLS in place would
   be worse than the current device local approach. Auth is a prerequisite, not a
   follow up.
4. **Then automate ingestion.** A nightly Encompass export into the database replaces
   the manual CSV import, and only `loadPipeline()` changes.
5. **Then consider a build step.** Globals and script tags are fine for a prototype
   and will not survive a team.

**On tooling.** This codebase is at the size where a coding agent working directly in
the repo is more efficient than file by file handoff. The natural moment to move is
when secrets arrive, meaning step 2, because that is when local environment files and
real credentials enter the picture.

---

## 16. Decision log

Short version of why things are the way they are, for anyone tempted to "fix" them.

| Decision | Reason |
| --- | --- |
| No backend | Prototype validating a content model, not a system |
| Config in a single committed JSON | One file to review, one commit to publish |
| Draft in localStorage, export to publish | Refresh safety without a server |
| Network first service worker | Being current beats saving a round trip while shipping daily |
| Pipeline on the device only | Public host, permanent history, real borrower names |
| Rate dropped at parse time | Cannot leak what was never stored |
| Synthetic sample, not anonymised real | Stripping names still publishes every named officer's real book |
| Letter drawn in code | Supplied template had no form fields, and drawing it is better |
| pdf-lib vendored, not CDN | CDN unreachable in some environments, and pinning is safer |
| Web Share with a file | `mailto:` cannot attach |
| Letter fields all optional | A price change needs no new address; gating made partial letters unviewable |
| Expiry computed, never editable | One rule, no override, cannot arrive stale |
| Empty letter fields omitted | Better than `$0` on a pre-approval |
| Template driven LO creation | Creating an LO from nothing was too much work in practice |
| Blank URL means invisible | A half configured LO is a normal state, not an error |
| Empty purchase price row still shown | Hiding it read as a missing feature |
| Team selection defaults to everyone | Keeps the common case one tap, scales to a bigger team |
| Group message via mailto and sms links | The app must not send anything itself |
| Calling stays per person | There is no group call |
| Pipeline tiles navigate, funded tiles flip | Each pair does one thing, and they do not compete |
| Amy as the template LO | She is the most complete real record |
| Line icons, no emoji | House style |

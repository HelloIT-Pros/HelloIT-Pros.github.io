# Homespire 360 — prototype

A one-stop-shop PWA for Homespire loan officers: install it once, get every
link you need — payroll, Encompass, marketing resources, your own
application link, your digital business card — organized in one place.

This is a **prototype built to test one thing**: whether "generic links
everyone shares + custom links unique to each LO" is a model that actually
makes sense once real LOs are using it. Everything here is scoped to make
that test possible with the least amount of infrastructure — no login, no
backend, no accounts to set up. Real Entra SSO and a real admin backend are
the next step *after* this validates, not part of it.

## What's in the box

```
index.html        the app every LO opens (?lo=their-slug)
admin.html         the screen you use to manage links
manifest.webmanifest, service-worker.js   what makes it installable + offline
data/config.json   the actual link data — categories, generic links, LO roster
css/, js/, icons/  everything else
```

## How identity works (no login)

Each LO gets their own link:

```
https://<your-deployed-url>/index.html?lo=maria-lopez
```

That's the link they tap once to install. After that, the app remembers
them on that phone (it stores the slug locally), so `/index.html` alone
keeps working too. If someone opens the app with no slug and no memory of
one, they get a simple "who are you?" picker instead of a broken screen —
useful for testing on a shared device.

Three sample LOs are seeded in `data/config.json` (`maria-lopez`,
`james-carter`, `demo`) so you can try this immediately after deploying.

## How the admin screen works (no backend)

Open `admin.html`. You can:

- Add/edit/remove the categories every LO sees (Payroll, Loan Origination, etc.)
- Add/edit/remove generic links (shown to everyone)
- Add LOs and manage each one's personal links, and copy their install link

Every change is saved instantly to a **local draft** in your browser
(`localStorage`) so you never lose work by accident — but it is *not* live
for anyone else yet. When you're ready to publish:

1. Click **Export config.json** — downloads the updated file.
2. Replace `data/config.json` in this project with the downloaded file.
3. Redeploy (see below). That's it — every LO's app picks up the change
   next time they're online (the service worker checks for a fresh
   `config.json` on every load).

This is a deliberate MVP tradeoff: no server means no live sync between
admin and LOs, but also nothing to host, secure, or maintain for a test
that's about the *link model*, not the admin tooling. If the model tests
well, replacing this with a real backend + Entra SSO is a data-shape-compatible
upgrade, not a rewrite — `config.json`'s shape is the same shape a real
database would hold.

## Deploying it (pick one, all free, ~2 minutes)

**Netlify (drag-and-drop, easiest):**
1. Go to https://app.netlify.com/drop
2. Drag this whole `lo-life-pwa` folder onto the page.
3. You get a live HTTPS URL immediately. Redeploy by dragging the folder
   again any time you export a new `config.json`.

**Vercel:**
```
npm i -g vercel
cd lo-life-pwa
vercel --prod
```

**GitHub Pages:**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → deploy from the branch/folder.
3. Your URL is `https://<username>.github.io/<repo>/`.

Whichever you pick, once it's live, hand each LO their `?lo=slug` link.

## Installing it on a phone

- **Android (Chrome):** open the link → a banner appears → tap **Install**.
- **iPhone (Safari):** open the link → tap the Share icon → **Add to Home
  Screen**. iOS doesn't allow apps to trigger this automatically, so the
  app shows a one-line instruction banner instead.

Once installed, it opens full-screen, no browser bar — like a real app.

## Running the validation test

This prototype exists to test the riskiest assumption: **can a real LO
find what they need without help, using the generic+custom link model?**

1. Deploy it and fill in `data/config.json` with a few real LOs' actual
   links via `admin.html`.
2. Hand 3-5 real LOs their personal install link. Don't explain the app —
   that's the point.
3. Watch (or ask afterward): could they get to their top 5 destinations
   in a couple of taps, without asking anyone which link was theirs?
4. If yes — the model holds, invest in the real backend + SSO + push
   notifications. If they get confused about what's "theirs" vs shared,
   or a category doesn't match how they think, that's the signal to fix
   *before* building the real thing.

## Explicitly not in this prototype (by design)

- Real login / Entra SSO (identity is a slug in the URL for now)
- A live, synced backend (admin exports, you redeploy)
- Push notifications / news / announcements (planned for after MVP)
- Digital business card generation (links to an existing one, doesn't build one)

## Testing locally before you deploy

Any static file server works — service workers need `http://localhost` or
HTTPS, they won't register over `file://`.

```bash
cd lo-life-pwa
python3 -m http.server 8080
# open http://localhost:8080/index.html?lo=maria-lopez
```

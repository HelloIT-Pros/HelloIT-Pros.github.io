# Homespire 360 (prototype)

An installable app for Homespire loan officers: install it once, get every link
you need in one place. Shared company links plus the links unique to that LO.

This is a **prototype built to test one thing**: whether "shared links everyone
gets, plus custom links unique to each LO" is a model that holds up once real
LOs use it. Everything is scoped to make that test possible with the least
infrastructure: no login, no backend, no accounts. Real Entra SSO and a real
admin backend come after this validates, not before.

## Live URLs

| What | Where |
| --- | --- |
| LO app | https://helloit-pros.github.io/homespire360/ |
| Admin | https://helloit-pros.github.io/homespire360/admin.html |
| Amy's install link | https://helloit-pros.github.io/homespire360/index.html?lo=amy-leblanc |

The app used to live at `/homespire/LOlife/`, named after the original concept.
That path still holds a redirect page, so shared links, bookmarks, and copies
already installed on a phone still reach the app. The redirect carries the
`?lo=` slug across, and it retires the service worker that was registered under
the old scope, without which an installed copy would keep serving its own
cached shell and never follow the move.

Favorites and the remembered profile survive the move on their own: both paths
sit on the same origin, so they share `localStorage`.

Anyone who already installed the app should still delete and re-add the home
screen icon. That is what picks up the new address and the new app icon, since
iOS caches both at install time.

## What is in the box

```
index.html          the app every LO opens (?lo=their-slug)
admin.html          the screen used to manage links
manifest.webmanifest, service-worker.js   installable plus offline
data/config.json    the link data: categories, shared links, LO roster
js/icons.js         the line icon set (no emoji anywhere in the product)
brand/              the Homespire mark, source of truth for the app icon
photos/             LO headshots
qr/                 generated QR codes, one per LO
css/, js/, icons/   everything else
scripts/            make_icons.py and make_qr.py, both generate committed assets
```

## App icon

Every icon in `icons/` is generated from `brand/homespire-mark.png` by
`scripts/make_icons.py`. Do not hand-edit the files in `icons/`, replace the
brand mark and rerun the script:

```bash
cd scripts && python3 make_icons.py
```

It emits two families. The `any` icons are full bleed, framed the way the brand
file frames the mark. The `maskable` icons shrink the mark to 58% of the canvas
so Android can crop it to a circle or squircle without clipping the roof or the
legs, which is checked against the documented 80% safe zone.

## How the LO app is laid out

Four tabs in a fixed bottom bar:

- **Home** every link the LO can reach, grouped by category, with pill filters
  across the top to narrow to one category
- **Favorites** the links that LO starred
- **Search** type-ahead across every link they can reach
- **Profile** headshot, name, link counts, and switch profile

Every row shows a purple icon tile on the left and a star on the right. Tapping
the star pins that link to the Favorites tab. Favorites are stored per device
and per LO in `localStorage`, not in `config.json`, because they are the LO's own
choice rather than something an admin sets. Nothing distinguishes shared links
from personal ones in the LO view: they all just work.

## Sharing

Outward-facing links also carry a share button. Tapping it opens the phone's
native share sheet, so an LO can drop her application link straight into a text
message without loading the page and copying the URL out of the address bar.
Where there is no share API, such as most desktop browsers, it copies the link
and confirms on the button instead.

Sharing is per link, set by the `shareable` flag in `config.json` and toggled by
the Share checkbox in the admin. It is off by default and should stay off for
internal tools. A share button on InSite or Paycom is clutter at best, and at
worst it invites sending a borrower a link to a staff login page. It is on for
the seven links an LO actually sends out: her business card, her application
link, secure document upload, Buyer's Edge, Product Spotlight, her reviews, and
her bio page.

## QR codes

An LO's QR is a row in My Business and a section on Profile. It is not a link:
tapping it shows the code full screen on a white ground, as large as the screen
allows, so someone standing in front of her can scan it. The screen is held
awake while it is open where the browser supports that, since a code is no use
if the display sleeps mid-scan.

The images are generated, not exported by hand:

```bash
cd scripts && python3 make_qr.py
```

That reads `data/config.json`, finds every link with `"kind": "qr"`, encodes its
`url`, drops the Homespire mark in the middle, and writes the file named by its
`image` field. Error correction is set to H so the centred mark cannot break
it, and every code is decoded again before the script exits, because a QR that
scans to the wrong place is worse than no QR.

Generating rather than storing an export means the code can never drift out of
sync with the URL, and a new LO costs one command instead of a manual export
from another tool. If the URL changes in the admin, rerun the script.

Amy's encodes her HiHello card including its `sharer_id` parameter, which is how
HiHello attributes a scan back to her, so it is kept verbatim.

## How identity works (no login)

Each LO gets their own link:

```
https://helloit-pros.github.io/homespire360/index.html?lo=amy-leblanc
```

That is the link they tap once to install. After that the app remembers them on
that phone (the slug is stored locally), so opening the app with no parameters
keeps working. Someone who opens the app with no slug and no memory of one gets
a "who are you" picker instead of a broken screen, which is useful for testing
on a shared device.

## How the admin screen works (no backend)

Open `admin.html`. It is master and detail: the left rail lists what can be
edited and the right panel shows one subject at a time.

The rail holds two setup views plus one row per loan officer:

- **Categories** the groups every LO sees, each with a line icon and an order
- **Shared links** the links every LO gets, no setup per person
- **one row per LO** avatar, name, title, and how many personal links they have,
  with a search box once the roster passes five

Selecting an LO gives their identity fields, their install link with a Copy
button, their own links as editable rows, and the shared links they inherit
behind a collapsed disclosure. That collapse is the point: an LO's own links are
what an admin came to change, and the shared ones are the same for everybody, so
they should not be nine rows in the way. Links are grouped under a category
heading rather than rendered as one block per category, so an empty category
costs nothing to look at.

### One LO is the template

Adding a loan officer takes a name, not 13 rows of typing. One LO is marked as
the template (`templateSlug` in `config.json`, Amy today), and every new LO is
built from theirs: same categories, same labels, same share settings. The
template is read off that LO rather than stored separately, so there is nothing
to keep in step by hand.

URLs are filled in where they can be worked out, and only where they can:

- On a company domain (`autofillDomains` in `config.json`) with the template
  LO's name or slug in the path, the new LO's own name goes in and the row is
  tagged **Auto** so it still gets a look.
- On a company domain with no name in it, the URL is the same for everyone and
  carries across as it stands.
- On any third party service, the row is left blank. An Instagram handle, a
  LinkedIn vanity URL, a HiHello card id and an Experience.com account number
  are issued by that service or chosen by the person, and a plausible looking
  wrong link is worse than an empty row someone has to fill in.

For Amy's set that means six of thirteen rows are ready with no typing.

A row with no URL does not show in the app, so a half-finished LO is safe to
hand out or leave for later: they see the shared links and whatever of their own
is filled in, never a row that goes nowhere. The admin counts what is left, in
the rail and above the rows.

Labels come from the template as a dropdown, so the same destination is called
the same thing for every LO and nobody types "Buyers Edge" one week and "Buyer's
Edge" the next. Picking a template label also brings its share default and its
derivable URL with it. Anything genuinely one-off goes through **Custom label**.

An LO who predates the template, or who was half created before it existed, gets
a one-click **Add the missing N** prompt rather than needing the rows rebuilt.

Every change saves instantly to a **local draft** in your browser
(`localStorage`) so nothing is lost on refresh, but it is not live for anyone
else yet. To publish:

1. Click **Export config.json**, which downloads the updated file.
2. Replace `data/config.json` with the downloaded file.
3. Commit and push. Every LO picks up the change the next time they are online,
   because the service worker checks for a fresh `config.json` on every load.

No server means no live sync between admin and LOs, but also nothing to host,
secure, or maintain for a test that is about the link model, not the admin
tooling. If the model holds, swapping in a real backend plus Entra SSO is a
data-shape-compatible upgrade rather than a rewrite: `config.json` already has
the shape a real database would hold.

## Installing it on a phone

- **iPhone (Safari):** open the link, tap Share, then Add to Home Screen. iOS
  does not let a web app trigger this, so the app shows a one line instruction
  instead.
- **Android (Chrome):** open the link, then tap Install in the banner.

Once installed it opens full screen with no browser bar.

## Running the validation test

The riskiest assumption: **can a real LO find what they need without help,
using the shared plus custom link model?**

1. Fill in real links for a few real LOs through `admin.html`.
2. Hand 3 to 5 LOs their personal install link. Do not explain the app. That is
   the point.
3. Watch, or ask afterward: could they reach their top five destinations in a
   couple of taps without asking which link was theirs?
4. If yes, the model holds and the real backend, SSO, and push notifications are
   worth building. If they get confused about what is theirs versus shared, or a
   category does not match how they think, fix that before building the real
   thing.

## Not in this prototype, by design

- Real login or Entra SSO. Identity is a slug in the URL for now.
- A live synced backend. The admin exports, you redeploy.
- Push notifications, news, and announcements. Planned for after MVP, and the
  first feature that needs real server infrastructure.
- Digital business card generation. The app links to an existing card.

## Open items

- Borrower Portal / POS still points at a placeholder URL and needs the real one.
  It also sounds borrower-facing, so it may want the share flag once the real
  URL is in.
- Loan Services and Upload Docs are filed as personal links, but neither URL
  contains anything identifying the LO. If those pages really are the same for
  everyone they belong in shared links, where every LO would get them for free.
- Sharing is on for seven of Amy's links. Loan Services and her social profiles
  are off pending a decision on whether she sends those to clients.
- "The Loan Lab (Team Chat)" is filed under Amy's own links, not shared, until
  it is confirmed that every LO can open that Teams group chat deep link.
- The Loan Origination Systems category is now empty, since Borrower Portal
  moved into Loan Tools. It stays defined so real LOS links can go there, and
  it stays hidden from the LO view while empty. Worth deleting if nothing is
  coming.

## Testing locally

Service workers need `http://localhost` or HTTPS. They do not register over
`file://`.

```bash
cd lo-life-pwa
python3 -m http.server 8080
# open http://localhost:8080/index.html?lo=amy-leblanc
```

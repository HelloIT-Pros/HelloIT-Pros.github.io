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
| LO app | https://helloit-pros.github.io/homespire/LOlife/ |
| Admin | https://helloit-pros.github.io/homespire/LOlife/admin.html |
| Amy's install link | https://helloit-pros.github.io/homespire/LOlife/index.html?lo=amy-leblanc |

The folder is still named `LOlife` on purpose. The app was renamed to Homespire
360, but the URL stayed put so home screen icons that are already installed
keep working.

## What is in the box

```
index.html          the app every LO opens (?lo=their-slug)
admin.html          the screen used to manage links
manifest.webmanifest, service-worker.js   installable plus offline
data/config.json    the link data: categories, shared links, LO roster
js/icons.js         the line icon set (no emoji anywhere in the product)
photos/             LO headshots
css/, js/, icons/   everything else
scripts/            icon generator
```

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

## How identity works (no login)

Each LO gets their own link:

```
https://helloit-pros.github.io/homespire/LOlife/index.html?lo=amy-leblanc
```

That is the link they tap once to install. After that the app remembers them on
that phone (the slug is stored locally), so opening the app with no parameters
keeps working. Someone who opens the app with no slug and no memory of one gets
a "who are you" picker instead of a broken screen, which is useful for testing
on a shared device.

## How the admin screen works (no backend)

Open `admin.html`. You can:

- Add, edit, and remove the categories every LO sees, each with a line icon
  picked from a dropdown
- Add, edit, and remove shared links (shown to everyone)
- Add LOs, set their headshot path, manage their personal links, and copy their
  install link

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

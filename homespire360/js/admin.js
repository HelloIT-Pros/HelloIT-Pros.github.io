/**
 * Homespire 360 admin screen.
 *
 * Edits an in-memory `state` object (same shape as config.json), autosaves to a
 * localStorage draft on every change, and exports the result as a downloadable
 * config.json to redeploy. No backend, no login. See README.md.
 *
 * Layout is master and detail: a left rail lists what can be edited (setup,
 * then one row per loan officer) and the right panel shows only the thing
 * selected.
 *
 * One LO is the template. Every other LO's link set is built from it, so
 * adding someone is not 13 rows of typing: the categories, the labels and the
 * share defaults come from the template, and where the template's URL contains
 * that LO's own name or slug the new URL is filled in too. What is left is the
 * handful of URLs only a person can know.
 */

let state = null;
let dirty = false;

/* The published config as fetched at boot, kept so the admin can always say
   what an export would add or remove rather than just writing over it. */
let publishedConfig = null;
let publishedFingerprint = "";
let conflictDraft = null;

/* What the right panel is showing. type: "categories" | "shared" | "template" | "lo". */
let selection = { type: "shared", slug: null };

let loFilter = "";

/* Link ids whose label cell is a free text input rather than the dropdown. */
const customLabelIds = new Set();

/* Below this many LOs a search box is just another control to read past. */
const FILTER_THRESHOLD = 6;

const $ = (id) => document.getElementById(id);

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(base) {
  let slug = base || "lo";
  let n = 2;
  const taken = new Set(state.los.map((l) => l.slug));
  while (taken.has(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function markDirty() {
  dirty = true;
  saveDraft(state);
  const pill = $("status-pill");
  pill.textContent = "Unsaved changes. Export to publish.";
  pill.className = "status-pill status-draft";
}

function markClean(label) {
  dirty = false;
  const pill = $("status-pill");
  pill.textContent = label || "No unsaved changes";
  pill.className = "status-pill status-clean";
}

/* ---------- lookups ---------- */

function sortedCategories() {
  return [...state.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function catOrder(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat ? cat.order || 0 : 9999;
}

function catLabel(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat ? cat.label : "Uncategorized";
}

/** Category order first, then link order. Matches how the app stacks them. */
function byCategoryThenOrder(a, b) {
  return catOrder(a.categoryId) - catOrder(b.categoryId) || (a.order || 0) - (b.order || 0);
}

function sortedLos() {
  return [...state.los].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function currentLo() {
  return selection.type === "lo" ? state.los.find((l) => l.slug === selection.slug) || null : null;
}

function firstNameOf(lo) {
  return (lo.name || "this LO").split(" ")[0];
}

function installUrlFor(slug) {
  const base = location.pathname.replace("admin.html", "index.html");
  return `${location.origin}${base}?lo=${encodeURIComponent(slug)}`;
}

function filledCount(lo) {
  return lo.customLinks.filter(hasUrl).length;
}

/* ---------- the template ---------- */

function templateSlug() {
  if (state.templateSlug && state.los.some((l) => l.slug === state.templateSlug)) {
    return state.templateSlug;
  }
  const first = sortedLos()[0];
  return first ? first.slug : null;
}

function templateLo() {
  return state.los.find((l) => l.slug === templateSlug()) || null;
}

function isTemplateLo(lo) {
  return lo && lo.slug === templateSlug();
}

/**
 * Only company systems get their URLs filled in for a new LO. Those follow a
 * convention, so the address can be worked out from the person's name. A
 * third party profile cannot: an Instagram handle, a LinkedIn vanity URL, a
 * HiHello card id and an Experience.com account number are all chosen by the
 * person or issued by that service, and a plausible looking wrong link is
 * worse than a blank row someone has to fill in.
 */
const DEFAULT_AUTOFILL_DOMAINS = ["homespiremortgage.com", "homespirehomeloans.com"];

function autofillDomains() {
  return state.autofillDomains && state.autofillDomains.length
    ? state.autofillDomains
    : DEFAULT_AUTOFILL_DOMAINS;
}

function isCompanyUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return autofillDomains().some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

/**
 * The name-derived strings that show up inside an LO's own URLs. Longest first,
 * so "amy-leblanc" is matched before "aleblanc" can match part of it.
 */
function tokensFor(lo) {
  const parts = (lo.name || "").trim().split(/\s+/);
  const clean = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const first = clean(parts[0] || "");
  const last = clean(parts.slice(1).join(""));
  const pairs = [
    ["slug", lo.slug || ""],
    ["initialLast", first && last ? first[0] + last : ""],
  ].filter(([, value]) => value.length >= 4);
  return pairs.sort((a, b) => b[1].length - a[1].length);
}

/**
 * Turn one company URL into a pattern by swapping the template LO's own name
 * out of it. A company URL with no name in it is the same for everyone, so it
 * carries across as it stands. Anything off a company domain returns null and
 * stays blank.
 */
function derivePattern(url, lo) {
  if (!url || !isCompanyUrl(url)) return null;
  let out = url;
  tokensFor(lo).forEach(([key, value]) => {
    if (out.toLowerCase().includes(value)) {
      out = out.replace(new RegExp(value, "gi"), `{${key}}`);
    }
  });
  return out;
}

function applyPattern(pattern, lo) {
  let out = pattern;
  const map = Object.fromEntries(tokensFor(lo));
  Object.keys(map).forEach((key) => {
    out = out.split(`{${key}}`).join(map[key]);
  });
  return /\{\w+\}/.test(out) ? "" : out; // a token this LO has no value for
}

/** One entry per row a new LO should start with, read off the template LO. */
function linkTemplate() {
  const src = templateLo();
  if (!src) return [];
  return [...src.customLinks].sort(byCategoryThenOrder).map((l) => ({
    categoryId: l.categoryId,
    label: l.label,
    shareable: Boolean(l.shareable),
    kind: l.kind || null,
    image: l.image || null,
    urlPattern: derivePattern(l.url, src),
    order: l.order || 0,
  })).map((t) => ({ ...t, perLo: Boolean(t.urlPattern && /\{\w+\}/.test(t.urlPattern)) }));
}

function templateEntry(categoryId, label) {
  return linkTemplate().find((t) => t.categoryId === categoryId && t.label === label) || null;
}

function templateLinkFor(entry, lo) {
  const link = {
    id: uid("c"),
    categoryId: entry.categoryId,
    label: entry.label,
    url: entry.urlPattern ? applyPattern(entry.urlPattern, lo) : "",
    order: entry.order,
  };
  if (entry.shareable) link.shareable = true;
  if (entry.kind) link.kind = entry.kind;
  if (entry.image) link.image = entry.image.split(templateSlug()).join(lo.slug);
  return link;
}

/** Template rows this LO has no row for yet, matched on category and label. */
function missingTemplateEntries(lo) {
  const have = new Set(lo.customLinks.map((l) => `${l.categoryId}||${l.label}`));
  return linkTemplate().filter((t) => !have.has(`${t.categoryId}||${t.label}`));
}

/** True when this URL is exactly what the template would have filled in. */
function isAutofilled(link, lo) {
  const entry = templateEntry(link.categoryId, link.label);
  if (!entry || !entry.urlPattern || !link.url) return false;
  return applyPattern(entry.urlPattern, lo) === link.url;
}

/* ---------- shared field markup ---------- */

function categoryOptions(selectedId) {
  return sortedCategories()
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
}

/**
 * Labels come from the template so the same destination is called the same
 * thing for every LO. Anything genuinely one-off goes through Custom label.
 */
function labelOptions(categoryId, current) {
  const known = [...new Set(linkTemplate().filter((t) => t.categoryId === categoryId).map((t) => t.label))];
  if (current && !known.includes(current)) known.unshift(current);
  return (
    known
      .map((l) => `<option value="${escapeHtml(l)}" ${l === current ? "selected" : ""}>${escapeHtml(l)}</option>`)
      .join("") + `<option value="__custom__">Custom label...</option>`
  );
}

function iconOptions(selectedName) {
  const current = resolveIconName(selectedName);
  return ICON_CHOICES.map(
    (choice) =>
      `<option value="${choice.name}" ${choice.name === current ? "selected" : ""}>${choice.label}</option>`
  ).join("");
}

/**
 * The per-link share switch. Off by default for internal tools: a share button
 * on those is clutter that invites sending a borrower a staff login page. New
 * LOs inherit the template's setting per label, so this rarely needs touching.
 */
function shareSwitch(link) {
  return `
    <label class="switch" title="Show a share button on this link in the app">
      <input type="checkbox" data-field="shareable" ${link.shareable ? "checked" : ""} />
      <span class="switch-track"><span class="switch-knob"></span></span>
    </label>`;
}

function labelCell(link, useDropdown) {
  if (!useDropdown || customLabelIds.has(link.id)) {
    return `<input data-field="label" value="${escapeHtml(link.label)}" placeholder="Label" aria-label="Label" />`;
  }
  return `<select data-field="label" aria-label="Label">${labelOptions(link.categoryId, link.label)}</select>`;
}

/** Category, then label, then URL, then share. */
function linkRowMarkup(link, kind, lo) {
  const isQr = link.kind === "qr";
  const needsUrl = !hasUrl(link);
  const auto = lo && isAutofilled(link, lo);
  return `
    <div class="frow has-toggle${isQr ? " is-qr-row" : ""}${needsUrl ? " needs-url" : ""}" data-kind="${kind}" data-id="${escapeHtml(link.id)}">
      <select class="quiet-select" data-field="categoryId" aria-label="Category">${categoryOptions(link.categoryId)}</select>
      ${labelCell(link, kind === "custom")}
      <span class="url-cell">
        <input data-field="url" class="mono" value="${escapeHtml(link.url || "")}" placeholder="${needsUrl ? "Paste the URL" : "https://"}" aria-label="URL" />
        ${auto ? `<span class="auto-tag" title="Filled in from the template using this LO's name. Worth a check.">Auto</span>` : ""}
      </span>
      ${shareSwitch(link)}
      <button class="del-btn" data-action="${kind === "custom" ? "remove-link" : "remove-generic"}" type="button" aria-label="Remove ${escapeHtml(link.label)}">${icon("trash")}</button>
    </div>`;
}

/** Column titles, written once above the rows instead of on every row. */
function linkTableHead() {
  return `
    <div class="table-head">
      <span>Category</span><span>Label</span><span>URL</span><span>Share</span><span></span>
    </div>`;
}

/**
 * A flat list of links with a small label wherever the category changes. The
 * grouping stays legible without rendering a heading for every category
 * whether or not it holds anything.
 */
function groupedLinkRows(links, kind, lo) {
  let lastCategory = null;
  return links
    .map((link) => {
      const head =
        link.categoryId === lastCategory
          ? ""
          : `<p class="group-label">${escapeHtml(catLabel(link.categoryId))}</p>`;
      lastCategory = link.categoryId;
      return head + linkRowMarkup(link, kind, lo);
    })
    .join("");
}

/* ---------- left rail ---------- */

function railItem({ nav, slug, name, sub, iconName, photo, active, tag }) {
  const avatar = photo
    ? `<img class="rail-avatar" src="${escapeHtml(photo)}" alt="" />`
    : `<span class="rail-avatar">${icon(iconName || "user")}</span>`;
  return `
    <button class="rail-item" type="button" data-nav="${nav}" ${slug ? `data-slug="${escapeHtml(slug)}"` : ""} ${active ? 'aria-current="true"' : ""}>
      ${avatar}
      <span class="rail-text">
        <span class="rail-name">${escapeHtml(name)}${tag ? `<span class="rail-tag">${escapeHtml(tag)}</span>` : ""}</span>
        <span class="rail-sub">${escapeHtml(sub)}</span>
      </span>
    </button>`;
}

function renderRail() {
  const catCount = state.categories.length;
  const sharedCount = state.genericLinks.length;
  const tpl = templateLo();

  $("rail-setup").innerHTML =
    railItem({
      nav: "categories",
      name: "Categories",
      sub: `${catCount} ${catCount === 1 ? "group" : "groups"} every LO sees`,
      iconName: "grid",
      active: selection.type === "categories",
    }) +
    railItem({
      nav: "shared",
      name: "Shared links",
      sub: `${sharedCount} ${sharedCount === 1 ? "link" : "links"} every LO gets`,
      iconName: "users",
      active: selection.type === "shared",
    }) +
    railItem({
      nav: "template",
      name: "New LO template",
      sub: tpl ? `${linkTemplate().length} rows, from ${tpl.name}` : "No template LO yet",
      iconName: "copy",
      active: selection.type === "template",
    });

  const all = sortedLos();
  $("rail-count").textContent = all.length ? `(${all.length})` : "";

  const needsFilter = all.length >= FILTER_THRESHOLD;
  const filterBox = $("rail-filter");
  filterBox.hidden = !needsFilter;
  if (needsFilter && !filterBox.innerHTML) {
    filterBox.innerHTML = `<input id="lo-filter" type="search" placeholder="Search loan officers" aria-label="Search loan officers" />`;
  }

  const needle = loFilter.trim().toLowerCase();
  const shown = needle
    ? all.filter((lo) => `${lo.name} ${lo.slug} ${lo.title || ""}`.toLowerCase().includes(needle))
    : all;

  if (!all.length) {
    $("rail-los").innerHTML = `<p class="rail-empty">No loan officers yet. Use the plus button to add one.</p>`;
    return;
  }

  if (!shown.length) {
    $("rail-los").innerHTML = `<p class="rail-empty">No match for "${escapeHtml(loFilter)}".</p>`;
    return;
  }

  $("rail-los").innerHTML = shown
    .map((lo) => {
      const total = lo.customLinks.length;
      const gap = total - filledCount(lo);
      const bits = [lo.title, gap ? `${gap} need a URL` : `${total} ${total === 1 ? "link" : "links"}`];
      return railItem({
        nav: "lo",
        slug: lo.slug,
        name: lo.name || lo.slug,
        sub: bits.filter(Boolean).join(" · "),
        photo: lo.photo,
        active: selection.type === "lo" && selection.slug === lo.slug,
        tag: isTemplateLo(lo) ? "Template" : "",
      });
    })
    .join("");
}

/* ---------- detail: categories ---------- */

function renderCategoriesDetail() {
  const rows = sortedCategories()
    .map(
      (c) => `
      <div class="frow frow-cat" data-kind="category" data-id="${escapeHtml(c.id)}">
        <span class="icon-swatch">${icon(resolveIconName(c.icon))}</span>
        <select data-field="icon" aria-label="Icon">${iconOptions(c.icon)}</select>
        <input data-field="label" value="${escapeHtml(c.label)}" placeholder="Category name" aria-label="Category name" />
        <input data-field="order" type="number" value="${c.order}" placeholder="1" aria-label="Order" />
        <button class="del-btn" data-action="remove-category" type="button" aria-label="Remove ${escapeHtml(c.label)}">${icon("trash")}</button>
      </div>`
    )
    .join("");

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Categories</h2>
          <p class="panel-sub">The groups every LO sees, lowest order first. The icon shows on each row in the app.</p>
        </div>
      </div>
      <div class="table-head table-head-cat"><span></span><span>Icon</span><span>Name</span><span>Order</span><span></span></div>
      ${rows || `<p class="panel-empty">No categories yet. Links need one to show up.</p>`}
      <button class="btn-add" data-action="add-category" type="button">${icon("plus")}<span>Add category</span></button>
    </section>`;
}

/* ---------- detail: shared links ---------- */

function renderSharedDetail() {
  const links = [...state.genericLinks].sort(byCategoryThenOrder);
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Shared links</h2>
          <p class="panel-sub">Every LO gets these, no setup per person. Turn Share on only for links an LO would send a borrower.</p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="add-generic" type="button">${icon("plus")}<span>Add link</span></button>
      </div>
      ${links.length ? linkTableHead() + groupedLinkRows(links, "generic", null) : `<p class="panel-empty">No shared links yet.</p>`}
    </section>`;
}

/* ---------- detail: the template ---------- */

function renderTemplateDetail() {
  const tpl = templateLo();
  const entries = linkTemplate();
  const options = sortedLos()
    .map(
      (lo) =>
        `<option value="${escapeHtml(lo.slug)}" ${lo.slug === templateSlug() ? "selected" : ""}>${escapeHtml(lo.name || lo.slug)}</option>`
    )
    .join("");

  let lastCategory = null;
  const rows = entries
    .map((t) => {
      const head =
        t.categoryId === lastCategory
          ? ""
          : `<p class="group-label">${escapeHtml(catLabel(t.categoryId))}</p>`;
      lastCategory = t.categoryId;
      const url = t.urlPattern
        ? `<span class="mono">${escapeHtml(t.urlPattern)}</span>`
        : `<span class="mono faint-text">Blank until someone pastes it</span>`;
      const source = t.urlPattern
        ? t.perLo
          ? `<span class="tag tag-auto">Auto per LO</span>`
          : `<span class="tag tag-auto">Same for all</span>`
        : `<span class="tag">Paste per LO</span>`;
      return `${head}
        <div class="tpl-row">
          <span class="lbl">${escapeHtml(t.label)}</span>
          ${url}
          ${source}
          <span class="tag">${t.shareable ? "Share on" : "Share off"}</span>
        </div>`;
    })
    .join("");

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>New LO template</h2>
          <p class="panel-sub">Every new loan officer starts with these rows: same categories, same labels, same share settings. It is read off one LO rather than kept separately, so there is nothing to maintain twice.</p>
        </div>
      </div>

      <label class="field field-inline"><span>Template LO</span>
        <select id="template-select">${options || `<option value="">No loan officers yet</option>`}</select></label>

      ${
        entries.length
          ? `<p class="small-note">A new LO's URL is filled in wherever the address sits on a company domain (${escapeHtml(autofillDomains().join(", "))}): with their own name swapped in where ${escapeHtml(tpl ? firstNameOf(tpl) : "the template LO")}'s appears, or copied as it stands where the URL is the same for everyone. Anything on a third party service stays blank, because a handle or an account id cannot be worked out from a name and a wrong link is worse than an empty row. A blank row never shows in the app.</p>
             ${rows}`
          : `<p class="panel-empty">The template LO has no personal links yet.</p>`
      }
    </section>`;
}

/* ---------- detail: one loan officer ---------- */

function renderLoDetail(lo) {
  const links = [...lo.customLinks].sort(byCategoryThenOrder);
  const shared = [...state.genericLinks].sort(byCategoryThenOrder);
  const avatar = lo.photo
    ? `<img class="lo-avatar" id="lo-avatar" src="${escapeHtml(lo.photo)}" alt="" />`
    : `<span class="lo-avatar">${icon("user")}</span>`;
  const install = installUrlFor(lo.slug);
  const hasQr = links.some((l) => l.kind === "qr");
  const gap = links.length - filledCount(lo);
  const missing = missingTemplateEntries(lo);

  return `
    <section class="panel lo-identity" data-lo="${escapeHtml(lo.slug)}">
      <div class="lo-head">
        ${avatar}
        <div class="lo-head-text">
          <h2>${escapeHtml(lo.name || "Unnamed LO")}${isTemplateLo(lo) ? `<span class="rail-tag">Template</span>` : ""}</h2>
          <p class="panel-sub">${escapeHtml(lo.title || "No title set")}</p>
        </div>
        <button class="del-btn del-btn-labelled" data-action="remove-lo" type="button">${icon("trash")}<span>Remove</span></button>
      </div>

      <div class="field-grid">
        <label class="field"><span>Full name</span>
          <input data-field="name" value="${escapeHtml(lo.name)}" placeholder="Full name" /></label>
        <label class="field"><span>Title</span>
          <input data-field="title" value="${escapeHtml(lo.title || "")}" placeholder="Loan Officer" /></label>
        <label class="field"><span>URL slug</span>
          <input data-field="slug" class="mono" value="${escapeHtml(lo.slug)}" placeholder="first-last" /></label>
        <label class="field"><span>NMLS #</span>
          <input data-field="nmls" value="${escapeHtml(lo.nmls || "")}" placeholder="1405094" /></label>
        <label class="field"><span>Phone</span>
          <input data-field="phone" value="${escapeHtml(lo.phone || "")}" placeholder="(225) 555-0100" /></label>
        <label class="field"><span>Email</span>
          <input data-field="email" class="mono" value="${escapeHtml(lo.email || "")}" placeholder="name@homespiremortgage.com" /></label>
        <label class="field"><span>Headshot</span>
          <input data-field="photo" class="mono" value="${escapeHtml(lo.photo || "")}" placeholder="https://... or photos/${escapeHtml(lo.slug)}.png" />
          <span class="field-note" id="photo-note">${
            lo.photo
              ? `Checking...`
              : `A link to the headshot on the company site, or a file committed under <span class="mono">photos/</span>.`
          }</span></label>
      </div>

      <div class="install-box">
        <span class="install-label">Install link</span>
        <span class="mono install-url">${escapeHtml(install)}</span>
        <button class="btn btn-outline btn-sm copy-install-btn" data-url="${escapeHtml(install)}" type="button">${icon("copy")}<span>Copy</span></button>
      </div>
    </section>

    <section class="panel lo-links" data-lo="${escapeHtml(lo.slug)}">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(firstNameOf(lo))}'s own links</h2>
          <p class="panel-sub">${
            gap
              ? `${gap} of ${links.length} still need a URL. A row with no URL does not show in the app, so it is safe to leave one for later.`
              : `Only ${escapeHtml(firstNameOf(lo))} sees these, on top of the shared links below.`
          }</p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="add-link" type="button">${icon("plus")}<span>Add link</span></button>
      </div>
      ${
        missing.length
          ? `<div class="tpl-prompt">
               <p>${missing.length} template ${missing.length === 1 ? "row is" : "rows are"} missing for ${escapeHtml(firstNameOf(lo))}.</p>
               <button class="btn btn-primary btn-sm" data-action="fill-template" type="button">${icon("plus")}<span>Add the missing ${missing.length}</span></button>
             </div>`
          : ""
      }
      ${
        links.length
          ? linkTableHead() + groupedLinkRows(links, "custom", lo)
          : `<p class="panel-empty">No personal links yet.</p>`
      }
      ${
        hasQr
          ? `<p class="small-note">The QR row's image is generated from its URL by <span class="mono">scripts/make_qr.py</span>. Change the URL and rerun that script, or the code will still scan to the old address.</p>`
          : ""
      }
    </section>

    <details class="panel panel-details">
      <summary>
        <span>Shared links ${escapeHtml(firstNameOf(lo))} also sees</span>
        <span class="summary-count">${shared.length}</span>
        ${icon("chevron", "summary-chevron")}
      </summary>
      <div class="shared-list">
        ${
          shared.length
            ? shared
                .map(
                  (g) => `
          <div class="shared-row">
            <span class="lbl">${escapeHtml(g.label)}</span>
            <span class="tag">${escapeHtml(catLabel(g.categoryId))}</span>
            <span class="mono">${escapeHtml(g.url)}</span>
          </div>`
                )
                .join("")
            : `<p class="panel-empty">No shared links yet.</p>`
        }
        <p class="small-note">Edit these under Shared links. A change there reaches every LO.</p>
      </div>
    </details>`;
}

/* ---------- detail dispatch ---------- */

function renderDetail() {
  const panel = $("detail");

  if (selection.type === "categories") {
    panel.innerHTML = renderCategoriesDetail();
    return;
  }
  if (selection.type === "shared") {
    panel.innerHTML = renderSharedDetail();
    return;
  }
  if (selection.type === "template") {
    panel.innerHTML = renderTemplateDetail();
    return;
  }

  const lo = currentLo();
  if (!lo) {
    panel.innerHTML = `
      <section class="panel">
        <p class="panel-empty">Pick something on the left, or add a loan officer.</p>
      </section>`;
    return;
  }
  panel.innerHTML = renderLoDetail(lo);
  checkPhoto();
}

/**
 * Say whether the headshot actually resolves. A path to a committed file is
 * either there or not; a URL on another site can also be moved, renamed, or
 * typed slightly wrong, and the only honest way to know is to load it. Without
 * this the admin shows a broken image and leaves you guessing whose fault it is.
 */
let photoCheckToken = 0;
function checkPhoto() {
  const note = $("photo-note");
  const shot = $("lo-avatar");
  const lo = currentLo();
  if (!note || !lo) return;

  const value = (lo.photo || "").trim();
  const token = ++photoCheckToken;

  if (!value) {
    note.className = "field-note";
    note.innerHTML = `A link to the headshot on the company site, or a file committed under <span class="mono">photos/</span>.`;
    return;
  }

  note.className = "field-note";
  note.textContent = "Checking...";

  const probe = new Image();
  probe.onload = () => {
    if (token !== photoCheckToken) return; // a newer keystroke already won
    note.className = "field-note field-note-ok";
    note.textContent = `Loads, ${probe.naturalWidth} by ${probe.naturalHeight}. ${
      probe.naturalWidth === probe.naturalHeight ? "Square, which is what the app crops to." : "Not square, so the app will crop it to a circle from the centre."
    }`;
    if (shot && shot.tagName === "IMG") shot.src = value;
  };
  probe.onerror = () => {
    if (token !== photoCheckToken) return;
    note.className = "field-note field-note-bad";
    note.textContent = "Will not load. The app falls back to initials, so this is safe to leave, but the link is wrong.";
  };
  probe.src = value;
}

function renderAll() {
  renderRail();
  renderDetail();
}

function select(next) {
  selection = next;
  customLabelIds.clear();
  renderAll();
  $("detail").scrollTop = 0;
}

/* ---------- static button labels (icons plus text) ---------- */

function paintStaticButtons() {
  $("export-btn").innerHTML = `${icon("download")}<span>Export config.json</span>`;
  $("copy-json-btn").innerHTML = `${icon("copy")}<span>Copy JSON</span>`;
  $("reset-btn").innerHTML = `${icon("refresh")}<span>Discard local changes</span>`;
  $("view-app-btn").innerHTML = `${icon("external")}<span>View app</span>`;
  $("preview-draft-btn").innerHTML = `${icon("search")}<span>Preview draft</span>`;
  $("add-lo-btn").innerHTML = icon("plus");
}

/* ---------- rail events ---------- */

document.querySelector(".admin-rail").addEventListener("click", (e) => {
  const item = e.target.closest(".rail-item");
  if (!item) return;
  const nav = item.dataset.nav;
  select(nav === "lo" ? { type: "lo", slug: item.dataset.slug } : { type: nav, slug: null });
});

/**
 * A headshot that will not load must never render as the browser's broken image
 * icon. Error events do not bubble, but they do capture, so one listener per
 * container covers every avatar through any number of re-renders.
 */
function swapBrokenAvatar(root, cls) {
  root.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (!el || el.tagName !== "IMG" || !el.classList.contains(cls)) return;
      const span = document.createElement("span");
      span.className = cls;
      span.innerHTML = icon("user");
      el.replaceWith(span);
    },
    true
  );
}
swapBrokenAvatar(document.querySelector(".admin-rail"), "rail-avatar");
swapBrokenAvatar($("detail"), "lo-avatar");

$("rail-filter").addEventListener("input", (e) => {
  if (e.target.id !== "lo-filter") return;
  loFilter = e.target.value;
  renderRail();
  const box = document.getElementById("lo-filter");
  if (box) {
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
});

/* ---------- add a loan officer ---------- */

function showAddLoForm(show) {
  const box = $("add-lo-form");
  box.hidden = !show;
  if (!show) {
    box.innerHTML = "";
    return;
  }
  const tpl = templateLo();
  const count = linkTemplate().length;
  box.innerHTML = `
    <input id="new-lo-name" placeholder="Full name" aria-label="New loan officer's full name" />
    <div class="add-lo-actions">
      <button class="btn btn-primary btn-sm" id="create-lo-btn" type="button">Add</button>
      <button class="btn btn-quiet btn-sm" id="cancel-lo-btn" type="button">Cancel</button>
    </div>
    <p class="add-lo-note">${
      tpl && count
        ? `Starts with all ${count} rows from ${escapeHtml(tpl.name)}, URLs filled in where they can be derived from the name.`
        : `The slug and install link come from the name.`
    }</p>`;
  $("new-lo-name").focus();
}

function createLo() {
  const input = $("new-lo-name");
  const name = (input.value || "").trim();
  if (!name) {
    input.focus();
    return;
  }
  const slug = uniqueSlug(slugify(name));
  const lo = { slug, name, title: "", photo: "", customLinks: [] };
  lo.title = (templateLo() && templateLo().title) || "";
  /* Blank, not copied: NMLS, phone and email are the three things on a letter
     that must never carry another LO's identity. */
  lo.nmls = "";
  lo.phone = "";
  lo.email = "";
  /* Photo stays blank on purpose. Pointing it at a file nobody has added yet
     would put a broken image in the rail and in the app; the empty state falls
     back to a person icon, and the field's placeholder says where to put it. */
  lo.customLinks = linkTemplate().map((entry) => templateLinkFor(entry, lo));
  state.los.push(lo);
  showAddLoForm(false);
  markDirty();
  select({ type: "lo", slug });
}

$("add-lo-btn").addEventListener("click", () => showAddLoForm($("add-lo-form").hidden));

$("add-lo-form").addEventListener("click", (e) => {
  if (e.target.closest("#create-lo-btn")) createLo();
  if (e.target.closest("#cancel-lo-btn")) showAddLoForm(false);
});

$("add-lo-form").addEventListener("keydown", (e) => {
  if (e.target.id !== "new-lo-name") return;
  if (e.key === "Enter") createLo();
  if (e.key === "Escape") showAddLoForm(false);
});

/* ---------- detail events: typing ---------- */

$("detail").addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const row = e.target.closest(".frow");

  if (row && row.dataset.kind === "category") {
    const cat = state.categories.find((c) => c.id === row.dataset.id);
    if (!cat) return;
    cat[field] = field === "order" ? Number(e.target.value) || 0 : e.target.value;
    markDirty();
    return;
  }

  if (row && (row.dataset.kind === "generic" || row.dataset.kind === "custom")) {
    const isGeneric = row.dataset.kind === "generic";
    const lo = currentLo();
    const list = isGeneric ? state.genericLinks : lo ? lo.customLinks : [];
    const link = list.find((l) => l.id === row.dataset.id);
    if (!link) return;
    link[field] = e.target.value;
    markDirty();
    if (field === "url") {
      /* The row's own state changed: it may no longer be blank, and it is no
         longer whatever the template filled in. Repaint just this row's marks
         rather than the panel, which would take the caret with it. */
      row.classList.toggle("needs-url", !hasUrl(link));
      const tag = row.querySelector(".auto-tag");
      if (tag) tag.remove();
      if (!isGeneric) renderRail();
    }
    return;
  }

  /* LO identity fields. Patched in place rather than re-rendered, so typing a
     name does not throw focus out of the input on every keystroke. */
  const lo = currentLo();
  if (!lo || !e.target.closest(".lo-identity")) return;

  if (field === "slug") {
    const next = slugify(e.target.value);
    if (!next || next === lo.slug || state.los.some((l) => l.slug === next)) return;
    if (state.templateSlug === lo.slug) state.templateSlug = next;
    lo.slug = next;
    selection.slug = next;
    const url = installUrlFor(next);
    document.querySelector(".install-url").textContent = url;
    document.querySelector(".copy-install-btn").dataset.url = url;
    document.querySelectorAll("[data-lo]").forEach((el) => (el.dataset.lo = next));
    markDirty();
    renderRail();
    return;
  }

  lo[field] = e.target.value;
  markDirty();

  if (field === "name") {
    document.querySelector(".lo-head-text h2").textContent = lo.name || "Unnamed LO";
    renderRail();
    return;
  }
  if (field === "title") {
    document.querySelector(".lo-head-text .panel-sub").textContent = lo.title || "No title set";
    renderRail();
    return;
  }
  if (field === "photo") {
    /* Do not point the visible avatar at a half typed URL, it just flickers a
       broken image. The probe swaps it in once the value actually loads. */
    if (!lo.photo) renderDetail();
    checkPhoto();
    renderRail();
  }
});

/* Show the normalized slug once they stop typing in it. */
$("detail").addEventListener(
  "blur",
  (e) => {
    if (e.target.dataset?.field !== "slug") return;
    const lo = currentLo();
    if (lo) e.target.value = lo.slug;
  },
  true
);

/* ---------- detail events: selects and switches ---------- */

$("detail").addEventListener("change", (e) => {
  if (e.target.id === "template-select") {
    state.templateSlug = e.target.value;
    markDirty();
    renderAll();
    return;
  }

  const field = e.target.dataset.field;
  if (!field) return;
  const row = e.target.closest(".frow");
  if (!row) return;

  if (row.dataset.kind === "category" && field === "icon") {
    const cat = state.categories.find((c) => c.id === row.dataset.id);
    if (cat) {
      cat.icon = e.target.value;
      row.querySelector(".icon-swatch").innerHTML = icon(resolveIconName(cat.icon));
      markDirty();
    }
    return;
  }

  const isGeneric = row.dataset.kind === "generic";
  const lo = currentLo();
  const list = isGeneric ? state.genericLinks : lo ? lo.customLinks : [];
  const link = list.find((l) => l.id === row.dataset.id);
  if (!link) return;

  if (field === "shareable") {
    link.shareable = e.target.checked;
    if (!e.target.checked) delete link.shareable;
    markDirty();
    return; // no re-render, it would drop focus off the switch
  }

  if (field === "categoryId") {
    link.categoryId = e.target.value;
    markDirty();
    renderDetail(); // the row moves under its new category label
    return;
  }

  /* Label picked from the dropdown. Choosing a template label brings the rest
     of that row's setup with it: the share default, and the URL where it can
     be derived from this LO's name. */
  if (field === "label" && e.target.tagName === "SELECT") {
    if (e.target.value === "__custom__") {
      customLabelIds.add(link.id);
      renderDetail();
      const box = document.querySelector(`.frow[data-id="${link.id}"] input[data-field="label"]`);
      if (box) {
        box.focus();
        box.select();
      }
      return;
    }
    link.label = e.target.value;
    const entry = !isGeneric && lo ? templateEntry(link.categoryId, link.label) : null;
    if (entry) {
      if (entry.shareable) link.shareable = true;
      else delete link.shareable;
      if (!hasUrl(link) && entry.urlPattern) link.url = applyPattern(entry.urlPattern, lo);
      if (entry.kind) link.kind = entry.kind;
      if (entry.image) link.image = entry.image.split(templateSlug()).join(lo.slug);
    }
    markDirty();
    renderDetail();
    if (!isGeneric) renderRail();
  }
});

/* ---------- detail events: buttons ---------- */

$("detail").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action], .copy-install-btn");
  if (!btn) return;

  if (btn.classList.contains("copy-install-btn")) {
    navigator.clipboard?.writeText(btn.dataset.url).then(() => {
      const original = btn.innerHTML;
      btn.innerHTML = `${icon("check")}<span>Copied</span>`;
      setTimeout(() => (btn.innerHTML = original), 1200);
    });
    return;
  }

  const action = btn.dataset.action;
  const row = btn.closest(".frow");
  const lo = currentLo();

  if (action === "add-category") {
    state.categories.push({
      id: uid("cat"),
      label: "New category",
      icon: "link",
      order: state.categories.length + 1,
    });
    markDirty();
    renderAll();
    return;
  }

  if (action === "remove-category") {
    const id = row.dataset.id;
    const inUse =
      state.genericLinks.some((l) => l.categoryId === id) ||
      state.los.some((one) => one.customLinks.some((l) => l.categoryId === id));
    if (
      inUse &&
      !confirm(
        "Links still use this category. Remove it anyway? Those links stop showing until you re-categorize them."
      )
    ) {
      return;
    }
    state.categories = state.categories.filter((c) => c.id !== id);
    markDirty();
    renderAll();
    return;
  }

  if (action === "add-generic") {
    if (!state.categories.length) return alert("Add a category first.");
    state.genericLinks.push({
      id: uid("g"),
      categoryId: sortedCategories()[0].id,
      label: "New link",
      url: "",
      order: state.genericLinks.length + 1,
    });
    markDirty();
    renderAll();
    return;
  }

  if (action === "remove-generic") {
    state.genericLinks = state.genericLinks.filter((l) => l.id !== row.dataset.id);
    markDirty();
    renderAll();
    return;
  }

  if (!lo) return;

  if (action === "fill-template") {
    missingTemplateEntries(lo).forEach((entry) => lo.customLinks.push(templateLinkFor(entry, lo)));
    markDirty();
    renderAll();
    return;
  }

  if (action === "add-link") {
    if (!state.categories.length) return alert("Add a category first.");
    const categoryId = sortedCategories()[0].id;
    const known = linkTemplate().filter((t) => t.categoryId === categoryId);
    lo.customLinks.push({
      id: uid("c"),
      categoryId,
      label: known.length ? known[0].label : "New link",
      url: "",
      order: lo.customLinks.filter((l) => l.categoryId === categoryId).length + 1,
    });
    markDirty();
    renderAll();
    return;
  }

  if (action === "remove-link") {
    lo.customLinks = lo.customLinks.filter((l) => l.id !== row.dataset.id);
    markDirty();
    renderAll();
    return;
  }

  if (action === "remove-lo") {
    if (!confirm(`Remove ${lo.name}? This deletes their custom links too.`)) return;
    state.los = state.los.filter((l) => l.slug !== lo.slug);
    markDirty();
    const next = sortedLos()[0];
    select(next ? { type: "lo", slug: next.slug } : { type: "shared", slug: null });
  }
});

/* ---------- Export and reset ---------- */

$("export-btn").addEventListener("click", () => {
  /* Last line of defence. Exporting replaces the published config wholesale, so
     anything live that is not in this state disappears from every LO's app.
     Name it before that happens rather than after. */
  const losing = configDiff(state, publishedConfig);
  if (!diffIsEmpty(losing)) {
    const parts = [];
    if (losing.los.length) parts.push(`loan officers: ${losing.los.join(", ")}`);
    if (losing.shared.length) parts.push(`shared links: ${losing.shared.join(", ")}`);
    if (losing.categories.length) parts.push(`categories: ${losing.categories.join(", ")}`);
    if (
      !confirm(
        `This export drops things that are live in the app right now.\n\n${parts.join(
          "\n"
        )}\n\nPublishing it removes them for every LO. Continue?`
      )
    ) {
      return;
    }
  }

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markClean("Exported. Replace data/config.json, then redeploy.");
});

$("copy-json-btn").addEventListener("click", () => {
  navigator.clipboard?.writeText(JSON.stringify(state, null, 2));
  const btn = $("copy-json-btn");
  const original = btn.innerHTML;
  btn.innerHTML = `${icon("check")}<span>Copied</span>`;
  setTimeout(() => (btn.innerHTML = original), 1200);
});

$("reset-btn").addEventListener("click", async () => {
  if (!confirm("Discard local changes and reload the published config.json?")) return;
  clearDraft();
  clearStashedDraft();
  conflictDraft = null;
  await boot();
  markClean();
});

/* ---------- Boot ---------- */

/**
 * Decide what to open, and never quietly open something behind the live app.
 *
 * A draft is only the truth if it was started from the config that is
 * published now. This screen used to prefer any saved draft, which meant a
 * draft left in a browser weeks ago loaded as if it were current: the admin
 * showed one loan officer while the app was serving three, with the status pill
 * inviting an export that would have deleted the other two and three shared
 * links. So a draft whose base does not match gets parked, the published config
 * opens instead, and the difference is spelled out on screen.
 */
async function boot() {
  publishedConfig = await loadConfig();
  publishedFingerprint = fingerprint(publishedConfig);

  const draft = readDraft();
  const base = readDraftBase();
  conflictDraft = null;

  if (draft && base && base === publishedFingerprint) {
    state = draft; // a genuine edit in progress against the current published config
  } else if (draft) {
    conflictDraft = draft;
    stashDraft(draft);
    clearDraft();
    state = publishedConfig;
  } else {
    state = publishedConfig;
    conflictDraft = readStashedDraft(); // a conflict flagged earlier and not yet resolved
  }

  if (!state.templateSlug) state.templateSlug = templateSlug(); // older drafts
  writeDraftBase(publishedFingerprint);
  paintStaticButtons();

  const first = sortedLos()[0];
  selection = first ? { type: "lo", slug: first.slug } : { type: "shared", slug: null };
  customLabelIds.clear();

  renderAll();
  renderConflictBar();

  const editing = state !== publishedConfig;
  markClean(editing ? "Unsaved changes. Export to publish." : "No unsaved changes");
  if (editing) {
    $("status-pill").className = "status-pill status-draft";
  }
}

/* ---------- the parked draft ---------- */

function renderConflictBar() {
  const bar = $("conflict-bar");
  if (!bar) return;

  if (!conflictDraft || state === conflictDraft) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  const missing = configDiff(conflictDraft, publishedConfig);
  const extra = configDiff(publishedConfig, conflictDraft);
  const list = (label, items) =>
    items.length ? `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(items.join(", "))}</li>` : "";

  bar.hidden = false;
  bar.innerHTML = `
    <div class="conflict-body">
      <p class="conflict-lead">This browser had unpublished edits from an earlier session, started from a version of the app that has since changed. The published version is open, so nothing live has been touched.</p>
      <ul class="conflict-list">
        ${
          diffIsEmpty(missing)
            ? `<li>Those edits are not missing anything that is published.</li>`
            : `${list("Not in those edits", missing.los)}${list("Shared links not in those edits", missing.shared)}${list("Categories not in those edits", missing.categories)}`
        }
        ${list("Only in those edits", extra.los)}${list("Shared links only in those edits", extra.shared)}
      </ul>
      <div class="conflict-actions">
        <button class="btn btn-outline btn-sm" data-conflict="restore" type="button">Open those edits instead</button>
        <button class="btn btn-quiet btn-sm" data-conflict="drop" type="button">Discard them</button>
      </div>
    </div>`;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-conflict]");
  if (!btn) return;

  if (btn.dataset.conflict === "restore") {
    state = conflictDraft;
    if (!state.templateSlug) state.templateSlug = templateSlug();
    saveDraft(state);
    const first = sortedLos()[0];
    selection = first ? { type: "lo", slug: first.slug } : { type: "shared", slug: null };
    renderAll();
    renderConflictBar();
    markDirty();
    return;
  }

  if (btn.dataset.conflict === "drop") {
    if (!confirm("Discard those earlier edits for good?")) return;
    conflictDraft = null;
    clearStashedDraft();
    renderConflictBar();
  }
});

boot();

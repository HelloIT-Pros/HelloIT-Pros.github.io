/**
 * Homespire 360 admin screen.
 *
 * Edits an in-memory `state` object (same shape as config.json), autosaves to a
 * localStorage draft on every change, and exports the result as a downloadable
 * config.json to redeploy. No backend, no login. See README.md.
 *
 * Layout is master and detail: a left rail lists what can be edited (setup,
 * then one row per loan officer) and the right panel shows only the thing
 * selected. The previous single column rendered every category block for every
 * LO at once, which meant scrolling past seven headings and a read-only copy of
 * every shared link to reach one field. Selecting one subject at a time is what
 * lets this hold 50 LOs instead of about 3.
 */

let state = null;
let dirty = false;

/* What the right panel is showing. type: "categories" | "shared" | "lo". */
let selection = { type: "shared", slug: null };

let loFilter = "";

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

/* ---------- shared field markup ---------- */

function categoryOptions(selectedId) {
  return sortedCategories()
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
}

function iconOptions(selectedName) {
  const current = resolveIconName(selectedName);
  return ICON_CHOICES.map(
    (choice) =>
      `<option value="${choice.name}" ${choice.name === current ? "selected" : ""}>${choice.label}</option>`
  ).join("");
}

/**
 * The per-link share toggle. Off by default: most links are internal tools and
 * a share button on those is clutter that invites sending the wrong thing to a
 * borrower. Turn it on for anything outward facing.
 */
function shareToggle(link) {
  return `
    <label class="share-toggle" title="Show a share button on this link in the app">
      <input type="checkbox" data-field="shareable" ${link.shareable ? "checked" : ""} />
      <span>Share</span>
    </label>`;
}

/**
 * Label and URL lead, because those are what gets edited. Category comes after
 * them: the rows are already grouped under a category heading, so the select is
 * there to move a link, not to tell you where it is.
 */
function linkRowMarkup(link, kind) {
  const isQr = link.kind === "qr";
  return `
    <div class="frow has-toggle${isQr ? " is-qr-row" : ""}" data-kind="${kind}" data-id="${escapeHtml(link.id)}">
      <input data-field="label" value="${escapeHtml(link.label)}" placeholder="Label" aria-label="Label" />
      <input data-field="url" class="mono" value="${escapeHtml(link.url)}" placeholder="https://" aria-label="URL" />
      <select class="quiet-select" data-field="categoryId" aria-label="Category">${categoryOptions(link.categoryId)}</select>
      ${shareToggle(link)}
      <button class="del-btn" data-action="${kind === "custom" ? "remove-link" : "remove-generic"}" type="button" aria-label="Remove ${escapeHtml(link.label)}">${icon("trash")}</button>
    </div>`;
}

/** Column titles, written once above the rows instead of on every row. */
function linkTableHead() {
  return `
    <div class="table-head">
      <span>Label</span><span>URL</span><span>Category</span><span>Share</span><span></span>
    </div>`;
}

/**
 * A flat list of links with a small label wherever the category changes. The
 * grouping stays legible without rendering a heading for every category
 * whether or not it holds anything.
 */
function groupedLinkRows(links, kind) {
  let lastCategory = null;
  return links
    .map((link) => {
      const head =
        link.categoryId === lastCategory
          ? ""
          : `<p class="group-label">${escapeHtml(catLabel(link.categoryId))}</p>`;
      lastCategory = link.categoryId;
      return head + linkRowMarkup(link, kind);
    })
    .join("");
}

/* ---------- left rail ---------- */

function railItem({ nav, slug, name, sub, iconName, photo, active }) {
  const avatar = photo
    ? `<img class="rail-avatar" src="${escapeHtml(photo)}" alt="" />`
    : `<span class="rail-avatar">${icon(iconName || "user")}</span>`;
  return `
    <button class="rail-item" type="button" data-nav="${nav}" ${slug ? `data-slug="${escapeHtml(slug)}"` : ""} ${active ? 'aria-current="true"' : ""}>
      ${avatar}
      <span class="rail-text">
        <span class="rail-name">${escapeHtml(name)}</span>
        <span class="rail-sub">${escapeHtml(sub)}</span>
      </span>
    </button>`;
}

function renderRail() {
  const catCount = state.categories.length;
  const sharedCount = state.genericLinks.length;

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
      const count = lo.customLinks.length;
      const bits = [lo.title, `${count} ${count === 1 ? "link" : "links"}`].filter(Boolean);
      return railItem({
        nav: "lo",
        slug: lo.slug,
        name: lo.name || lo.slug,
        sub: bits.join(" · "),
        photo: lo.photo,
        active: selection.type === "lo" && selection.slug === lo.slug,
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
      ${links.length ? linkTableHead() + groupedLinkRows(links, "generic") : `<p class="panel-empty">No shared links yet.</p>`}
    </section>`;
}

/* ---------- detail: one loan officer ---------- */

function renderLoDetail(lo) {
  const links = [...lo.customLinks].sort(byCategoryThenOrder);
  const shared = [...state.genericLinks].sort(byCategoryThenOrder);
  const avatar = lo.photo
    ? `<img class="lo-avatar" src="${escapeHtml(lo.photo)}" alt="" />`
    : `<span class="lo-avatar">${icon("user")}</span>`;
  const install = installUrlFor(lo.slug);
  const hasQr = links.some((l) => l.kind === "qr");

  return `
    <section class="panel lo-identity" data-lo="${escapeHtml(lo.slug)}">
      <div class="lo-head">
        ${avatar}
        <div class="lo-head-text">
          <h2>${escapeHtml(lo.name || "Unnamed LO")}</h2>
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
        <label class="field"><span>Headshot path</span>
          <input data-field="photo" class="mono" value="${escapeHtml(lo.photo || "")}" placeholder="photos/${escapeHtml(lo.slug)}.png" /></label>
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
          <p class="panel-sub">Only ${escapeHtml(firstNameOf(lo))} sees these, on top of the shared links below.</p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="add-link" type="button">${icon("plus")}<span>Add link</span></button>
      </div>
      ${
        links.length
          ? linkTableHead() + groupedLinkRows(links, "custom")
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

  const lo = currentLo();
  if (!lo) {
    panel.innerHTML = `
      <section class="panel">
        <p class="panel-empty">Pick something on the left, or add a loan officer.</p>
      </section>`;
    return;
  }
  panel.innerHTML = renderLoDetail(lo);
}

function renderAll() {
  renderRail();
  renderDetail();
}

function select(next) {
  selection = next;
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
  box.innerHTML = `
    <input id="new-lo-name" placeholder="Full name" aria-label="New loan officer's full name" />
    <div class="add-lo-actions">
      <button class="btn btn-primary btn-sm" id="create-lo-btn" type="button">Add</button>
      <button class="btn btn-quiet btn-sm" id="cancel-lo-btn" type="button">Cancel</button>
    </div>
    <p class="add-lo-note">The slug and install link come from the name. Everything else is editable after.</p>`;
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
  state.los.push({ slug, name, title: "", photo: "", customLinks: [] });
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

  if (row && row.dataset.kind === "generic") {
    const link = state.genericLinks.find((l) => l.id === row.dataset.id);
    if (!link) return;
    link[field] = e.target.value;
    markDirty();
    return;
  }

  if (row && row.dataset.kind === "custom") {
    const lo = currentLo();
    const link = lo && lo.customLinks.find((l) => l.id === row.dataset.id);
    if (!link) return;
    link[field] = e.target.value;
    markDirty();
    return;
  }

  /* LO identity fields. Patched in place rather than re-rendered, so typing a
     name does not throw focus out of the input on every keystroke. */
  const lo = currentLo();
  if (!lo || !e.target.closest(".lo-identity")) return;

  if (field === "slug") {
    const next = slugify(e.target.value);
    if (!next || next === lo.slug || state.los.some((l) => l.slug === next)) return;
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
    const shot = document.querySelector(".lo-avatar");
    if (shot && shot.tagName === "IMG") {
      shot.src = lo.photo;
    } else if (lo.photo) {
      renderDetail();
    }
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

/* ---------- detail events: selects and checkboxes ---------- */

$("detail").addEventListener("change", (e) => {
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
    return; // no re-render, it would drop focus off the checkbox
  }

  if (field === "categoryId") {
    link.categoryId = e.target.value;
    markDirty();
    renderDetail(); // the row moves under its new category label
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
      url: "https://",
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

  if (action === "add-link") {
    if (!state.categories.length) return alert("Add a category first.");
    const categoryId = sortedCategories()[0].id;
    lo.customLinks.push({
      id: uid("c"),
      categoryId,
      label: "New link",
      url: "https://",
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
  await boot();
  markClean();
});

/* ---------- Boot ---------- */

async function boot() {
  state = await loadConfig({ allowDraft: true });
  paintStaticButtons();

  const first = sortedLos()[0];
  selection = first ? { type: "lo", slug: first.slug } : { type: "shared", slug: null };

  renderAll();

  const hasDraft = Boolean(readDraft());
  markClean(hasDraft ? "Unsaved changes. Export to publish." : "No unsaved changes");
  if (hasDraft) {
    $("status-pill").className = "status-pill status-draft";
  }
}

boot();

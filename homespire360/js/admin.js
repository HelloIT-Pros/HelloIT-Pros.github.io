/**
 * Homespire 360 admin screen.
 *
 * Edits an in-memory `state` object (same shape as config.json), autosaves to a
 * localStorage draft on every change, and exports the result as a downloadable
 * config.json to redeploy. No backend, no login. See README.md.
 */

let state = null;
let dirty = false;
let selectedLoSlug = null;

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
  const pill = document.getElementById("status-pill");
  pill.textContent = "Unsaved changes. Export to publish.";
  pill.className = "status-pill status-draft";
}

function markClean(label) {
  dirty = false;
  const pill = document.getElementById("status-pill");
  pill.textContent = label || "No unsaved changes";
  pill.className = "status-pill status-clean";
}

function categoryOptions(selectedId) {
  return state.categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
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

function iconOptions(selectedName) {
  const current = resolveIconName(selectedName);
  return ICON_CHOICES.map(
    (choice) =>
      `<option value="${choice.name}" ${choice.name === current ? "selected" : ""}>${choice.label}</option>`
  ).join("");
}

/* ---------- static button labels (icons plus text) ---------- */

function paintStaticButtons() {
  document.getElementById("export-btn").innerHTML = `${icon("download")}<span>Export config.json</span>`;
  document.getElementById("copy-json-btn").innerHTML = `${icon("copy")}<span>Copy JSON</span>`;
  document.getElementById("reset-btn").innerHTML = `${icon("refresh")}<span>Discard local changes</span>`;
  document.getElementById("view-app-btn").innerHTML = `${icon("external")}<span>View app</span>`;
  document.getElementById("preview-draft-btn").innerHTML = `${icon("search")}<span>Preview draft</span>`;
  document.getElementById("add-category-btn").innerHTML = `${icon("plus")}<span>Add category</span>`;
  document.getElementById("add-generic-link-btn").innerHTML = `${icon("plus")}<span>Add shared link</span>`;
  document.getElementById("add-lo-btn").innerHTML = `${icon("plus")}<span>Add loan officer</span>`;
}

/* ---------- Categories ---------- */

function renderCategories() {
  const list = document.getElementById("categories-list");
  const sorted = [...state.categories].sort((a, b) => a.order - b.order);
  list.innerHTML = sorted
    .map(
      (c) => `
    <div class="frow" data-kind="category" data-id="${escapeHtml(c.id)}">
      <select data-field="icon">${iconOptions(c.icon)}</select>
      <input data-field="label" value="${escapeHtml(c.label)}" placeholder="Category name" />
      <input data-field="order" type="number" value="${c.order}" placeholder="Order" />
      <button class="del-btn" data-action="remove" type="button" aria-label="Remove category">${icon("trash")}</button>
    </div>`
    )
    .join("");
}

document.getElementById("categories-list").addEventListener("input", (e) => {
  const row = e.target.closest(".frow");
  if (!row) return;
  const cat = state.categories.find((c) => c.id === row.dataset.id);
  const field = e.target.dataset.field;
  cat[field] = field === "order" ? Number(e.target.value) || 0 : e.target.value;
  markDirty();
  if (field === "icon" || field === "label") renderLOs();
});

document.getElementById("categories-list").addEventListener("change", (e) => {
  if (e.target.dataset.field !== "icon") return;
  const row = e.target.closest(".frow");
  const cat = state.categories.find((c) => c.id === row.dataset.id);
  cat.icon = e.target.value;
  markDirty();
  renderLOs();
});

document.getElementById("categories-list").addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;
  const row = btn.closest(".frow");
  const id = row.dataset.id;
  const inUse =
    state.genericLinks.some((l) => l.categoryId === id) ||
    state.los.some((lo) => lo.customLinks.some((l) => l.categoryId === id));
  if (
    inUse &&
    !confirm("Links still use this category. Remove it anyway? Those links stop showing until you re-categorize them.")
  ) {
    return;
  }
  state.categories = state.categories.filter((c) => c.id !== id);
  markDirty();
  renderCategories();
  renderGenericLinks();
  renderLOs();
});

document.getElementById("add-category-btn").addEventListener("click", () => {
  state.categories.push({
    id: uid("cat"),
    label: "New Category",
    icon: "link",
    order: state.categories.length + 1,
  });
  markDirty();
  renderCategories();
  renderGenericLinks();
  renderLOs();
});

/* ---------- Shared links ---------- */

function renderGenericLinks() {
  const list = document.getElementById("generic-links-list");
  const sorted = [...state.genericLinks].sort((a, b) => (a.order || 0) - (b.order || 0));
  list.innerHTML = sorted
    .map(
      (l) => `
    <div class="frow has-toggle" data-kind="generic" data-id="${escapeHtml(l.id)}">
      <select data-field="categoryId">${categoryOptions(l.categoryId)}</select>
      <input data-field="label" value="${escapeHtml(l.label)}" placeholder="Label" />
      <input data-field="url" class="mono" value="${escapeHtml(l.url)}" placeholder="https://" />
      ${shareToggle(l)}
      <button class="del-btn" data-action="remove" type="button" aria-label="Remove link">${icon("trash")}</button>
    </div>`
    )
    .join("");
}

document.getElementById("generic-links-list").addEventListener("input", (e) => {
  const row = e.target.closest(".frow");
  if (!row) return;
  const link = state.genericLinks.find((l) => l.id === row.dataset.id);
  link[e.target.dataset.field] = e.target.value;
  markDirty();
});

document.getElementById("generic-links-list").addEventListener("change", (e) => {
  const field = e.target.dataset.field;
  if (field !== "categoryId" && field !== "shareable") return;
  const row = e.target.closest(".frow");
  const link = state.genericLinks.find((l) => l.id === row.dataset.id);

  if (field === "shareable") {
    link.shareable = e.target.checked;
    if (!e.target.checked) delete link.shareable;
    markDirty();
    renderLOs();
    return;
  }

  link.categoryId = e.target.value;
  markDirty();
  renderLOs();
});

document.getElementById("generic-links-list").addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;
  const row = btn.closest(".frow");
  state.genericLinks = state.genericLinks.filter((l) => l.id !== row.dataset.id);
  markDirty();
  renderGenericLinks();
  renderLOs();
});

document.getElementById("add-generic-link-btn").addEventListener("click", () => {
  if (!state.categories.length) return alert("Add a category first.");
  state.genericLinks.push({
    id: uid("g"),
    categoryId: state.categories[0].id,
    label: "New link",
    url: "https://",
    order: state.genericLinks.length + 1,
  });
  markDirty();
  renderGenericLinks();
  renderLOs();
});

/* ---------- Loan officers ---------- */

function renderLoSelector() {
  const selector = document.getElementById("lo-selector");
  const sorted = [...state.los].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (!selectedLoSlug || !state.los.some((l) => l.slug === selectedLoSlug)) {
    selectedLoSlug = sorted[0] ? sorted[0].slug : null;
  }

  selector.innerHTML =
    sorted
      .map(
        (lo) =>
          `<option value="${escapeHtml(lo.slug)}" ${lo.slug === selectedLoSlug ? "selected" : ""}>${escapeHtml(lo.name || lo.slug)}</option>`
      )
      .join("") || `<option value="">No loan officers yet</option>`;
}

function renderLOs() {
  renderLoSelector();

  const container = document.getElementById("los-list");
  const lo = state.los.find((l) => l.slug === selectedLoSlug);

  if (!lo) {
    container.innerHTML = `<p class="small-note">No loan officers yet. Click Add loan officer above to create one.</p>`;
    return;
  }

  const installUrl = `${location.origin}${location.pathname.replace("admin.html", "index.html")}?lo=${encodeURIComponent(lo.slug)}`;
  const catsSorted = [...state.categories].sort((a, b) => a.order - b.order);
  const firstName = (lo.name || "this LO").split(" ")[0];

  container.innerHTML = `
    <div class="lo-card" data-lo="${escapeHtml(lo.slug)}">
      <div class="lo-card-head">
        <strong>${escapeHtml(lo.name || "Unnamed LO")}</strong>
        <button class="del-btn" data-action="remove-lo" type="button">${icon("trash")}<span>Remove</span></button>
      </div>

      <div class="frow" style="grid-template-columns: 1fr 1fr 1fr;">
        <input data-field="name" value="${escapeHtml(lo.name)}" placeholder="Full name" />
        <input data-field="title" value="${escapeHtml(lo.title || "")}" placeholder="Title or NMLS #" />
        <input data-field="slug" value="${escapeHtml(lo.slug)}" placeholder="url-slug" />
      </div>

      <div class="photo-row">
        ${
          lo.photo
            ? `<img class="photo-thumb" src="${escapeHtml(lo.photo)}" alt="" />`
            : `<span class="photo-thumb">${icon("user")}</span>`
        }
        <input data-field="photo" value="${escapeHtml(lo.photo || "")}" placeholder="Headshot path, for example photos/${escapeHtml(lo.slug)}.png" />
      </div>

      <p class="small-note">
        Install link: <span class="mono">${escapeHtml(installUrl)}</span>
        <button class="btn btn-outline copy-install-btn" data-url="${escapeHtml(installUrl)}" type="button">Copy</button>
      </p>

      ${catsSorted
        .map((cat) => {
          const generic = state.genericLinks
            .filter((g) => g.categoryId === cat.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          const custom = lo.customLinks
            .filter((c) => c.categoryId === cat.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          return `
          <div class="cat-block" data-category-id="${escapeHtml(cat.id)}">
            <h3>${icon(resolveIconName(cat.icon))}<span>${escapeHtml(cat.label)}</span></h3>
            ${
              generic.length
                ? generic
                    .map(
                      (g) => `
              <div class="shared-row">
                <span class="tag">Shared</span>
                <span class="lbl">${escapeHtml(g.label)}</span>
                <span class="mono">${escapeHtml(g.url)}</span>
              </div>`
                    )
                    .join("")
                : `<p class="small-note">No shared links in this category yet.</p>`
            }
            ${custom
              .map(
                (l) => `
            <div class="frow has-toggle${l.kind === "qr" ? " is-qr-row" : ""}" data-kind="custom" data-id="${escapeHtml(l.id)}">
              <select data-field="categoryId">${categoryOptions(l.categoryId)}</select>
              <input data-field="label" value="${escapeHtml(l.label)}" placeholder="Label" />
              <input data-field="url" class="mono" value="${escapeHtml(l.url)}" placeholder="https://" />
              ${shareToggle(l)}
              <button class="del-btn" data-action="remove-link" type="button" aria-label="Remove link">${icon("trash")}</button>
            </div>`
              )
              .join("")}
            ${
              custom.some((l) => l.kind === "qr")
                ? `<p class="small-note">The QR row's image is generated from its URL by <span class="mono">scripts/make_qr.py</span>. Change the URL and rerun that script, or the code will still scan to the old address.</p>`
                : ""
            }
            <button class="btn-add" data-action="add-link-in-category" data-category-id="${escapeHtml(cat.id)}" type="button">${icon("plus")}<span>Add a link for ${escapeHtml(firstName)}</span></button>
          </div>`;
        })
        .join("")}
    </div>`;
}

document.getElementById("lo-selector").addEventListener("change", (e) => {
  selectedLoSlug = e.target.value || null;
  renderLOs();
});

document.getElementById("los-list").addEventListener("input", (e) => {
  const loCard = e.target.closest(".lo-card");
  if (!loCard) return;
  const lo = state.los.find((l) => l.slug === loCard.dataset.lo);
  const linkRowEl = e.target.closest('.frow[data-kind="custom"]');

  if (linkRowEl) {
    const link = lo.customLinks.find((l) => l.id === linkRowEl.dataset.id);
    link[e.target.dataset.field] = e.target.value;
    markDirty();
    return;
  }

  const field = e.target.dataset.field;
  if (!field) return;

  if (field === "slug") {
    const newSlug = slugify(e.target.value);
    if (newSlug && newSlug !== lo.slug && !state.los.some((l) => l.slug === newSlug)) {
      lo.slug = newSlug;
      markDirty();
      renderLOs();
    }
    return;
  }

  lo[field] = e.target.value;
  markDirty();

  if (field === "photo") {
    const thumb = loCard.querySelector(".photo-thumb");
    if (thumb && thumb.tagName === "IMG") {
      thumb.src = lo.photo;
    } else if (lo.photo) {
      renderLOs();
    }
    return;
  }

  loCard.querySelector(".lo-card-head strong").textContent = lo.name || "Unnamed LO";
});

document.getElementById("los-list").addEventListener("change", (e) => {
  const field = e.target.dataset.field;
  if (field !== "categoryId" && field !== "shareable") return;
  const loCard = e.target.closest(".lo-card");
  const lo = state.los.find((l) => l.slug === loCard.dataset.lo);
  const linkRowEl = e.target.closest('.frow[data-kind="custom"]');
  if (!linkRowEl) return;
  const link = lo.customLinks.find((l) => l.id === linkRowEl.dataset.id);

  if (field === "shareable") {
    link.shareable = e.target.checked;
    if (!e.target.checked) delete link.shareable;
    markDirty();
    return; // no re-render, it would drop focus off the checkbox
  }

  link.categoryId = e.target.value;
  markDirty();
  renderLOs();
});

document.getElementById("los-list").addEventListener("click", (e) => {
  const loCard = e.target.closest(".lo-card");
  if (!loCard) return;
  const lo = state.los.find((l) => l.slug === loCard.dataset.lo);

  const removeLo = e.target.closest('[data-action="remove-lo"]');
  if (removeLo) {
    if (!confirm(`Remove ${lo.name}? This deletes their custom links too.`)) return;
    state.los = state.los.filter((l) => l.slug !== lo.slug);
    selectedLoSlug = null;
    markDirty();
    renderLOs();
    return;
  }

  const removeLink = e.target.closest('[data-action="remove-link"]');
  if (removeLink) {
    const row = removeLink.closest(".frow");
    lo.customLinks = lo.customLinks.filter((l) => l.id !== row.dataset.id);
    markDirty();
    renderLOs();
    return;
  }

  const addInCategory = e.target.closest('[data-action="add-link-in-category"]');
  if (addInCategory) {
    const categoryId = addInCategory.dataset.categoryId;
    lo.customLinks.push({
      id: uid("c"),
      categoryId,
      label: "New link",
      url: "https://",
      order: lo.customLinks.filter((l) => l.categoryId === categoryId).length + 1,
    });
    markDirty();
    renderLOs();
    return;
  }

  const copyBtn = e.target.closest(".copy-install-btn");
  if (copyBtn) {
    navigator.clipboard?.writeText(copyBtn.dataset.url).then(() => {
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
    });
  }
});

document.getElementById("add-lo-btn").addEventListener("click", () => {
  const name = prompt("New LO's full name?");
  if (!name) return;
  const slug = uniqueSlug(slugify(name));
  state.los.push({ slug, name, title: "", photo: "", customLinks: [] });
  selectedLoSlug = slug;
  markDirty();
  renderLOs();
});

/* ---------- Export and reset ---------- */

document.getElementById("export-btn").addEventListener("click", () => {
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

document.getElementById("copy-json-btn").addEventListener("click", () => {
  navigator.clipboard?.writeText(JSON.stringify(state, null, 2));
  const btn = document.getElementById("copy-json-btn");
  const original = btn.innerHTML;
  btn.innerHTML = `${icon("check")}<span>Copied</span>`;
  setTimeout(() => (btn.innerHTML = original), 1200);
});

document.getElementById("reset-btn").addEventListener("click", async () => {
  if (!confirm("Discard local changes and reload the published config.json?")) return;
  clearDraft();
  await boot();
  markClean();
});

/* ---------- Boot ---------- */

async function boot() {
  state = await loadConfig({ allowDraft: true });
  paintStaticButtons();
  renderCategories();
  renderGenericLinks();
  renderLOs();
  const hasDraft = Boolean(readDraft());
  markClean(hasDraft ? "Unsaved changes. Export to publish." : "No unsaved changes");
  if (hasDraft) {
    document.getElementById("status-pill").className = "status-pill status-draft";
  }
}

boot();

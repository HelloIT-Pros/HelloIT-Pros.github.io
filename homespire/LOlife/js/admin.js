/**
 * LO Life — admin screen.
 * Edits an in-memory `state` object (same shape as config.json), autosaves
 * to a localStorage draft on every change, and can export the result as a
 * downloadable config.json to redeploy. No backend, no login — see README.
 */

let state = null;
let dirty = false;

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
  pill.textContent = "Unsaved changes — export to publish";
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

// ---------- Categories ----------

function renderCategories() {
  const list = document.getElementById("categories-list");
  const sorted = [...state.categories].sort((a, b) => a.order - b.order);
  list.innerHTML = sorted
    .map(
      (c) => `
    <div class="row" data-kind="category" data-id="${escapeHtml(c.id)}">
      <input data-field="icon" value="${escapeHtml(c.icon || "")}" placeholder="Icon" maxlength="4" />
      <input data-field="label" value="${escapeHtml(c.label)}" placeholder="Category name" />
      <input data-field="order" type="number" value="${c.order}" placeholder="Order" />
      <button class="icon-btn" data-action="remove">✕</button>
    </div>`
    )
    .join("");
}

document.getElementById("categories-list").addEventListener("input", (e) => {
  const row = e.target.closest(".row");
  if (!row) return;
  const cat = state.categories.find((c) => c.id === row.dataset.id);
  const field = e.target.dataset.field;
  cat[field] = field === "order" ? Number(e.target.value) || 0 : e.target.value;
  markDirty();
});

document.getElementById("categories-list").addEventListener("click", (e) => {
  if (e.target.dataset.action !== "remove") return;
  const row = e.target.closest(".row");
  const id = row.dataset.id;
  const inUse =
    state.genericLinks.some((l) => l.categoryId === id) ||
    state.los.some((lo) => lo.customLinks.some((l) => l.categoryId === id));
  if (inUse && !confirm("Links still use this category. Remove it anyway? Those links will stop showing until re-categorized.")) {
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
    icon: "🔗",
    order: state.categories.length + 1,
  });
  markDirty();
  renderCategories();
  renderGenericLinks();
});

// ---------- Generic links ----------

function renderGenericLinks() {
  const list = document.getElementById("generic-links-list");
  const sorted = [...state.genericLinks].sort((a, b) => (a.order || 0) - (b.order || 0));
  list.innerHTML = sorted
    .map(
      (l) => `
    <div class="row" data-kind="generic" data-id="${escapeHtml(l.id)}">
      <select data-field="categoryId">${categoryOptions(l.categoryId)}</select>
      <input data-field="label" value="${escapeHtml(l.label)}" placeholder="Label" />
      <input data-field="url" class="lo-link-url" value="${escapeHtml(l.url)}" placeholder="https://..." />
      <button class="icon-btn" data-action="remove">✕</button>
    </div>`
    )
    .join("");
}

document.getElementById("generic-links-list").addEventListener("input", (e) => {
  const row = e.target.closest(".row");
  if (!row) return;
  const link = state.genericLinks.find((l) => l.id === row.dataset.id);
  link[e.target.dataset.field] = e.target.value;
  markDirty();
});

document.getElementById("generic-links-list").addEventListener("click", (e) => {
  if (e.target.dataset.action !== "remove") return;
  const row = e.target.closest(".row");
  state.genericLinks = state.genericLinks.filter((l) => l.id !== row.dataset.id);
  markDirty();
  renderGenericLinks();
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
});

// ---------- LOs ----------

function renderLOs() {
  const container = document.getElementById("los-list");
  container.innerHTML = state.los
    .map((lo) => {
      const installUrl = `${location.origin}${location.pathname.replace("admin.html", "index.html")}?lo=${encodeURIComponent(lo.slug)}`;
      return `
      <div class="lo-block" data-lo="${escapeHtml(lo.slug)}">
        <div class="lo-block-header">
          <strong>${escapeHtml(lo.name || "Unnamed LO")}</strong>
          <button class="icon-btn" data-action="remove-lo">✕ Remove</button>
        </div>
        <div class="row" style="grid-template-columns: 1fr 1fr 1fr;">
          <input data-field="name" value="${escapeHtml(lo.name)}" placeholder="Full name" />
          <input data-field="title" value="${escapeHtml(lo.title || "")}" placeholder="Title / NMLS #" />
          <input data-field="slug" value="${escapeHtml(lo.slug)}" placeholder="url-slug" />
        </div>
        <p class="small-note">Install link: <span class="lo-link-url">${escapeHtml(installUrl)}</span>
          <button class="btn btn-ghost copy-install-btn" data-url="${escapeHtml(installUrl)}" style="padding:2px 8px;">Copy</button>
        </p>
        <div class="custom-links" data-slug="${escapeHtml(lo.slug)}">
          ${lo.customLinks
            .map(
              (l) => `
            <div class="row" data-kind="custom" data-id="${escapeHtml(l.id)}">
              <select data-field="categoryId">${categoryOptions(l.categoryId)}</select>
              <input data-field="label" value="${escapeHtml(l.label)}" placeholder="Label" />
              <input data-field="url" class="lo-link-url" value="${escapeHtml(l.url)}" placeholder="https://..." />
              <button class="icon-btn" data-action="remove-link">✕</button>
            </div>`
            )
            .join("")}
        </div>
        <button class="btn btn-ghost add-custom-link-btn" style="margin-top:6px;">+ Add link for ${escapeHtml(lo.name || "this LO")}</button>
      </div>`;
    })
    .join("");
}

document.getElementById("los-list").addEventListener("input", (e) => {
  const loBlock = e.target.closest(".lo-block");
  if (!loBlock) return;
  const lo = state.los.find((l) => l.slug === loBlock.dataset.lo);
  const linkRow = e.target.closest('.row[data-kind="custom"]');

  if (linkRow) {
    const link = lo.customLinks.find((l) => l.id === linkRow.dataset.id);
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
      renderLOs(); // refresh install link + data-lo attribute
    }
    return;
  }
  lo[field] = e.target.value;
  markDirty();
  // name/title changes don't need a full re-render to stay usable,
  // but keep the header + install link in sync:
  loBlock.querySelector(".lo-block-header strong").textContent = lo.name || "Unnamed LO";
});

document.getElementById("los-list").addEventListener("click", (e) => {
  const loBlock = e.target.closest(".lo-block");
  if (!loBlock) return;
  const lo = state.los.find((l) => l.slug === loBlock.dataset.lo);

  if (e.target.dataset.action === "remove-lo") {
    if (!confirm(`Remove ${lo.name}? This deletes their custom links too.`)) return;
    state.los = state.los.filter((l) => l.slug !== lo.slug);
    markDirty();
    renderLOs();
    return;
  }

  if (e.target.dataset.action === "remove-link") {
    const row = e.target.closest(".row");
    lo.customLinks = lo.customLinks.filter((l) => l.id !== row.dataset.id);
    markDirty();
    renderLOs();
    return;
  }

  if (e.target.classList.contains("add-custom-link-btn")) {
    if (!state.categories.length) return alert("Add a category first.");
    lo.customLinks.push({
      id: uid("c"),
      categoryId: state.categories[0].id,
      label: "New link",
      url: "https://",
      order: lo.customLinks.length + 1,
    });
    markDirty();
    renderLOs();
    return;
  }

  if (e.target.classList.contains("copy-install-btn")) {
    navigator.clipboard?.writeText(e.target.dataset.url).then(() => {
      e.target.textContent = "Copied!";
      setTimeout(() => (e.target.textContent = "Copy"), 1200);
    });
  }
});

document.getElementById("add-lo-btn").addEventListener("click", () => {
  const name = prompt("New LO's full name?");
  if (!name) return;
  state.los.push({
    slug: uniqueSlug(slugify(name)),
    name,
    title: "",
    customLinks: [],
  });
  markDirty();
  renderLOs();
});

// ---------- Export / reset ----------

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
  markClean("Exported — replace data/config.json and redeploy");
});

document.getElementById("copy-json-btn").addEventListener("click", () => {
  navigator.clipboard?.writeText(JSON.stringify(state, null, 2));
  const btn = document.getElementById("copy-json-btn");
  const original = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = original), 1200);
});

document.getElementById("reset-btn").addEventListener("click", async () => {
  if (!confirm("Discard local changes and reload the published config.json?")) return;
  clearDraft();
  await boot();
  markClean();
});

// ---------- Boot ----------

async function boot() {
  state = await loadConfig();
  renderCategories();
  renderGenericLinks();
  renderLOs();
  markClean(readDraft() ? "Unsaved changes — export to publish" : "No unsaved changes");
  if (readDraft()) {
    document.getElementById("status-pill").className = "status-pill status-draft";
  }
}

boot();

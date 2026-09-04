/**
 * Homespire 360 loan officer view.
 *
 * Four tabs, rendered as a native-style bottom bar:
 *   Home      every link they can reach, grouped by category, with pill filters
 *   Favorites the links they starred, kept on this device
 *   Search    type-ahead across every link they can reach
 *   Profile   headshot, name, counts, and the switch-profile action
 */

const VIEW_ORDER = ["home", "favorites", "search", "profile"];
const VIEW_META = {
  home: { label: "Home", icon: "home" },
  favorites: { label: "Favorites", icon: "star" },
  search: { label: "Search", icon: "search" },
  profile: { label: "Profile", icon: "user" },
};

let appConfig = null;
let currentLo = null;
let currentView = "home";
let activeCategoryId = null;
let searchQuery = "";
let deferredInstallPrompt = null;
let installDismissed = false;
let favorites = new Set();

/* ---------- helpers ---------- */

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("lo") || "").trim().toLowerCase();
}

function firstNameOf(lo) {
  return lo && lo.name ? lo.name.split(" ")[0] : "";
}

function initialsOf(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function el(id) {
  return document.getElementById(id);
}

/* ---------- shared row markup ---------- */

function linkRow(link, category, subtitle) {
  const iconName = resolveIconName(category && category.icon);
  const starred = favorites.has(link.id);
  return `
    <div class="row has-fav">
      <a class="row-inner has-trailing" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" data-link-id="${escapeHtml(link.id)}">
        <span class="row-icon">${icon(iconName)}</span>
        <span class="row-body">
          <span class="row-title">${escapeHtml(link.label)}</span>
          ${subtitle ? `<span class="row-sub">${escapeHtml(subtitle)}</span>` : ""}
        </span>
      </a>
      <button class="fav-btn" type="button" data-link-id="${escapeHtml(link.id)}"
              aria-pressed="${starred}" aria-label="${starred ? "Remove from favorites" : "Add to favorites"}">
        ${icon("star")}
      </button>
    </div>`;
}

function actionRow(id, iconName, label, subtitle) {
  return `
    <div class="row">
      <button class="row-inner" type="button" id="${id}">
        <span class="row-icon">${icon(iconName)}</span>
        <span class="row-body">
          <span class="row-title">${escapeHtml(label)}</span>
          ${subtitle ? `<span class="row-sub">${escapeHtml(subtitle)}</span>` : ""}
        </span>
        <span class="row-go">${icon("chevron")}</span>
      </button>
    </div>`;
}

function statRow(iconName, label, subtitle) {
  return `
    <div class="row">
      <div class="row-inner">
        <span class="row-icon">${icon(iconName)}</span>
        <span class="row-body">
          <span class="row-title">${escapeHtml(label)}</span>
          <span class="row-sub">${escapeHtml(subtitle)}</span>
        </span>
      </div>
    </div>`;
}

function groupMarkup(category, rowsHtml) {
  return `
    <section class="group">
      <h2 class="group-title">${escapeHtml(category.label)}</h2>
      <div class="list">${rowsHtml}</div>
    </section>`;
}

function emptyState(iconName, message) {
  return `<div class="empty">${icon(iconName)}<p>${escapeHtml(message)}</p></div>`;
}

/* ---------- header and tabs ---------- */

function renderIdentity() {
  el("brand-name").textContent = appConfig.appName || "Homespire 360";
  el("org-name").textContent = appConfig.org || "";

  const img = el("avatar-img");
  const ini = el("avatar-initials");
  if (currentLo && currentLo.photo) {
    img.src = currentLo.photo;
    img.alt = currentLo.name;
    img.hidden = false;
    ini.textContent = "";
  } else {
    img.hidden = true;
    ini.textContent = currentLo ? initialsOf(currentLo.name) : "";
  }
}

function headerFor(view) {
  if (!currentLo) {
    return { title: "Welcome", sub: "Pick your name to load your shortcuts." };
  }
  if (view === "favorites") {
    return { title: "Favorites", sub: "The links you starred, ready in one tap." };
  }
  if (view === "search") {
    return { title: "Search", sub: "Find any link in one tap." };
  }
  if (view === "profile") {
    return { title: "Profile", sub: "Your account and app details." };
  }
  return {
    title: `Hi, ${firstNameOf(currentLo)}`,
    sub: "Everything you need at Homespire, in one place.",
  };
}

function renderTabBar() {
  const bar = el("tab-bar");
  if (!currentLo) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  bar.hidden = false;
  bar.innerHTML = VIEW_ORDER.map((view) => {
    const meta = VIEW_META[view];
    const active = view === currentView;
    return `
      <button class="tab" type="button" data-view="${view}" ${active ? 'aria-current="page"' : ""}>
        ${icon(meta.icon)}
        <span>${meta.label}</span>
      </button>`;
  }).join("");

  bar.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}

/* ---------- tools row (chips or search box) ---------- */

function renderTools() {
  const tools = el("view-tools");

  if (!currentLo || currentView === "profile" || currentView === "favorites") {
    tools.innerHTML = "";
    return;
  }

  if (currentView === "search") {
    tools.innerHTML = `
      <div class="search-wrap">
        ${icon("search")}
        <input class="search-input" id="search-input" type="search" inputmode="search"
               placeholder="Search your links" autocomplete="off" value="${escapeHtml(searchQuery)}" />
      </div>`;
    const input = el("search-input");
    input.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderSearchResults();
    });
    return;
  }

  const sections = buildLinksByCategory(appConfig, currentLo);
  if (sections.length < 2) {
    tools.innerHTML = "";
    return;
  }

  tools.innerHTML = `
    <div class="chip-row" id="chip-row">
      <button class="chip" type="button" data-category="" aria-pressed="${activeCategoryId ? "false" : "true"}">All</button>
      ${sections
        .map((section) => {
          const cat = section.category;
          const pressed = activeCategoryId === cat.id;
          return `
        <button class="chip" type="button" data-category="${escapeHtml(cat.id)}" aria-pressed="${pressed}">
          ${icon(resolveIconName(cat.icon))}
          <span>${escapeHtml(cat.label)}</span>
        </button>`;
        })
        .join("")}
    </div>`;

  tools.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategoryId = chip.dataset.category || null;
      tools.querySelectorAll(".chip").forEach((other) => {
        const isActive = (other.dataset.category || null) === activeCategoryId;
        other.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      renderMain();
    });
  });
}

/* ---------- views ---------- */

function renderHome() {
  let sections = buildLinksByCategory(appConfig, currentLo);
  if (activeCategoryId) {
    sections = sections.filter((section) => section.category.id === activeCategoryId);
  }
  if (!sections.length) {
    return emptyState("link", "No links here yet. Your admin can add them.");
  }
  return sections
    .map((section) =>
      groupMarkup(
        section.category,
        section.links.map((link) => linkRow(link, section.category)).join("")
      )
    )
    .join("");
}

function renderFavorites() {
  const sections = buildLinksByCategory(appConfig, currentLo)
    .map((section) => ({
      category: section.category,
      links: section.links.filter((link) => favorites.has(link.id)),
    }))
    .filter((section) => section.links.length);

  if (!sections.length) {
    return emptyState("star", "No favorites yet. Tap the star on any link to pin it here.");
  }

  return sections
    .map((section) =>
      groupMarkup(
        section.category,
        section.links.map((link) => linkRow(link, section.category)).join("")
      )
    )
    .join("");
}

function searchableLinks() {
  const flat = [];
  buildLinksByCategory(appConfig, currentLo).forEach((section) => {
    section.links.forEach((link) => flat.push({ link, category: section.category }));
  });
  return flat;
}

function renderSearchResults() {
  const target = el("search-results");
  if (!target) return;

  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    target.innerHTML = emptyState("search", "Start typing to find a link.");
    return;
  }

  const hits = searchableLinks().filter(
    (entry) =>
      entry.link.label.toLowerCase().includes(query) ||
      entry.category.label.toLowerCase().includes(query)
  );

  if (!hits.length) {
    target.innerHTML = emptyState("search", `No links match "${searchQuery.trim()}".`);
    return;
  }

  target.innerHTML = `
    <section class="group">
      <h2 class="group-title">${hits.length} result${hits.length === 1 ? "" : "s"}</h2>
      <div class="list">
        ${hits.map((entry) => linkRow(entry.link, entry.category, entry.category.label)).join("")}
      </div>
    </section>`;
}

function renderProfile() {
  const photo = currentLo.photo
    ? `<img class="profile-photo" src="${escapeHtml(currentLo.photo)}" alt="${escapeHtml(currentLo.name)}" />`
    : `<div class="profile-photo-fallback">${escapeHtml(initialsOf(currentLo.name))}</div>`;

  const favCount = favorites.size;
  const totalCount =
    (appConfig.genericLinks ? appConfig.genericLinks.length : 0) +
    (currentLo.customLinks ? currentLo.customLinks.length : 0);

  const installRow =
    !isStandalone() && (deferredInstallPrompt || isIOS())
      ? actionRow(
          "profile-install-btn",
          "download",
          "Add to home screen",
          isIOS() ? "Tap Share, then Add to Home Screen" : "Install for one tap access"
        )
      : "";

  return `
    <div class="profile-head">
      ${photo}
      <h2 class="profile-name">${escapeHtml(currentLo.name)}</h2>
      <p class="profile-role">${escapeHtml(currentLo.title || "")}</p>
    </div>

    <section class="group">
      <h2 class="group-title">Your links</h2>
      <div class="list">
        ${statRow("star", `${favCount} favorite${favCount === 1 ? "" : "s"}`, "Starred on this device for one tap access")}
        ${statRow("grid", `${totalCount} links available`, "Company links plus your own")}
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">Settings</h2>
      <div class="list">
        ${installRow}
        ${actionRow("switch-profile-btn", "refresh", "Switch profile", "Load a different loan officer")}
      </div>
    </section>

    <p class="foot-note">${escapeHtml(appConfig.org || "")}<br />Prototype build ${escapeHtml(BUILD)}</p>`;
}

function renderPicker(notice) {
  const los = [...appConfig.los].sort((a, b) => a.name.localeCompare(b.name));

  const main = el("main");
  main.innerHTML = `
    <div class="picker">
      ${notice ? `<p class="note">${escapeHtml(notice)}</p>` : ""}
      <p class="note">This links your phone to your personal shortcuts. You only need to do this once.</p>
      <div class="search-wrap" style="padding-left:0;padding-right:0;padding-top:0;">
        ${icon("search")}
        <input class="search-input" id="lo-search" type="search" placeholder="Search your name" autocomplete="off" />
      </div>
      <div id="lo-list" style="margin-top:14px;"></div>
    </div>`;

  const list = el("lo-list");
  const draw = (filter) => {
    const needle = filter.trim().toLowerCase();
    const matches = los.filter((lo) => lo.name.toLowerCase().includes(needle));
    list.innerHTML = matches.length
      ? `<div class="list">
          ${matches
            .map(
              (lo) => `
            <div class="row">
              <button class="row-inner" type="button" data-slug="${escapeHtml(lo.slug)}">
                <span class="row-icon">${icon("user")}</span>
                <span class="row-body">
                  <span class="row-title">${escapeHtml(lo.name)}</span>
                  ${lo.title ? `<span class="row-sub">${escapeHtml(lo.title)}</span>` : ""}
                </span>
                <span class="row-go">${icon("chevron")}</span>
              </button>
            </div>`
            )
            .join("")}
        </div>`
      : emptyState("search", "No match. Ask your admin to add you.");

    list.querySelectorAll(".row-inner").forEach((btn) => {
      btn.addEventListener("click", () => selectLO(btn.dataset.slug));
    });
  };

  draw("");
  el("lo-search").addEventListener("input", (e) => draw(e.target.value));
}

/* ---------- view plumbing ---------- */

function renderMain() {
  const main = el("main");
  if (currentView === "favorites") {
    main.innerHTML = renderFavorites();
    return;
  }
  if (currentView === "search") {
    main.innerHTML = `<div id="search-results"></div>`;
    renderSearchResults();
    return;
  }
  if (currentView === "profile") {
    main.innerHTML = renderProfile();
    const switchBtn = el("switch-profile-btn");
    if (switchBtn) switchBtn.addEventListener("click", switchProfile);
    const installBtn = el("profile-install-btn");
    if (installBtn) installBtn.addEventListener("click", triggerInstall);
    return;
  }
  main.innerHTML = renderHome();
}

function renderAll() {
  renderIdentity();
  const head = headerFor(currentView);
  el("page-title").textContent = head.title;
  el("page-sub").textContent = head.sub;
  renderTabBar();
  renderDraftNote();
  renderInstallSlot();
  renderTools();
  renderMain();
}

function setView(view) {
  if (view === currentView) return;
  currentView = view;
  searchQuery = "";
  renderAll();
  window.scrollTo(0, 0);
  if (view === "search") {
    const input = el("search-input");
    if (input) input.focus();
  }
}

function selectLO(slug) {
  setLastLoSlug(slug);
  const url = new URL(window.location.href);
  url.searchParams.set("lo", slug);
  window.location.href = url.toString();
}

function switchProfile() {
  const url = new URL(window.location.href);
  url.searchParams.delete("lo");
  localStorage.removeItem(LAST_LO_KEY);
  window.location.href = url.toString();
}

/* ---------- favorites ---------- */

function wireFavoriteToggle() {
  el("main").addEventListener("click", (event) => {
    const btn = event.target.closest(".fav-btn");
    if (!btn || !currentLo) return;
    event.preventDefault();

    const linkId = btn.dataset.linkId;
    const on = toggleFavorite(currentLo.slug, linkId);
    if (on) {
      favorites.add(linkId);
    } else {
      favorites.delete(linkId);
    }

    if (currentView === "favorites") {
      renderMain();
      return;
    }
    // Same link can appear more than once (Home and Search), keep stars in sync.
    document.querySelectorAll(".fav-btn").forEach((other) => {
      if (other.dataset.linkId !== linkId) return;
      other.setAttribute("aria-pressed", on ? "true" : "false");
      other.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
    });
  });
}

/* ---------- install prompt ---------- */

function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => {
    deferredInstallPrompt = null;
    renderInstallSlot();
  });
}

function renderDraftNote() {
  const note = el("draft-note");
  if (!note) return;
  note.innerHTML = isDraftPreview()
    ? `<div class="draft-banner">${icon("search")}<span>Previewing unpublished admin changes. Loan officers still see the published links.</span></div>`
    : "";
}

function renderInstallSlot() {
  const slot = el("install-slot");
  if (!slot) return;

  const hide =
    installDismissed || isStandalone() || !currentLo || currentView !== "home";
  if (hide) {
    slot.innerHTML = "";
    return;
  }

  if (deferredInstallPrompt) {
    slot.innerHTML = `
      <div class="install-card">
        ${icon("download")}
        <p class="install-copy">Install Homespire 360 for one tap access.</p>
        <button class="btn btn-primary" id="install-action" type="button">Install</button>
        <button class="btn btn-quiet" id="install-dismiss" type="button" aria-label="Dismiss">${icon("close")}</button>
      </div>`;
  } else if (isIOS()) {
    slot.innerHTML = `
      <div class="install-card">
        ${icon("share")}
        <p class="install-copy">Add Homespire 360 to your home screen: tap Share, then Add to Home Screen.</p>
        <button class="btn btn-quiet" id="install-dismiss" type="button" aria-label="Dismiss">${icon("close")}</button>
      </div>`;
  } else {
    slot.innerHTML = "";
    return;
  }

  const action = el("install-action");
  if (action) action.addEventListener("click", triggerInstall);
  const dismiss = el("install-dismiss");
  if (dismiss) {
    dismiss.addEventListener("click", () => {
      installDismissed = true;
      renderInstallSlot();
    });
  }
}

/* ---------- boot ---------- */

async function init() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallSlot();
  });

  try {
    appConfig = await loadConfig({ allowDraft: isDraftPreview() });
  } catch (err) {
    el("main").innerHTML = emptyState(
      "close",
      "Could not load your links. Check your connection and reopen the app."
    );
    return;
  }

  let slug = getSlugFromUrl();
  if (!slug) slug = getLastLoSlug();

  const lo = slug ? findLO(appConfig, slug) : null;

  if (slug && !lo) {
    currentLo = null;
    renderIdentity();
    const head = headerFor(currentView);
    el("page-title").textContent = head.title;
    el("page-sub").textContent = head.sub;
    renderTabBar();
    renderTools();
    renderPicker(`We do not recognize "${slug}". Ask your admin, or pick your name below.`);
    return;
  }

  if (lo) {
    currentLo = lo;
    setLastLoSlug(lo.slug);
    favorites = new Set(getFavorites(lo.slug));
    currentView = "home";
    wireFavoriteToggle();
    renderAll();
    el("avatar-btn").addEventListener("click", () => setView("profile"));
    return;
  }

  currentLo = null;
  renderIdentity();
  const head = headerFor(currentView);
  el("page-title").textContent = head.title;
  el("page-sub").textContent = head.sub;
  renderTabBar();
  renderTools();
  renderPicker();
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* offline support is best effort for the prototype */
    });
  });
}

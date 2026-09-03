function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("lo") || "").trim().toLowerCase();
}

function renderHeader(config, lo) {
  document.getElementById("brand-name").textContent = config.appName || "LO Life";
  document.getElementById("org-name").textContent = config.org || "";
  const title = document.getElementById("greeting");
  const subtitle = document.getElementById("subtitle");
  if (lo) {
    title.textContent = `Hi, ${lo.name.split(" ")[0]}`;
    subtitle.textContent = lo.title || "Your shortcuts, all in one place.";
  } else {
    title.textContent = "Welcome";
    subtitle.textContent = "Everything you need at Homespire, in one place.";
  }
}

function renderPicker(config, notice) {
  const main = document.getElementById("main");
  const los = [...config.los].sort((a, b) => a.name.localeCompare(b.name));
  main.innerHTML = `
    <div class="picker">
      ${notice ? `<div class="empty-state" style="padding:0 0 16px;"><p>${notice}</p></div>` : ""}
      <h2>Who are you?</h2>
      <p class="small-note">This links your phone to your personal shortcuts. You'll only need to do this once.</p>
      <input type="search" id="lo-search" placeholder="Search your name..." autocomplete="off" />
      <div class="picker-list" id="lo-list"></div>
    </div>
  `;
  const list = document.getElementById("lo-list");
  const draw = (filter) => {
    const f = filter.trim().toLowerCase();
    const filtered = los.filter((lo) => lo.name.toLowerCase().includes(f));
    list.innerHTML = filtered
      .map(
        (lo) => `
        <button class="picker-item" data-slug="${escapeHtml(lo.slug)}">
          ${escapeHtml(lo.name)}
          <span class="role">${escapeHtml(lo.title || "")}</span>
        </button>`
      )
      .join("") || `<p class="small-note">No match. Ask your admin to add you.</p>`;
    list.querySelectorAll(".picker-item").forEach((btn) => {
      btn.addEventListener("click", () => selectLO(btn.dataset.slug));
    });
  };
  draw("");
  document.getElementById("lo-search").addEventListener("input", (e) => draw(e.target.value));
}

function selectLO(slug) {
  setLastLoSlug(slug);
  const url = new URL(window.location.href);
  url.searchParams.set("lo", slug);
  window.location.href = url.toString();
}

function renderLinks(config, lo) {
  const main = document.getElementById("main");
  const sections = buildLinksByCategory(config, lo);

  main.innerHTML = sections
    .map(
      (section) => `
      <section class="category">
        <h2 class="category-title"><span>${section.category.icon || ""}</span> ${escapeHtml(section.category.label)}</h2>
        ${section.links
          .map(
            (link) => `
          <a class="link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" data-link-id="${escapeHtml(link.id)}">
            <span class="link-icon">${section.category.icon || "🔗"}</span>
            <span class="link-label">${escapeHtml(link.label)}${link.mine ? '<span class="badge-mine">Mine</span>' : ""}</span>
            <span class="link-chevron">›</span>
          </a>`
          )
          .join("")}
      </section>`
    )
    .join("");

  if (lo) {
    const footer = document.createElement("footer");
    footer.className = "hint";
    footer.innerHTML = `Not you? <button class="switch-user" id="switch-user-btn" style="display:inline">Switch profile</button>`;
    main.appendChild(footer);
    document.getElementById("switch-user-btn").addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("lo");
      localStorage.removeItem(LAST_LO_KEY);
      window.location.href = url.toString();
    });
  }
}

function setupInstallBanner() {
  const banner = document.getElementById("install-banner");
  if (isStandalone()) return; // already installed, nothing to do

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.hidden = false;
    banner.querySelector(".install-copy").textContent =
      "Install LO Life on your home screen for one-tap access.";
    banner.querySelector(".install-action").textContent = "Install";
  });

  banner.querySelector(".install-action").addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.hidden = true;
    }
  });

  banner.querySelector(".install-dismiss").addEventListener("click", () => {
    banner.hidden = true;
  });

  if (isIOS()) {
    banner.hidden = false;
    banner.querySelector(".install-copy").textContent =
      "Add LO Life to your home screen: tap Share, then “Add to Home Screen.”";
    banner.querySelector(".install-action").style.display = "none";
  }
}

async function init() {
  setupInstallBanner();

  let config;
  try {
    config = await loadConfig();
  } catch (err) {
    document.getElementById("main").innerHTML =
      `<div class="empty-state"><p>Couldn't load your links right now. Check your connection and reopen the app.</p></div>`;
    return;
  }

  let slug = getSlugFromUrl();
  if (!slug) slug = getLastLoSlug();

  const lo = slug ? findLO(config, slug) : null;

  if (slug && !lo) {
    // Unknown slug in the URL — don't silently fall through, tell them plainly.
    renderHeader(config, null);
    renderPicker(config, `We don't recognize "${escapeHtml(slug)}". Ask your admin, or pick your name below.`);
    return;
  }

  if (lo) setLastLoSlug(lo.slug);

  renderHeader(config, lo);
  if (lo) {
    renderLinks(config, lo);
  } else {
    renderPicker(config);
  }
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* offline support is best-effort for the prototype */
    });
  });
}

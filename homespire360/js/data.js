/**
 * Homespire 360 shared data layer.
 *
 * Prototype storage model: a single config.json file is the source of truth,
 * checked into this deployed site. The admin screen edits a *working copy* in
 * localStorage (so edits don't vanish on refresh) and lets you export the
 * merged result back to data/config.json for redeploy. There is no live
 * backend, which is a deliberate MVP choice. See README.md.
 */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const CONFIG_URL = "data/config.json";
const LOCAL_DRAFT_KEY = "lolife_config_draft_v1";
const LAST_LO_KEY = "lolife_last_lo";
const FAVORITES_KEY_PREFIX = "lolife_favorites_";

/* Shown in the Profile footer. Bump with the service worker cache version so a
   phone can be identified as stale by looking at it. */
const BUILD = "v13";

/**
 * Fetch the published config.
 *
 * The admin screen keeps an unpublished working copy in localStorage. That
 * draft is admin state, not app state: the LO view used to prefer it whenever
 * one existed, which meant anyone who had ever opened the admin got a
 * permanently frozen view of the app, showing whatever the data looked like
 * when they last edited, with nothing on screen to explain why. So the draft
 * is now opt in. The admin passes allowDraft, and the app only passes it when
 * ?draft is in the URL, in which case it says so on screen.
 */
async function loadConfig({ allowDraft = false } = {}) {
  const draft = allowDraft ? readDraft() : null;
  try {
    const res = await fetch(CONFIG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("config fetch failed: " + res.status);
    const published = await res.json();
    return draft || published;
  } catch (err) {
    if (draft) return draft;
    throw err;
  }
}

/** True when the app was opened to preview the admin's unpublished draft. */
function isDraftPreview() {
  return new URLSearchParams(window.location.search).has("draft") && Boolean(readDraft());
}

function readDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(config) {
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(config, null, 2));
}

function clearDraft() {
  localStorage.removeItem(LOCAL_DRAFT_KEY);
}

function getLastLoSlug() {
  return localStorage.getItem(LAST_LO_KEY) || "";
}

function setLastLoSlug(slug) {
  localStorage.setItem(LAST_LO_KEY, slug);
}

/**
 * Favorites are per device and per LO, kept in localStorage rather than in
 * config.json: they are the LO's own choice, not something an admin sets.
 * Link ids only need to be unique within one LO, which they are.
 */
function favoritesKey(slug) {
  return `${FAVORITES_KEY_PREFIX}${slug}`;
}

function getFavorites(slug) {
  if (!slug) return [];
  try {
    const raw = localStorage.getItem(favoritesKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Flips the favorite state for one link and returns the new state. */
function toggleFavorite(slug, linkId) {
  const current = getFavorites(slug);
  const on = !current.includes(linkId);
  const next = on ? [...current, linkId] : current.filter((id) => id !== linkId);
  try {
    localStorage.setItem(favoritesKey(slug), JSON.stringify(next));
  } catch {
    /* private mode or full storage, keep the in-memory state anyway */
  }
  return on;
}

/** A link is only real once it has somewhere to go. */
function hasUrl(link) {
  const url = (link.url || "").trim();
  return url !== "" && url !== "https://" && url !== "http://";
}

function findLO(config, slug) {
  return config.los.find((lo) => lo.slug === slug) || null;
}

function categoriesById(config) {
  const map = {};
  config.categories.forEach((c) => (map[c.id] = c));
  return map;
}

/**
 * Merge generic links + this LO's custom links, grouped by category,
 * sorted by category order then link order. Custom links are flagged
 * mine:true, which the admin screen uses. The LO view no longer badges it.
 */
function buildLinksByCategory(config, lo) {
  const cats = categoriesById(config);
  const grouped = {};

  const push = (link, mine) => {
    const cat = cats[link.categoryId];
    if (!cat) return; // orphaned categoryId, skip rather than crash
    /* A new LO starts with the whole template of rows and no URLs yet. Those
       are a to-do list for the admin, not links: showing them would give the
       LO rows that go nowhere while their setup is half done. */
    if (!hasUrl(link)) return;
    if (!grouped[cat.id]) grouped[cat.id] = { category: cat, links: [] };
    grouped[cat.id].links.push({ ...link, mine });
  };

  config.genericLinks.forEach((l) => push(l, false));
  if (lo) lo.customLinks.forEach((l) => push(l, true));

  const sections = Object.values(grouped).sort(
    (a, b) => a.category.order - b.category.order
  );
  sections.forEach((s) => s.links.sort((a, b) => (a.order || 0) - (b.order || 0)));
  return sections;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * LO Life — shared data layer.
 *
 * Prototype storage model: a single config.json file is the source of truth,
 * checked into this deployed site. The admin screen edits a *working copy* in
 * localStorage (so edits don't vanish on refresh) and lets you export the
 * merged result back to data/config.json for redeploy. There is no live
 * backend — that's a deliberate MVP choice, see README.md.
 */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const CONFIG_URL = "data/config.json";
const LOCAL_DRAFT_KEY = "lolife_config_draft_v1";
const LAST_LO_KEY = "lolife_last_lo";

/** Fetch the published config, falling back to a local admin draft if newer edits exist. */
async function loadConfig() {
  const draft = readDraft();
  try {
    const res = await fetch(CONFIG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("config fetch failed: " + res.status);
    const published = await res.json();
    // If an admin draft exists locally, prefer it (this device is mid-edit / testing an unpublished change).
    return draft || published;
  } catch (err) {
    if (draft) return draft;
    throw err;
  }
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
 * mine:true so the UI can badge them.
 */
function buildLinksByCategory(config, lo) {
  const cats = categoriesById(config);
  const grouped = {};

  const push = (link, mine) => {
    const cat = cats[link.categoryId];
    if (!cat) return; // orphaned categoryId — skip rather than crash
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

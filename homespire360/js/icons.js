/**
 * Homespire 360 icon set.
 *
 * Line icons only, no emoji anywhere in the product. Every glyph is drawn on
 * the same 24x24 stroke grid so sizes and weights stay consistent whether an
 * icon renders in the tab bar, a list row, a chip, or the admin screen.
 *
 * Category icons are stored in config.json by NAME (e.g. "briefcase"), not as
 * a character, so the admin screen can offer a picker instead of an emoji
 * field. LEGACY_ICON_ALIASES keeps older saved drafts rendering correctly.
 */

const ICON_PATHS = {
  // Navigation
  home: '<path d="M3 9.6 12 3l9 6.6V20a1 1 0 0 1-1 1h-5.2v-6.6H9.2V21H4a1 1 0 0 1-1-1z"/>',
  bookmark: '<path d="M18 21l-6-4.4L6 21V5.2A2.2 2.2 0 0 1 8.2 3h7.6A2.2 2.2 0 0 1 18 5.2z"/>',
  search: '<circle cx="11" cy="11" r="7.4"/><path d="M20.5 20.5 16.3 16.3"/>',
  user: '<circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.8a7.4 7.4 0 0 1 14.8 0"/>',

  // Categories
  briefcase:
    '<rect x="2.6" y="7.4" width="18.8" height="12.8" rx="2.6"/><path d="M8.6 7.4V5.9A1.9 1.9 0 0 1 10.5 4h3A1.9 1.9 0 0 1 15.4 5.9v1.5"/><path d="M2.6 12.4h18.8"/>',
  fileText:
    '<path d="M13.8 3H7.2A2.2 2.2 0 0 0 5 5.2v13.6A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2V8.4z"/><path d="M13.8 3v5.4h5.2"/><path d="M9 13.2h6"/><path d="M9 16.8h4"/>',
  clipboard:
    '<path d="M9.2 4.4H7.2A2.2 2.2 0 0 0 5 6.6v12.2A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2V6.6a2.2 2.2 0 0 0-2.2-2.2h-2"/><rect x="9.2" y="2.6" width="5.6" height="3.6" rx="1.2"/><path d="M9 12.4h6"/><path d="M9 16h4"/>',
  megaphone:
    '<path d="M4.4 10.4 20 5.4v13.2L4.4 13.6z"/><path d="M4.4 10.4H3.4A1.4 1.4 0 0 0 2 11.8v.4a1.4 1.4 0 0 0 1.4 1.4h1"/><path d="M8.4 12.7v6.1a1.6 1.6 0 0 0 3.2 0v-5.1"/>',
  building:
    '<rect x="4.2" y="3" width="15.6" height="18" rx="2.2"/><path d="M9.6 21v-4.4h4.8V21"/><path d="M8.6 7.4h1.6M13.8 7.4h1.6M8.6 11.4h1.6M13.8 11.4h1.6"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z"/>',
  banknote:
    '<rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.4"/><circle cx="12" cy="12" r="2.4"/><path d="M6.2 12h.02M17.8 12h.02"/>',
  link:
    '<path d="M9.6 14.4a4.4 4.4 0 0 0 6.2 0l2.9-2.9a4.4 4.4 0 0 0-6.2-6.2l-1.3 1.3"/><path d="M14.4 9.6a4.4 4.4 0 0 0-6.2 0l-2.9 2.9a4.4 4.4 0 0 0 6.2 6.2l1.3-1.3"/>',
  users:
    '<circle cx="9.2" cy="8.4" r="3.4"/><path d="M2.8 20.4a6.4 6.4 0 0 1 12.8 0"/><path d="M16.2 5.6a3.4 3.4 0 0 1 0 5.6"/><path d="M17.6 14.6a6.4 6.4 0 0 1 3.6 5"/>',
  calendar:
    '<rect x="3.4" y="5.6" width="17.2" height="15" rx="2.4"/><path d="M3.4 10.2h17.2"/><path d="M8.2 3.4v3.2M15.8 3.4v3.2"/>',
  chart: '<path d="M4.4 20.4V10.6"/><path d="M10.8 20.4V4.2"/><path d="M17.2 20.4v-7.2"/><path d="M3 20.4h18"/>',
  phone:
    '<path d="M7 3.6h2.8l1.5 3.9-2 1.5a11.3 11.3 0 0 0 5.2 5.2l1.5-2 3.9 1.5V17a2.6 2.6 0 0 1-2.9 2.6C9.6 18.7 5.3 14.4 4.4 6.5A2.6 2.6 0 0 1 7 3.6z"/>',
  mail: '<rect x="3" y="5.6" width="18" height="12.8" rx="2.4"/><path d="M3.9 7.2 12 13l8.1-5.8"/>',
  image:
    '<rect x="3.4" y="5" width="17.2" height="14" rx="2.4"/><circle cx="9" cy="10.2" r="1.7"/><path d="M5 17.4l4.4-3.9 3.4 2.9 3-2.5 3.4 2.9"/>',
  grid:
    '<rect x="3.4" y="3.4" width="7" height="7" rx="2"/><rect x="13.6" y="3.4" width="7" height="7" rx="2"/><rect x="3.4" y="13.6" width="7" height="7" rx="2"/><rect x="13.6" y="13.6" width="7" height="7" rx="2"/>',
  shield: '<path d="M12 3.4l7 2.5v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V5.9z"/>',

  // UI affordances
  external:
    '<path d="M18 13.6V18.8A2.2 2.2 0 0 1 15.8 21H5.2A2.2 2.2 0 0 1 3 18.8V8.2A2.2 2.2 0 0 1 5.2 6h5.2"/><path d="M15 3h6v6"/><path d="M21 3l-8.4 8.4"/>',
  chevron: '<path d="M9.6 5.6 16 12l-6.4 6.4"/>',
  download:
    '<path d="M12 3.4v11.2"/><path d="M7.6 10.4 12 14.8l4.4-4.4"/><path d="M4 17.6v1A2.4 2.4 0 0 0 6.4 21h11.2a2.4 2.4 0 0 0 2.4-2.4v-1"/>',
  share:
    '<path d="M12 15.6V3.4"/><path d="M8 7.4 12 3.4l4 4"/><path d="M5 12.2v6.4A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4v-6.4"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  refresh: '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.4 3.6v4.8h-4.8"/>',
  trash:
    '<path d="M4 7.2h16"/><path d="M9.6 7.2V5.6A1.6 1.6 0 0 1 11.2 4h1.6a1.6 1.6 0 0 1 1.6 1.6v1.6"/><path d="M6.6 7.2l.8 11.9A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9l.8-11.9"/><path d="M10.6 11.2v6M13.4 11.2v6"/>',
  plus: '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/>',
  copy:
    '<rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M15 6.2V5.4A2.4 2.4 0 0 0 12.6 3H5.4A2.4 2.4 0 0 0 3 5.4v7.2A2.4 2.4 0 0 0 5.4 15h.8"/>',
  check: '<path d="M4.8 12.6 9.6 17.4 19.2 6.6"/>',
};

/** Older saved drafts stored emoji in config.icon. Map them to real icons. */
const LEGACY_ICON_ALIASES = {
  "\u{1F4BC}": "briefcase",
  "\u{1F9FE}": "fileText",
  "\u{1F4CB}": "clipboard",
  "\u{1F4E3}": "megaphone",
  "\u{1F517}": "link",
  "\u2B50": "star",
  "\u{1F4B0}": "banknote",
  "\u{1F3E0}": "home",
  "\u{1F464}": "user",
  "\u{1F9EA}": "users",
};

/** Icons offered in the admin category picker, in menu order. */
const ICON_CHOICES = [
  { name: "briefcase", label: "Briefcase" },
  { name: "fileText", label: "Document" },
  { name: "clipboard", label: "Clipboard" },
  { name: "megaphone", label: "Megaphone" },
  { name: "building", label: "Building" },
  { name: "star", label: "Star" },
  { name: "banknote", label: "Banknote" },
  { name: "link", label: "Link" },
  { name: "users", label: "People" },
  { name: "calendar", label: "Calendar" },
  { name: "chart", label: "Chart" },
  { name: "phone", label: "Phone" },
  { name: "mail", label: "Mail" },
  { name: "image", label: "Image" },
  { name: "grid", label: "Grid" },
  { name: "shield", label: "Shield" },
  { name: "home", label: "Home" },
  { name: "bookmark", label: "Bookmark" },
];

function resolveIconName(raw) {
  const key = (raw || "").trim();
  if (ICON_PATHS[key]) return key;
  if (LEGACY_ICON_ALIASES[key]) return LEGACY_ICON_ALIASES[key];
  return "link";
}

function icon(name, extraClass) {
  const paths = ICON_PATHS[name] || ICON_PATHS.link;
  const cls = extraClass ? `icon ${extraClass}` : "icon";
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

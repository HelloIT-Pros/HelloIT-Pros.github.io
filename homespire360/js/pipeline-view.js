/**
 * My Pipeline, loan detail, and the pre-approval letter.
 *
 * These three are one feature with a list in front of it: the pipeline row is
 * the loan object the letter consumes. They live in a sheet stack of their own
 * rather than as new tabs, so the four-tab shell is untouched and this whole
 * feature can be removed by deleting one file and one row.
 *
 * Nothing here ever uploads. The pipeline is imported on the device and stays
 * in that browser. See js/pipeline.js for why.
 */

/* ---------- state ---------- */

let pipelineData = null; // { loans, importedAt, fileName, officers }
let pipelineFilter = "all";
let openLoan = null;

/* The letter being edited, plus the preview built from it. previewFile is the
   exact File that Send attaches: the guarantee is that what was approved on
   screen is what leaves the phone, so any edit must throw it away. */
let letterValues = null;
let previewFile = null;
let previewUrl = null;
let previewStale = true;
/* Which period the funded tiles are showing. Month by default on every
   launch, per the product decision, so a flip is never a sticky surprise. */
let fundedPeriod = "month";
/* Which team members the send icons will reach, and the subject they carry.
   Rebuilt every time a loan detail is rendered. */
let teamSelected = new Set();
let teamSubject = "";

const pipeEl = () => document.getElementById("pipeline-sheet");

/* ---------- formatting ---------- */

const pMoney = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const pCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return pMoney(v);
};

const pShortDate = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

const pLongDate = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

const pInitials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------- the row that opens all this ---------- */

function pipelineRowMarkup() {
  const loans = myLoans();
  /* An LO who is not in the sample has no loans to summarise, and "0 sample
     loans" reads as a broken screen rather than as an empty one. Say the same
     thing as having no pipeline at all, because that is the situation. */
  const sub = !pipelineData || !loans.length
    ? "Import your pipeline to see it here"
    : pipelineData.sample
    ? `${loans.length} sample loan${loans.length === 1 ? "" : "s"}, tap to use your own`
    : `${loans.length} loan${loans.length === 1 ? "" : "s"} from the ${pShortDate(
        pipelineData.importedAt.slice(0, 10)
      )} import`;
  return `
    <div class="row">
      <button class="row-inner has-trailing" type="button" id="open-pipeline-btn">
        <span class="row-icon">${icon("chart")}</span>
        <span class="row-body">
          <span class="row-title">My Pipeline</span>
          <span class="row-sub">${escapeHtml(sub)}</span>
        </span>
        <span class="row-go">${icon("chevron")}</span>
      </button>
    </div>`;
}

/**
 * The four numbers, on Home, above everything else.
 *
 * The two pipeline tiles open My Pipeline, which is the screen they summarise.
 *
 * The two funded tiles are different. They carry two periods, month to date on
 * the front and year to date on the back, and tapping either one flips both so
 * the pair never shows one period for units and another for volume. Both faces
 * are rendered up front and the flip is a class on the grid, so the animation
 * is not interrupted by a re-render and the chosen period survives a category
 * chip changing the view.
 */
function pipelineTilesMarkup() {
  if (!pipelineData || !currentLo) return "";
  const loans = myLoans();
  if (!loans.length) return "";

  /* Prospects are leads, not production. They are excluded from both numbers
     and named underneath, so the count is honest and the leads are not hidden. */
  const active = loans.filter(isActivePipeline);
  const prospects = loans.filter(isProspect);
  const sum = (list) => list.reduce((n, l) => n + (l.loanAmount || 0), 0);
  const totals = fundedTotals(loans);
  const prospectNote = prospects.length ? `${prospects.length} in prospects` : "";

  /* The two pipeline tiles open My Pipeline. They summarise that screen, so
     tapping the summary going to the thing it summarises is the one behaviour
     nobody has to be taught. The funded pair does not navigate, because tapping
     those turns them over. */
  const tile = (label, value, note, lead, extra) => `
    <button type="button" class="tile${lead ? " lead" : ""}" data-open-pipeline
      aria-label="${escapeHtml(label)}, ${escapeHtml(value)} ${escapeHtml(note)}${extra ? `, ${escapeHtml(extra)}` : ""}. Open My Pipeline.">
      <span class="tile-label">${escapeHtml(label)}</span>
      <span class="tile-value">${escapeHtml(value)}</span>
      <span class="tile-note">${escapeHtml(note)}</span>
      ${extra ? `<span class="tile-extra">${escapeHtml(extra)}</span>` : ""}
    </button>`;

  /* Not an emoji and not a spinner: two arrows turning, which is the only thing
     at this size that reads as "this card has another side". */
  const FLIP_GLYPH = `
    <svg class="flip-mark" viewBox="0 0 24 24" width="13" height="13" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10a7 7 0 0 1 12-4l3 3" /><path d="M18 4v5h-5" />
      <path d="M21 14a7 7 0 0 1-12 4l-3-3" /><path d="M6 20v-5h5" />
    </svg>`;

  /* The mark lives inside each face rather than on the button. On the button it
     rotates with the card and lands mirrored on the opposite corner; inside a
     face it is hidden with that face and sits correctly on both sides. */
  const face = (label, value, period, back) => `
    <span class="flip-face${back ? " flip-back" : ""}" aria-hidden="${back ? "true" : "false"}">
      ${FLIP_GLYPH}
      <span class="tile-label">${escapeHtml(label)}</span>
      <span class="tile-value">${escapeHtml(value)}</span>
      <span class="tile-note">${escapeHtml(period)}</span>
    </span>`;

  /* One button, two faces. Each face states its own period on the note line, so
     a number is never on screen without the period attached to it. The period
     sits there rather than in the label because "FUNDED VOLUME (MONTH)" wraps
     to two lines at phone width, which pushed the two values out of alignment. */
  const flipTile = (name, monthValue, yearValue) => `
    <button type="button" class="tile tile-flip" data-flip
      aria-label="${escapeHtml(name)}. Showing ${fundedPeriod === "year" ? "year" : "month"} to date. Tap to show the ${fundedPeriod === "year" ? "month" : "year"}.">
      ${face(name, monthValue, "month to date", false)}
      ${face(name, yearValue, "year to date", true)}
    </button>`;

  return `
    <div class="tile-head">
      <span>My production</span>
      ${pipelineData.sample ? `<span class="tile-sample">Sample</span>` : ""}
    </div>
    <div class="tile-grid${fundedPeriod === "year" ? " is-flipped" : ""}">
      ${tile("In pipeline", String(active.length), active.length === 1 ? "loan" : "loans", true, prospectNote)}
      ${tile("Pipeline volume", pCompact(sum(active)), "in process", true, prospects.length ? pCompact(sum(prospects)) + " in prospects" : "")}
      ${flipTile("Funded units", String(totals.month.units), String(totals.year.units))}
      ${flipTile("Funded volume", pCompact(totals.month.volume), pCompact(totals.year.volume))}
    </div>`;
}

function myLoans() {
  if (!pipelineData || !currentLo) return [];
  return loansForLo(pipelineData.loans, currentLo);
}

/* A demo that cannot be told from real data is how a fabricated number ends up
   quoted in a real meeting. The sample says so on every screen it reaches. */
function sampleBanner() {
  if (!pipelineData) return "";
  if (pipelineData.sample) {
    return `<p class="sample-banner">${icon("shield")}<span>Sample data. Not real loans.</span></p>`;
  }
  /* The opposite warning, and just as important. A local build carries real
     borrower data, and whoever is holding the phone should know that before
     they hand it to anyone. */
  if (pipelineData.local) {
    return `<p class="sample-banner is-real">${icon("shield")}<span>Real borrower data. Local build, nothing uploaded.</span></p>`;
  }
  return "";
}

/**
 * The borrower's own contact details, when the export carries them.
 *
 * One row, two actions, no expanding: reaching the borrower is the most common
 * thing an LO does from a loan, so it does not deserve a disclosure triangle.
 * Both are plain links that hand off to the phone's dialler and mail app.
 */
function borrowerStripMarkup(loan) {
  const phone = pDigits(loan.borrowerPhone);
  const email = String(loan.borrowerEmail || "").trim();
  if (!phone && !email) return "";
  const subject = encodeURIComponent(
    `${loan.borrowerName}${loan.loanNumber ? ` (loan ${loan.loanNumber})` : ""}`
  );
  return `
    <div class="borrower-strip">
      <span class="borrower-who">
        <span class="borrower-label">Borrower</span>
        <span class="borrower-name">${escapeHtml(loan.borrowerName)}</span>
      </span>
      <span class="borrower-acts">
        ${phone ? `<a class="borrower-act" href="tel:${escapeHtml(phone)}" aria-label="Call ${escapeHtml(loan.borrowerName)}">${icon("phone")}</a>` : ""}
        ${phone ? `<a class="borrower-act" href="sms:${escapeHtml(phone)}" aria-label="Text ${escapeHtml(loan.borrowerName)}">${icon("message")}</a>` : ""}
        ${email ? `<a class="borrower-act" href="mailto:${escapeHtml(email)}?subject=${subject}" aria-label="Email ${escapeHtml(loan.borrowerName)}">${icon("mail")}</a>` : ""}
      </span>
    </div>`;
}

/* ---------- who else is on the file ---------- */

/** Digits only. tel: and sms: choke on parentheses and spaces. */
const pDigits = (v) => String(v || "").replace(/[^0-9+]/g, "");

/**
 * The file team: small avatars under the loan header that expand into contact
 * rows.
 *
 * Deliberately quiet. The LO came to this screen for the loan, not the roster,
 * so collapsed this is one line of initials and a word. It only earns space
 * once tapped.
 *
 * The two group actions open a compose window addressed to everyone on the
 * file. They do not send anything: the mail or messages app opens with the
 * recipients and a subject filled in, and the LO writes and sends it herself.
 */
function teamStripMarkup(team, loan) {
  if (!team.length) return "";

  const subject = encodeURIComponent(
    `${loan.borrowerName}${loan.loanNumber ? ` (loan ${loan.loanNumber})` : ""}`
  );

  /* Everyone starts selected, so reaching the whole file is still one tap and
     selection is only work when you actually want a subset. */
  teamSelected = new Set(team.map((_, i) => i));
  teamSubject = subject;

  /* Calling is the one action that cannot be done as a group, so it stays on
     the person. Email and text are group actions and live at the bottom, which
     also stops the same mail icon appearing twice on one row. */
  const person = (m, i) => `
    <li class="team-person">
      <label class="team-pick">
        <input type="checkbox" data-team-pick="${i}" checked
          aria-label="Include ${escapeHtml(m.name)}" />
        <span class="team-box" aria-hidden="true">${icon("check")}</span>
      </label>
      <span class="team-avatar" aria-hidden="true">${escapeHtml(pInitials(m.name))}</span>
      <span class="team-who">
        <span class="team-name">${escapeHtml(m.name)}</span>
        <span class="team-role">${escapeHtml(m.role)}${m.email || m.phone ? "" : " · no contact details"}</span>
      </span>
      ${
        m.phone
          ? `<a class="team-act" href="tel:${escapeHtml(pDigits(m.phone))}" aria-label="Call ${escapeHtml(m.name)}">${icon("phone")}</a>`
          : ""
      }
    </li>`;

  const reachable = team.some((m) => m.email || m.phone);

  const actions = reachable
    ? `<div class="team-send-bar">
        <span class="team-count" data-team-count aria-live="polite"></span>
        <a class="team-send" data-team-mail aria-label="Email the selected team members">${icon("mail")}</a>
        <a class="team-send" data-team-sms aria-label="Text the selected team members">${icon("message")}</a>
      </div>`
    : `<p class="team-none">No contact details on file for this loan yet.</p>`;

  return `
    <div class="team-strip">
      <button class="team-toggle" type="button" data-team aria-expanded="false" aria-controls="team-panel">
        <span class="team-avatars">
          ${team.map((m) => `<span class="team-avatar sm" aria-hidden="true">${escapeHtml(pInitials(m.name))}</span>`).join("")}
        </span>
        <span class="team-label">Team members</span>
        <span class="team-chevron">${icon("chevron")}</span>
      </button>
      <div class="team-panel" id="team-panel" hidden>
        <ul class="team-list">${team.map(person).join("")}</ul>
        ${actions}
      </div>
    </div>`;
}

/**
 * Point the two send icons at whoever is currently ticked.
 *
 * The icons are anchors so the phone treats them as links, which is what makes
 * the handoff to Mail and Messages reliable. When a channel has nobody to reach,
 * the href is removed rather than pointing somewhere useless, and the icon is
 * marked disabled: a mail button that opens an empty compose window is worse
 * than one that is visibly unavailable.
 */
function syncTeamSend() {
  const sheet = pipeEl();
  if (!sheet || !openLoan) return;
  const team = teamForLoan(openLoan, appConfig && appConfig.team);
  const picked = team.filter((_, i) => teamSelected.has(i));

  const emails = picked.map((m) => m.email).filter(Boolean);
  const phones = picked.map((m) => pDigits(m.phone)).filter(Boolean);

  const countEl = sheet.querySelector("[data-team-count]");
  if (countEl) {
    countEl.textContent = picked.length
      ? `${picked.length} of ${team.length} selected`
      : "Nobody selected";
  }

  const set = (el, href) => {
    if (!el) return;
    if (href) {
      el.setAttribute("href", href);
      el.removeAttribute("aria-disabled");
    } else {
      el.removeAttribute("href");
      el.setAttribute("aria-disabled", "true");
    }
  };
  set(sheet.querySelector("[data-team-mail]"),
    emails.length ? `mailto:${emails.join(",")}?subject=${teamSubject}` : "");
  set(sheet.querySelector("[data-team-sms]"),
    phones.length ? `sms:${phones.join(",")}` : "");
}

/* ---------- sheet plumbing ---------- */

function openSheet(html) {
  const sheet = pipeEl();
  sheet.innerHTML = html;
  sheet.hidden = false;
  document.body.classList.add("sheet-open");
  sheet.scrollTop = 0;
}

function closeSheet() {
  const sheet = pipeEl();
  sheet.hidden = true;
  sheet.innerHTML = "";
  document.body.classList.remove("sheet-open");
  dropPreview();
  openLoan = null;
  letterValues = null;
}

function sheetHeader(title, sub, backLabel) {
  return `
    <div class="sheet-bar">
      <button class="sheet-back" type="button" data-back="1">${icon("chevron", "flip")}<span>${escapeHtml(backLabel)}</span></button>
      <button class="sheet-close" type="button" data-close="1" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="sheet-head">
      <h2>${escapeHtml(title)}</h2>
      ${sub ? `<p class="sheet-sub">${escapeHtml(sub)}</p>` : ""}
    </div>`;
}

/* ---------- screen 1: the pipeline ---------- */

function openPipeline() {
  if (!pipelineData) return renderImportScreen();
  renderPipelineList();
}

function renderImportScreen() {
  openSheet(`
    ${sheetHeader("My Pipeline", "", "Close")}
    <div class="sheet-body">
      <div class="import-box">
        <p class="import-lead">No pipeline on this device yet.</p>
        <p class="import-note">
          Choose the pipeline export and it is read here on your phone. It is not
          uploaded and it does not leave this device. To refresh it later, import
          a newer file.
        </p>
        <p class="import-note">
          On an iPhone the file lives under Browse in the Files app, including
          anything synced from OneDrive.
        </p>
        <label class="btn btn-primary import-btn">
          ${icon("download")}<span>Choose a CSV file</span>
          <!-- iOS matches the accept list against the file's UTI, and a CSV
               arriving through OneDrive or Mail often reports as plain text or
               nothing at all. A narrow accept list greys the file out in the
               picker with no explanation, so this stays deliberately wide. -->
          <input type="file" id="pipeline-file"
                 accept=".csv,.txt,text/csv,text/plain,text/comma-separated-values,application/csv,application/vnd.ms-excel"
                 hidden />
        </label>
        <p class="import-problems" id="import-problems" hidden></p>
      </div>
    </div>`);
}

function renderPipelineList() {
  const loans = sortForPipeline(myLoans());
  const stats = pipelineStats(loans);
  const monthFunded = fundedTotals(loans).month;

  /* Folder first, because that is the distinction that changes what a number
     means. Milestone filters follow, and only where they have members. */
  const counts = {
    all: loans.length,
    active: loans.filter(isActivePipeline).length,
    prospects: loans.filter(isProspect).length,
    soon: loans.filter((l) => isActivePipeline(l) && daysUntil(l.estClosingDate) <= 14).length,
    approval: loans.filter((l) => isActivePipeline(l) && l.milestone === "Approval").length,
    funded: stats.funded,
  };
  const chip = (id, label) =>
    counts[id]
      ? `<button class="chip" type="button" data-filter="${id}" aria-pressed="${pipelineFilter === id}">${label} ${counts[id]}</button>`
      : "";

  const shown = loans.filter((l) => {
    if (pipelineFilter === "all") return true;
    if (pipelineFilter === "prospects") return isProspect(l);
    if (pipelineFilter === "funded") return isFunded(l) && !isProspect(l);
    if (pipelineFilter === "active") return isActivePipeline(l);
    if (!isActivePipeline(l)) return false;
    if (pipelineFilter === "soon") return daysUntil(l.estClosingDate) <= 14;
    return l.milestone === "Approval";
  });

  openSheet(`
    ${sheetHeader("My Pipeline", "", "Close")}
    ${sampleBanner()}
    <div class="stat-pair">
      <div class="stat-card lead">
        <div class="stat-label">In process</div>
        <div class="stat-value">${pCompact(stats.activeVolume)}</div>
        <div class="stat-note">${stats.active} loan${stats.active === 1 ? "" : "s"}</div>
      </div>
      ${
        stats.prospects
          ? /* When the export is mostly leads, the second card is far more
               useful as the lead count than as a funded figure this export
               does not carry. */
            `<div class="stat-card">
              <div class="stat-label">Prospects</div>
              <div class="stat-value">${pCompact(stats.prospectVolume)}</div>
              <div class="stat-note">${stats.prospects} lead${stats.prospects === 1 ? "" : "s"}</div>
            </div>`
          : `<div class="stat-card">
              <div class="stat-label">Funded this month</div>
              <div class="stat-value">${pCompact(monthFunded.volume)}</div>
              <div class="stat-note">${monthFunded.units} loan${monthFunded.units === 1 ? "" : "s"}</div>
            </div>`
      }
    </div>
    <div class="chip-row">${chip("all", "All")}${chip("active", "Active")}${chip("prospects", "Prospects")}${chip("soon", "Closing soon")}${chip("approval", "Approval")}${chip("funded", "Funded")}</div>
    <div class="sheet-body">
      ${
        shown.length
          ? `<div class="list">${shown.map(loanRowMarkup).join("")}</div>`
          : emptyState("chart", "No loans match this filter.")
      }
      <p class="import-footer">
        ${
          pipelineData.sample
            ? "Sample data that ships with the app. No real loan is in it."
            : escapeHtml(
                `${pipelineData.loans.length} loans on this device from ${pipelineData.fileName || "an import"}, ${pLongDate(pipelineData.importedAt.slice(0, 10))}.`
              )
        }
        <button class="linky" type="button" data-reimport="1">${pipelineData.sample ? "Import your pipeline" : "Import a newer file"}</button>
        ${pipelineData.sample ? "" : `<button class="linky danger" type="button" data-forget="1">Remove from this device</button>`}
      </p>
    </div>`);
}

function whenPill(loan) {
  if (isFunded(loan)) return `<span class="pill pill-funded">Funded ${pShortDate(loan.fundsReleased)}</span>`;
  const d = daysUntil(loan.estClosingDate);
  if (d === null) return "";
  const days = (n) => `${n} day${n === 1 ? "" : "s"}`;
  if (d < 0) return `<span class="pill pill-soon">${days(Math.abs(d))} overdue</span>`;
  if (d === 0) return `<span class="pill pill-soon">Closes today</span>`;
  if (d <= 7) return `<span class="pill pill-soon">in ${days(d)}</span>`;
  return `<span class="pill pill-when">in ${days(d)}</span>`;
}

function milestonePill(loan) {
  if (isFunded(loan)) return "";
  const cls =
    loan.milestone === "Started" ? "pill-started" : loan.milestone === "Approval" ? "pill-approval" : "";
  return `<span class="pill ${cls}">${escapeHtml(loan.milestone || "In process")}</span>`;
}

function loanRowMarkup(loan) {
  return `
    <button class="loan-row" type="button" data-loan="${escapeHtml(loan.loanNumber)}">
      <span class="initials">${escapeHtml(pInitials(loan.borrowerName))}</span>
      <span class="loan-main">
        <span class="loan-top">
          <span class="loan-name">${escapeHtml(loan.borrowerName)}</span>
          <span class="loan-amount">${pMoney(loan.loanAmount)}</span>
        </span>
        <span class="loan-meta">${milestonePill(loan)}${whenPill(loan)}</span>
        <span class="loan-sub">${escapeHtml(loan.loanType || loan.loanPurpose || "")} &middot; est. ${escapeHtml(pShortDate(loan.estClosingDate))}</span>
      </span>
      <span class="row-go">${icon("chevron")}</span>
    </button>`;
}

/* ---------- screen 2: one loan ---------- */

function renderLoanDetail(loan) {
  openLoan = loan;
  const equity = loanEquity(loan);
  const team = teamForLoan(loan, appConfig && appConfig.team);

  /* Only rows the export actually filled. A detail screen full of blanks
     teaches an LO that the app does not know anything. */
  /*
   * Purchase price is always on this screen, even when there is no value.
   *
   * It used to be dropped along with every other empty row, and the result was
   * that a loan with no price looked like a screen that had forgotten to show
   * it. So the row is always rendered and it says why it is empty: not
   * applicable on a refinance, and not on file yet on a purchase, since the
   * export does not carry the column. The third element marks a value as a
   * status rather than data, so it can be styled as one.
   */
  const isRefi = /refinance/i.test(loan.loanPurpose || "");
  const priceRow = equity
    ? [pMoney(equity.price), false]
    : isRefi
    ? ["Not applicable on a refinance", true]
    : [Number(loan.purchasePrice) > 0 ? "Check the loan amount" : "Not on file yet", true];

  const facts = [
    ["Loan number", loan.loanNumber],
    ["Folder", loan.folder],
    ["Milestone", loan.milestone],
    ["Purpose", loan.loanPurpose],
    ["Loan type", loan.loanType],
    ["Loan amount", loan.loanAmount ? pMoney(loan.loanAmount) : ""],
    ["Purchase price", priceRow[0], priceRow[1]],
    /* Derived, so it appears only when there is something to derive it from.
       A second placeholder row saying the same thing twice is noise. */
    ["Down payment", equity ? pMoney(equity.downPayment) + (equity.derivedDown ? " (calculated)" : "") : ""],
    ["Property", loan.propertyAddress],
    ["Application taken", pLongDate(loan.applicationDate)],
    ["File started", pLongDate(loan.fileStarted)],
    ["Estimated closing", pLongDate(loan.estClosingDate)],
    ["Funds released", pLongDate(loan.fundsReleased)],
    ["Rate lock expires", pLongDate(loan.rateLockExpires)],
    ["Appraisal ordered", pLongDate(loan.appraisalOrdered)],
    ["Closing disclosure sent", pLongDate(loan.cdSent)],
    ["Processor", loan.loanProcessor],
    ["Loan officer", loan.loanOfficer],
  ].filter(([, v]) => v);

  const d = daysUntil(loan.estClosingDate);
  const alert =
    !isFunded(loan) && d !== null && d <= 14 && !loan.appraisalOrdered
      ? `<p class="loan-alert">${icon("clipboard")}<span>Closing in ${d} day${d === 1 ? "" : "s"} and no appraisal ordered date on file.</span></p>`
      : "";

  openSheet(`
    ${sheetHeader(loan.borrowerName, "", "Pipeline")}
    ${sampleBanner()}
    <div class="sheet-body">
      <div class="loan-hero">
        <span class="initials big">${escapeHtml(pInitials(loan.borrowerName))}</span>
        <span class="loan-hero-meta">${milestonePill(loan)}${whenPill(loan)}</span>
      </div>
      ${borrowerStripMarkup(loan)}
      ${teamStripMarkup(team, loan)}
      ${alert}
      <div class="list fact-list">
        ${facts
          .map(
            ([label, value, isStatus]) => `
          <div class="fact">
            <span class="fact-label">${escapeHtml(label)}</span>
            <span class="fact-value${isStatus ? " is-status" : ""}">${escapeHtml(value)}</span>
          </div>`
          )
          .join("")}
      </div>
      ${
        isRefi
          ? /* A refinance has no purchase to be pre-approved for, so the letter
               does not apply. Said out loud rather than silently omitted: a
               button that vanishes with no explanation is how the purchase
               price row got reported as a missing feature. */
            `<p class="feature-na">${icon("fileText")}<span>Pre-approval letters apply to purchase loans only.</span></p>`
          : `<button class="btn btn-primary wide" type="button" data-letter="1">
              ${icon("fileText")}<span>Modify pre-approval letter</span>
            </button>`
      }
      <p class="import-footer">From your imported pipeline, plus the contact details Homespire keeps for the file team.</p>
    </div>`);
}

/* ---------- screen 3: the letter ---------- */

function startLetter(loan) {
  /* Guarded here as well as in the markup. The button is the only route today,
     but a letter on a refinance is wrong in the copy itself, not just missing
     a purchase price, so this must not become reachable by accident. */
  if (!loan || /refinance/i.test(loan.loanPurpose || "")) return;
  const equity = loanEquity(loan);
  letterValues = {
    borrowerName: loan.borrowerName,
    /* Editable. A file can change from FHA to conventional without anything
       else about it changing, and that changes one sentence of the letter. */
    loanType: loan.loanType || "Conventional",
    loanAmount: loan.loanAmount || 0,
    /* Prefilled from the loan when the pipeline knows it, blank otherwise.
       Never guessed: a plausible wrong price on a pre-approval is worse than
       an obvious blank. */
    purchasePrice: equity ? equity.price : "",
    /* The Active export carries the subject property, so the letter starts with
       it filled in instead of blank. Still editable, like everything else. */
    propertyAddress: loan.propertyAddress || "",
    letterDate: todayIso(),
    conditions: ["", ""],
  };
  dropPreview();
  renderLetterEditor();
}

/* The loan types the letter can name. The record's own value is added if it is
   not one of these, so an unusual type from the export is never silently
   replaced with something else. */
const LETTER_LOAN_TYPES = ["Conventional", "FHA", "VA", "USDA", "Jumbo"];

function loanTypeOptions(current) {
  const list = LETTER_LOAN_TYPES.slice();
  if (current && !list.includes(current)) list.unshift(current);
  return list
    .map(
      (t) =>
        `<option value="${escapeHtml(t)}"${t === current ? " selected" : ""}>${escapeHtml(t)}</option>`
    )
    .join("");
}

/**
 * The letter editor.
 *
 * Nothing here is mandatory. An LO reissuing a letter after a price change does
 * not need to retype the address, and one switching FHA to conventional may
 * change nothing else, so every field is optional and the preview is always
 * available. What the letter would leave out is stated as a note, not enforced
 * as a gate: blocking the preview until every box was full was the previous
 * behaviour and it made a partial letter impossible to even look at.
 */
function renderLetterEditor() {
  const derived = letterDerived(letterValues);
  const omitted = letterOmissions(letterValues);

  const derivedText = !Number(letterValues.purchasePrice)
    ? "Add a purchase price to see the down payment."
    : derived.valid
    ? `${pMoney(derived.downPayment)} down, ${(derived.ltv * 100).toFixed(1)}% LTV`
    : `The loan amount is larger than the purchase price. Check both before sending.`;

  openSheet(`
    ${sheetHeader("Pre-approval letter", letterValues.borrowerName, "Loan")}
    ${sampleBanner()}
    <div class="sheet-body">
      <div class="locked-strip">
        <div><span class="fact-label">Borrower</span><span class="fact-value">${escapeHtml(letterValues.borrowerName)}</span></div>
        <div>
          <span class="fact-label">Valid through</span>
          <span class="fact-value">${escapeHtml(pLongDate(letterExpiration(letterValues.letterDate)))}</span>
        </div>
        <p class="locked-note">${icon("shield")}<span>The borrower comes from the pipeline. Every letter is valid for 60 days from the day it is made.</span></p>
      </div>

      <p class="lfield-lead">Change whatever needs changing. Anything you leave alone stays as it is, and anything left empty is simply left off the letter.</p>

      <label class="lfield">
        <span>Purchase price</span>
        <input type="number" inputmode="numeric" data-lf="purchasePrice" value="${escapeHtml(letterValues.purchasePrice)}" placeholder="510000" />
      </label>
      <label class="lfield">
        <span>Loan amount</span>
        <input type="number" inputmode="numeric" data-lf="loanAmount" value="${escapeHtml(letterValues.loanAmount)}" />
      </label>
      <label class="lfield">
        <span>Loan type</span>
        <select data-lf="loanType">${loanTypeOptions(letterValues.loanType)}</select>
      </label>
      <label class="lfield">
        <span>Property address</span>
        <input type="text" data-lf="propertyAddress" value="${escapeHtml(letterValues.propertyAddress)}" placeholder="4218 Longmeadow Drive, Baton Rouge, LA 70808" />
      </label>

      <p class="derived ${derived.valid ? "" : "bad"}">${escapeHtml(derivedText)}</p>

      <p class="lfield-group-label">Extra conditions, if any</p>
      <label class="lfield">
        <span class="sr-only">First extra condition</span>
        <input type="text" maxlength="140" data-lf="condition1" value="${escapeHtml(letterValues.conditions[0] || "")}" placeholder="Receipt of the 2025 federal tax return" />
      </label>
      <label class="lfield">
        <span class="sr-only">Second extra condition</span>
        <input type="text" maxlength="140" data-lf="condition2" value="${escapeHtml(letterValues.conditions[1] || "")}" placeholder="Optional" />
      </label>

      <p class="lfield-note"${omitted.length ? "" : " hidden"}>${
        omitted.length
          ? `${icon("clipboard")}<span>As it stands the letter will not show: ${escapeHtml(omitted.join(", "))}. That is fine if it does not apply.</span>`
          : ""
      }</p>

      <button class="btn btn-outline wide" type="button" data-preview="1">
        ${icon("search")}<span>${previewStale ? "Preview the letter" : "Preview again"}</span>
      </button>

      <div id="preview-slot">${previewSlotMarkup()}</div>
    </div>`);
}

function previewSlotMarkup() {
  if (previewStale || !previewUrl) {
    return `<p class="preview-hint">${
      previewFile
        ? "Something changed, so the preview is out of date. Preview again before sending."
        : "The preview is the real PDF. What you approve is exactly what gets attached."
    }</p>`;
  }
  return `
    <div class="preview-wrap">
      <iframe class="preview-frame" src="${previewUrl}" title="Letter preview"></iframe>
    </div>
    <button class="btn btn-primary wide" type="button" data-send="1">
      ${icon("share")}<span>Send this letter</span>
    </button>
    <p class="preview-hint">Opens the share sheet. Pick Outlook, Messages, or anything else.</p>`;
}

function dropPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  previewFile = null;
  previewStale = true;
}

async function buildPreview(btn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon("refresh")}<span>Building...</span>`;
  try {
    const officer = {
      name: currentLo.name,
      title: currentLo.title,
      nmls: currentLo.nmls,
      phone: currentLo.phone,
      email: currentLo.email,
    };
    const file = await buildLetterFile(letterValues, officer);
    dropPreview();
    previewFile = file;
    previewUrl = URL.createObjectURL(file);
    previewStale = false;
    renderLetterEditor();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    document.getElementById("preview-slot").innerHTML =
      `<p class="import-problems">Could not build the letter: ${escapeHtml(err.message)}</p>`;
  }
}

async function sendLetter(btn) {
  /* previewFile is the exact bytes rendered above. Never rebuild here: that
     would be a different file from the one that was approved. */
  if (!previewFile || previewStale) return;
  const label = btn.innerHTML;
  try {
    if (navigator.canShare && !navigator.canShare({ files: [previewFile] })) {
      throw new Error("This device will not share files from the browser.");
    }
    await navigator.share({
      files: [previewFile],
      title: `Pre-approval, ${letterValues.borrowerName}`,
    });
    btn.innerHTML = `${icon("check")}<span>Sent</span>`;
    setTimeout(() => (btn.innerHTML = label), 2000);
  } catch (err) {
    /* Dismissing the sheet rejects with AbortError. Treating that as failure
       would tell an LO something broke when she simply changed her mind. */
    if (err.name === "AbortError") return;
    document.getElementById("preview-slot").insertAdjacentHTML(
      "beforeend",
      `<p class="import-problems">${escapeHtml(err.message)}</p>`
    );
  }
}

/* ---------- events ---------- */

function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const { loans, problems } = parsePipelineCsv(reader.result);
    const box = document.getElementById("import-problems");
    if (!loans.length) {
      if (box) {
        box.hidden = false;
        box.textContent = problems.join(" ") || "No loans found in that file.";
      }
      return;
    }
    try {
      pipelineData = savePipeline(loans, { fileName: file.name });
      pipelineFilter = "all";
      renderPipelineList();
      renderAll(); // the My Business row now has a count
    } catch (err) {
      if (box) {
        box.hidden = false;
        box.textContent = err.message;
      }
    }
  };
  reader.onerror = () => {
    const box = document.getElementById("import-problems");
    if (box) {
      box.hidden = false;
      box.textContent = "That file could not be read.";
    }
  };
  reader.readAsText(file);
}

function renderPipelineTiles() {
  const slot = document.getElementById("stats-slot");
  if (!slot) return;
  /* Only on the unfiltered Home view. Narrowed to Loan Tools, a production
     summary is just noise above the thing you came for. */
  const show = currentView === "home" && !activeCategoryId;
  slot.innerHTML = show ? pipelineTilesMarkup() : "";
}

/**
 * Flip both funded tiles between month and year.
 *
 * The class goes on the grid rather than the tile so one tap moves the pair,
 * and the markup is not rebuilt, so the transition actually runs. The aria
 * labels are patched in place for the same reason. fundedPeriod is what makes
 * the choice survive the next full re-render.
 */
/**
 * Scroll the My Pipeline row into view on the page behind the sheet.
 *
 * Not a navigation on its own: the sheet is what the tap opens. This is so the
 * page underneath is already at the right place when the sheet is dismissed.
 */
function revealPipelineRow() {
  const row = document.getElementById("open-pipeline-btn");
  if (!row || typeof row.scrollIntoView !== "function") return;
  try {
    row.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    row.scrollIntoView();
  }
}

function wireProductionTiles() {
  const slot = document.getElementById("stats-slot");
  if (!slot) return;
  slot.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-pipeline]")) {
      /* Open the sheet, and bring the My Pipeline row into view behind it, so
         closing the sheet leaves you at that section rather than back at the
         top of Home. */
      revealPipelineRow();
      return openPipeline();
    }
    if (!e.target.closest("[data-flip]")) return;
    fundedPeriod = fundedPeriod === "year" ? "month" : "year";
    const grid = slot.querySelector(".tile-grid");
    if (grid) grid.classList.toggle("is-flipped", fundedPeriod === "year");
    slot.querySelectorAll("[data-flip]").forEach((btn) => {
      const name = (btn.getAttribute("aria-label") || "").split(".")[0];
      const now = fundedPeriod === "year" ? "year" : "month";
      const next = fundedPeriod === "year" ? "month" : "year";
      btn.setAttribute("aria-label", `${name}. Showing ${now} to date. Tap to show the ${next}.`);
    });
    /* Only the visible face should be reachable by a screen reader. */
    slot.querySelectorAll(".tile-flip").forEach((btn) => {
      const front = btn.querySelector(".flip-face:not(.flip-back)");
      const back = btn.querySelector(".flip-back");
      if (front) front.setAttribute("aria-hidden", fundedPeriod === "year" ? "true" : "false");
      if (back) back.setAttribute("aria-hidden", fundedPeriod === "year" ? "false" : "true");
    });
  });
}

function wirePipelineSheet() {
  const sheet = pipeEl();

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeSheet();

    /* Toggled in place rather than re-rendered: a re-render would scroll the
       sheet back to the top, away from the thing just tapped. */
    const teamSend = e.target.closest("[data-team-mail], [data-team-sms]");
    if (teamSend && teamSend.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      return;
    }

    const teamBtn = e.target.closest("[data-team]");
    if (teamBtn) {
      const panel = sheet.querySelector(".team-panel");
      if (panel) {
        const open = panel.hidden;
        panel.hidden = !open;
        teamBtn.setAttribute("aria-expanded", String(open));
        teamBtn.closest(".team-strip").classList.toggle("is-open", open);
        if (open) syncTeamSend();
      }
      return;
    }

    if (e.target.closest("[data-back]")) {
      if (letterValues) {
        letterValues = null;
        dropPreview();
        return renderLoanDetail(openLoan);
      }
      if (openLoan) {
        openLoan = null;
        return renderPipelineList();
      }
      return closeSheet();
    }

    const chip = e.target.closest("[data-filter]");
    if (chip) {
      pipelineFilter = chip.dataset.filter;
      return renderPipelineList();
    }

    const row = e.target.closest("[data-loan]");
    if (row) {
      const loan = myLoans().find((l) => l.loanNumber === row.dataset.loan);
      if (loan) return renderLoanDetail(loan);
    }

    if (e.target.closest("[data-letter]")) return startLetter(openLoan);

    const preview = e.target.closest("[data-preview]");
    if (preview) return buildPreview(preview);

    const send = e.target.closest("[data-send]");
    if (send) return sendLetter(send);

    if (e.target.closest("[data-reimport]")) return renderImportScreen();

    if (e.target.closest("[data-forget]")) {
      if (!confirm("Remove the pipeline from this device? You can import it again.")) return;
      clearPipeline();
      closeSheet();
      loadSamplePipeline().then((sample) => {
        pipelineData = sample;
        renderAll();
      });
    }
  });

  sheet.addEventListener("change", (e) => {
    const pick = e.target.closest("[data-team-pick]");
    if (pick) {
      const i = Number(pick.dataset.teamPick);
      if (pick.checked) teamSelected.add(i);
      else teamSelected.delete(i);
      syncTeamSend();
      return;
    }
    if (e.target.id === "pipeline-file") handleImportFile(e.target);
  });

  /* Any edit invalidates the preview. This is the whole byte-for-byte
     guarantee: an approved preview must never outlive the values it came
     from. The panel is not re-rendered on every keystroke, only the parts
     that depend on the value, so the caret stays where it is. */
  sheet.addEventListener("input", (e) => {
    const field = e.target.dataset.lf;
    if (!field || !letterValues) return;
    if (field === "condition1" || field === "condition2") {
      letterValues.conditions[field === "condition1" ? 0 : 1] = e.target.value;
    } else {
      letterValues[field] = e.target.value;
    }

    if (!previewStale) {
      previewStale = true;
      document.getElementById("preview-slot").innerHTML = previewSlotMarkup();
    }

    /* Patched in place rather than re-rendered: a re-render would take focus
       out of the field being typed into. */
    const derived = letterDerived(letterValues);
    const note = sheet.querySelector(".derived");
    if (note) {
      note.classList.toggle("bad", !derived.valid);
      note.textContent = !Number(letterValues.purchasePrice)
        ? "Add a purchase price to see the down payment."
        : derived.valid
        ? `${pMoney(derived.downPayment)} down, ${(derived.ltv * 100).toFixed(1)}% LTV`
        : "The loan amount is larger than the purchase price. Check both before sending.";
    }

    /* What the letter will leave off has to track what is in the fields right
       now, or it goes stale the moment something is cleared. */
    const omitted = letterOmissions(letterValues);
    const omitNote = sheet.querySelector(".lfield-note");
    if (omitNote) {
      if (omitted.length) {
        omitNote.hidden = false;
        omitNote.innerHTML = `${icon("clipboard")}<span>As it stands the letter will not show: ${escapeHtml(
          omitted.join(", ")
        )}. That is fine if it does not apply.</span>`;
      } else {
        omitNote.hidden = true;
      }
    }

    /* Preview is never gated. The LO decides which fields matter for the letter
       she is writing, and a partial letter still has to be previewable. */
  });
}

async function initPipeline() {
  wirePipelineSheet();
  wireProductionTiles();
  /* An import always wins. The sample exists so the feature is never an empty
     screen, not to compete with the LO's own data. */
  pipelineData = loadPipeline();
  if (!pipelineData) {
    /* Order matters. A device import always wins, because it is what the LO
       chose. Failing that, a local build's real data, then the synthetic
       sample, so a public build behaves exactly as it did before. */
    pipelineData = (await loadLocalPipeline()) || (await loadSamplePipeline());
    if (pipelineData) renderAll(); // the My Business row now has a count
  }
}

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
  const sub = !pipelineData
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
 * Two of them are exact. The funded pair is only ever as good as the export:
 * a month-to-date pipeline snapshot carries a few days of funding, not a year,
 * so the tile is labelled with the period the data actually covers rather than
 * with the period someone hoped for. A dashboard that says "year to date" over
 * three days of September is worse than no dashboard, because it gets repeated
 * in a meeting.
 */
function pipelineTilesMarkup() {
  if (!pipelineData || !currentLo) return "";
  const loans = myLoans();
  if (!loans.length) return "";

  const active = loans.filter((l) => !isFunded(l));
  const funded = loans.filter(isFunded);
  const sum = (list) => list.reduce((n, l) => n + (l.loanAmount || 0), 0);

  const fundedDates = funded.map((l) => l.fundsReleased).filter(Boolean).sort();
  const earliest = fundedDates[0];
  const thisYear = String(new Date().getFullYear());
  let coverage;
  if (!funded.length) {
    coverage = "none in this data";
  } else if (earliest && earliest.startsWith(thisYear) && earliest.slice(5, 7) === "01") {
    coverage = "this year";
  } else if (earliest) {
    /* Say the real window. It is how you notice the export is not what you
       thought it was. */
    coverage = `since ${pShortDate(earliest)}`;
  } else {
    coverage = "in this data";
  }

  const tile = (label, value, note, lead) => `
    <button class="tile${lead ? " lead" : ""}" type="button" data-open-pipeline="1">
      <span class="tile-label">${escapeHtml(label)}</span>
      <span class="tile-value">${escapeHtml(value)}</span>
      <span class="tile-note">${escapeHtml(note)}</span>
    </button>`;

  return `
    <div class="tile-head">
      <span>My production</span>
      ${pipelineData.sample ? `<span class="tile-sample">Sample</span>` : ""}
    </div>
    <div class="tile-grid">
      ${tile("In pipeline", String(active.length), active.length === 1 ? "loan" : "loans", true)}
      ${tile("Pipeline volume", pCompact(sum(active)), "in process", true)}
      ${tile("Funded", String(funded.length), funded.length === 1 ? "loan" : "loans")}
      ${tile("Funded volume", pCompact(sum(funded)), coverage)}
    </div>`;
}

function myLoans() {
  if (!pipelineData || !currentLo) return [];
  return loansForLo(pipelineData.loans, currentLo);
}

/* A demo that cannot be told from real data is how a fabricated number ends up
   quoted in a real meeting. The sample says so on every screen it reaches. */
function sampleBanner() {
  return pipelineData && pipelineData.sample
    ? `<p class="sample-banner">${icon("shield")}<span>Sample data. Not real loans.</span></p>`
    : "";
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

  const counts = {
    all: loans.length,
    soon: loans.filter((l) => !isFunded(l) && daysUntil(l.estClosingDate) <= 14).length,
    started: loans.filter((l) => !isFunded(l) && l.milestone === "Started").length,
    approval: loans.filter((l) => !isFunded(l) && l.milestone === "Approval").length,
    funded: stats.funded,
  };
  const chip = (id, label) =>
    counts[id]
      ? `<button class="chip" type="button" data-filter="${id}" aria-pressed="${pipelineFilter === id}">${label} ${counts[id]}</button>`
      : "";

  const shown = loans.filter((l) => {
    if (pipelineFilter === "all") return true;
    if (pipelineFilter === "funded") return isFunded(l);
    if (isFunded(l)) return false;
    if (pipelineFilter === "soon") return daysUntil(l.estClosingDate) <= 14;
    return l.milestone === (pipelineFilter === "started" ? "Started" : "Approval");
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
      <div class="stat-card">
        <div class="stat-label">Funded</div>
        <div class="stat-value">${pCompact(stats.fundedVolume)}</div>
        <div class="stat-note">${stats.funded} ${pipelineData && pipelineData.sample ? "in this sample" : "in this export"}</div>
      </div>
    </div>
    <div class="chip-row">${chip("all", "All")}${chip("soon", "Closing soon")}${chip("started", "Started")}${chip("approval", "Approval")}${chip("funded", "Funded")}</div>
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

  /* Only rows the export actually filled. A detail screen full of blanks
     teaches an LO that the app does not know anything. */
  const facts = [
    ["Loan number", loan.loanNumber],
    ["Milestone", loan.milestone],
    ["Purpose", loan.loanPurpose],
    ["Loan type", loan.loanType],
    ["Loan amount", loan.loanAmount ? pMoney(loan.loanAmount) : ""],
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
      ${alert}
      <div class="list fact-list">
        ${facts
          .map(
            ([label, value]) => `
          <div class="fact">
            <span class="fact-label">${escapeHtml(label)}</span>
            <span class="fact-value">${escapeHtml(value)}</span>
          </div>`
          )
          .join("")}
      </div>
      <button class="btn btn-primary wide" type="button" data-letter="1">
        ${icon("fileText")}<span>Pre-approval letter</span>
      </button>
      <p class="import-footer">Everything above is what the export carries for this loan.</p>
    </div>`);
}

/* ---------- screen 3: the letter ---------- */

function startLetter(loan) {
  letterValues = {
    borrowerName: loan.borrowerName,
    loanType: loan.loanType || loan.loanPurpose || "mortgage",
    loanAmount: loan.loanAmount || 0,
    /* Not in the export. Both are fields the LO edits anyway, so they start
       empty rather than guessed: a plausible wrong price on a pre-approval is
       worse than an obvious blank. */
    purchasePrice: "",
    propertyAddress: "",
    letterDate: todayIso(),
    expirationDate: addDays(todayIso(), 60),
    closingDays: 21,
  };
  dropPreview();
  renderLetterEditor();
}

function letterMissing() {
  const missing = [];
  if (!Number(letterValues.purchasePrice)) missing.push("purchase price");
  if (!String(letterValues.propertyAddress).trim()) missing.push("property address");
  if (!Number(letterValues.loanAmount)) missing.push("loan amount");
  if (!letterValues.expirationDate) missing.push("expiration date");
  return missing;
}

function renderLetterEditor() {
  const derived = letterDerived(letterValues);
  const missing = letterMissing();
  const canPreview = missing.length === 0 && derived.valid;

  const derivedText = !Number(letterValues.purchasePrice)
    ? "Enter a purchase price to see these."
    : derived.valid
    ? `${pMoney(derived.downPayment)} down, ${(derived.ltv * 100).toFixed(1)}% LTV`
    : `Loan amount is larger than the purchase price. That would put the down payment at ${pMoney(derived.downPayment)}.`;

  openSheet(`
    ${sheetHeader("Pre-approval letter", letterValues.borrowerName, "Loan")}
    ${sampleBanner()}
    <div class="sheet-body">
      <div class="locked-strip">
        <div><span class="fact-label">Borrower</span><span class="fact-value">${escapeHtml(letterValues.borrowerName)}</span></div>
        <div><span class="fact-label">Loan type</span><span class="fact-value">${escapeHtml(letterValues.loanType)}</span></div>
        <p class="locked-note">${icon("shield")}<span>From the pipeline. Not editable here.</span></p>
      </div>

      <label class="lfield">
        <span>Purchase price</span>
        <input type="number" inputmode="numeric" data-lf="purchasePrice" value="${escapeHtml(letterValues.purchasePrice)}" placeholder="510000" />
      </label>
      <label class="lfield">
        <span>Loan amount</span>
        <input type="number" inputmode="numeric" data-lf="loanAmount" value="${escapeHtml(letterValues.loanAmount)}" />
      </label>
      <label class="lfield">
        <span>Property address</span>
        <input type="text" data-lf="propertyAddress" value="${escapeHtml(letterValues.propertyAddress)}" placeholder="4218 Longmeadow Drive, Baton Rouge, LA 70808" />
      </label>
      <label class="lfield">
        <span>Valid through</span>
        <input type="date" data-lf="expirationDate" value="${escapeHtml(letterValues.expirationDate)}" />
      </label>

      <p class="derived ${derived.valid ? "" : "bad"}">${escapeHtml(derivedText)}</p>

      ${
        missing.length
          ? `<p class="import-problems">Still needed: ${escapeHtml(missing.join(", "))}.</p>`
          : ""
      }

      <button class="btn btn-outline wide" type="button" data-preview="1" ${canPreview ? "" : "disabled"}>
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

function wirePipelineTiles() {
  const slot = document.getElementById("stats-slot");
  if (!slot) return;
  slot.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-pipeline]")) openPipeline();
  });
}

function renderPipelineTiles() {
  const slot = document.getElementById("stats-slot");
  if (!slot) return;
  /* Only on the unfiltered Home view. Narrowed to Loan Tools, a production
     summary is just noise above the thing you came for. */
  const show = currentView === "home" && !activeCategoryId;
  slot.innerHTML = show ? pipelineTilesMarkup() : "";
}

function wirePipelineSheet() {
  const sheet = pipeEl();

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeSheet();

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
    if (e.target.id === "pipeline-file") handleImportFile(e.target);
  });

  /* Any edit invalidates the preview. This is the whole byte-for-byte
     guarantee: an approved preview must never outlive the values it came
     from. The panel is not re-rendered on every keystroke, only the parts
     that depend on the value, so the caret stays where it is. */
  sheet.addEventListener("input", (e) => {
    const field = e.target.dataset.lf;
    if (!field || !letterValues) return;
    letterValues[field] = e.target.value;

    if (!previewStale) {
      previewStale = true;
      document.getElementById("preview-slot").innerHTML = previewSlotMarkup();
    }

    const derived = letterDerived(letterValues);
    const note = sheet.querySelector(".derived");
    if (note) {
      note.classList.toggle("bad", !derived.valid);
      note.textContent = !Number(letterValues.purchasePrice)
        ? "Enter a purchase price to see these."
        : derived.valid
        ? `${pMoney(derived.downPayment)} down, ${(derived.ltv * 100).toFixed(1)}% LTV`
        : `Loan amount is larger than the purchase price. That would put the down payment at ${pMoney(derived.downPayment)}.`;
    }

    const btn = sheet.querySelector("[data-preview]");
    if (btn) btn.disabled = letterMissing().length > 0 || !derived.valid;
  });
}

async function initPipeline() {
  wirePipelineSheet();
  wirePipelineTiles();
  /* An import always wins. The sample exists so the feature is never an empty
     screen, not to compete with the LO's own data. */
  pipelineData = loadPipeline();
  if (!pipelineData) {
    pipelineData = await loadSamplePipeline();
    if (pipelineData) renderAll(); // the My Business row now has a count
  }
}

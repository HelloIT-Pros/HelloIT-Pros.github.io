/**
 * Pipeline data: the LO's loans, read from an Encompass CSV export.
 *
 * WHERE THIS DATA LIVES, AND WHY
 *
 * Nowhere on the server. This app is served from a public static host, so any
 * file in the repo is world readable and permanent in git history. The export
 * is named borrowers, loan amounts, loan types, closing dates and interest
 * rates, which is exactly the sort of thing that must never be published. So
 * the CSV is imported on the device and kept in that browser's localStorage.
 * Nothing is uploaded, and the app works with no pipeline at all.
 *
 * The trade is real: a refresh means importing again. That is the correct cost
 * for a prototype. The production answer is the same screens reading from a
 * database behind SSO, at which point only loadPipeline changes.
 *
 * The interest rate column is dropped at parse time rather than merely hidden.
 * A value that is never stored cannot leak through a later feature.
 */

const PIPELINE_KEY = "lolife_pipeline_v1";

/* Column names as Encompass exports them, square brackets and all. */
const COLUMNS = {
  loanNumber: "LoanNumber",
  borrowerName: "BorrowerName",
  loanOfficer: "LoanOfficer",
  estClosingDate: "EstClosingDate",
  loanPurpose: "LoanPurpose",
  milestone: "CurrentMilestone",
  channel: "NFMChannelDropdown",
  loanAmount: "TotalLoanAmount",
  closedDate: "ClosedDate",
  loanProcessor: "LoanProcessor",
  loanType: "LoanType",
  nmls: "NMLSLoanOriginatorID",
  appraisalOrdered: "AppraisalOrderedDate",
  rateLockExpires: "RateLockExpires",
  fundsReleased: "FundingFundsReleased",
  cdSent: "CDSentDateTime",
};

/*
 * Columns the richer "Active" export carries.
 *
 * Read when present, never reported as missing, because the older month to date
 * export does not have them. This is what finally supplies purchase price,
 * property address, the loan partners and the folder a file sits in, all of
 * which the app previously had to fake or leave blank.
 */
const EXTRA_COLUMNS = {
  purchasePrice: "PurchasePrice",
  downPaymentAmount: "DownPaymentAmount",
  appraisedValue: "AppraisedValue",
  folder: "LoanFolderName",
  street: "SubjectPropertyStreet",
  city: "SubjectPropertyCity",
  stateCode: "SubjectPropertyState",
  zip: "SubjectPropertyZIP",
  partner1: "LoanTeamMemberNameLoanPartner1",
  partner2: "LoanTeamMemberNameLoanPartner2",
  fileStarted: "DateFileStarted",
  applicationDate: "GFEApplicationDate",
  borrowerPhone: "BorrCell",
  borrowerEmail: "BorrEmail",
};

/* The folder Encompass keeps the file in. "Prospects" is a lead, not a live
   loan, and the two must never be added together in a production number. */
const PROSPECT_FOLDER = "Prospects";
const ACTIVE_FOLDER = "My Pipeline";

/** Deliberately not imported. Named so the omission is a decision on the page. */
const DROPPED_COLUMNS = ["InterestRate"];

/*
 * Columns the export does not carry yet.
 *
 * Purchase price and the assistant's details are coming to the export but are
 * not in it today. They are read here so that the day those columns appear, no
 * code changes: a file with them is richer, a file without them behaves exactly
 * as it does now. Unlike COLUMNS these are never reported as missing, because
 * their absence is the normal case rather than a malformed file.
 *
 * THE NAMES BELOW ARE PROVISIONAL. Whoever builds the export decides the real
 * headers; check these against the first file that has them.
 */
const FUTURE_COLUMNS = {
  purchasePrice: "PurchasePrice",
  processorEmail: "LoanProcessorEmail",
  processorPhone: "LoanProcessorPhone",
  loaName: "LoanOfficerAssistant",
  loaEmail: "LoanOfficerAssistantEmail",
  loaPhone: "LoanOfficerAssistantPhone",
};

/* ---------- parsing ---------- */

/**
 * A real CSV split: quoted fields can contain commas and doubled quotes, and a
 * borrower called "Smith, Jr., Robert" would otherwise silently shift every
 * column after it.
 */
function splitCsvLine(line) {
  const out = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

const dateOnly = (v) => {
  const s = (v || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const cleanHeader = (h) => h.trim().replace(/^﻿/, "").replace(/^\[|\]$/g, "");

/**
 * Turn CSV text into loan objects. Returns the rows plus what was skipped, so
 * a partly malformed file reports itself rather than quietly losing loans.
 */
function parsePipelineCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) {
    return { loans: [], problems: ["The file is empty."], columns: [] };
  }

  const header = splitCsvLine(lines[0]).map(cleanHeader);
  const index = {};
  header.forEach((name, i) => (index[name] = i));

  const missing = Object.values(COLUMNS).filter((c) => !(c in index));
  const problems = [];
  if (missing.includes("LoanOfficer") || missing.includes("BorrowerName")) {
    return {
      loans: [],
      columns: header,
      problems: [
        `This does not look like a pipeline export. Expected columns including LoanOfficer and BorrowerName, found: ${header.join(", ")}`,
      ],
    };
  }
  if (missing.length) {
    problems.push(`Columns not in this file, so those fields stay empty: ${missing.join(", ")}`);
  }

  const loans = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const at = (key) => {
      const col = COLUMNS[key] || EXTRA_COLUMNS[key] || FUTURE_COLUMNS[key];
      const pos = index[col];
      return pos === undefined ? "" : (cells[pos] || "").trim();
    };

    const name = at("borrowerName");
    if (!name) {
      problems.push(`Row ${i + 1} has no borrower name and was skipped.`);
      continue;
    }

    const amount = Number(at("loanAmount").replace(/[$,]/g, ""));
    const money = (key) => {
      const v = Number(at(key).replace(/[$,]/g, ""));
      return Number.isFinite(v) ? v : 0;
    };
    /* One line, assembled from four columns, and only the parts that are
       there. A trailing comma with no city is worse than a short address. */
    const address = [
      at("street"),
      [at("city"), at("stateCode")].filter(Boolean).join(", "),
      at("zip"),
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
    loans.push({
      loanNumber: at("loanNumber"),
      borrowerName: name,
      loanOfficer: at("loanOfficer"),
      nmls: at("nmls"),
      milestone: at("milestone"),
      loanPurpose: at("loanPurpose"),
      loanType: at("loanType"),
      loanAmount: Number.isFinite(amount) ? amount : 0,
      estClosingDate: dateOnly(at("estClosingDate")),
      /* ClosedDate is not a closed date. It equals EstClosingDate on almost
         every row in a real export, so it is carried but never labelled as
         closed anywhere in the UI. */
      closedDateRaw: dateOnly(at("closedDate")),
      appraisalOrdered: dateOnly(at("appraisalOrdered")),
      rateLockExpires: dateOnly(at("rateLockExpires")),
      fundsReleased: dateOnly(at("fundsReleased")),
      cdSent: dateOnly(at("cdSent")),
      loanProcessor: at("loanProcessor"),
      channel: at("channel"),

      purchasePrice: money("purchasePrice"),
      /* Encompass keeps its own down payment, and on many rows it does not
         equal price minus loan amount. It is the system of record, so it wins
         when present and the subtraction is only the fallback. */
      downPaymentAmount: money("downPaymentAmount"),
      appraisedValue: money("appraisedValue"),
      propertyAddress: address,
      folder: at("folder") || "",
      fileStarted: dateOnly(at("fileStarted")),
      applicationDate: dateOnly(at("applicationDate")),

      /* Borrower contact, so the LO can reach them from the loan. Kept because
         it is her own book on her own device; it is never uploaded, exactly
         like everything else here. */
      borrowerPhone: at("borrowerPhone"),
      borrowerEmail: at("borrowerEmail"),

      /* Loan partners, the export's name for the assistants on a file. */
      partner1: at("partner1"),
      partner2: at("partner2"),

      processorEmail: at("processorEmail"),
      processorPhone: at("processorPhone"),
      loaName: at("loaName"),
      loaEmail: at("loaEmail"),
      loaPhone: at("loaPhone"),
    });
  }

  return { loans, problems, columns: header };
}

/* ---------- what a loan actually means ---------- */

/**
 * Funded is the only completion the data can prove. The milestone field still
 * reads "Funding" after the money has gone out, so a UI that trusts the
 * milestone shows finished loans as in flight and, worse, as overdue.
 */
function isFunded(loan) {
  return Boolean(loan.fundsReleased);
}

/**
 * A prospect is a lead, not a loan in flight.
 *
 * The Active export is overwhelmingly prospects: 5684 of 5808 rows in the first
 * one we saw. Counting them in "In pipeline" would turn a production number
 * into a lead count, so every aggregate here excludes them and the UI shows
 * them as their own folder.
 *
 * A file with no folder column at all is treated as active, because the older
 * export has no folders and every row in it is a live loan.
 */
function isProspect(loan) {
  return String(loan.folder || "").trim() === PROSPECT_FOLDER;
}

/** Live loans: not a prospect, not already funded. */
function isActivePipeline(loan) {
  return !isProspect(loan) && !isFunded(loan);
}

function daysUntil(iso, today = new Date()) {
  if (!iso) return null;
  const target = new Date(iso + "T12:00:00");
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((target - from) / 86400000);
}

function pipelineStats(loans, today = new Date()) {
  /* Prospects are excluded from every number here. See isProspect. */
  const active = loans.filter(isActivePipeline);
  const funded = loans.filter((l) => isFunded(l) && !isProspect(l));
  const prospects = loans.filter(isProspect);
  const sum = (list) => list.reduce((n, l) => n + (l.loanAmount || 0), 0);
  return {
    total: loans.length,
    active: active.length,
    activeVolume: sum(active),
    prospects: prospects.length,
    prospectVolume: sum(prospects),
    funded: funded.length,
    fundedVolume: sum(funded),
    closingSoon: active.filter((l) => {
      const d = daysUntil(l.estClosingDate, today);
      return d !== null && d >= 0 && d <= 30;
    }).length,
    overdue: active.filter((l) => {
      const d = daysUntil(l.estClosingDate, today);
      return d !== null && d < 0;
    }).length,
  };
}

/**
 * Funded units and volume for the current month and the current year.
 *
 * Keyed off fundsReleased for the same reason isFunded is: it is the only date
 * in the export that proves the money actually went out. String prefix matching
 * on the ISO date avoids constructing a Date per loan and avoids timezone drift
 * pulling a loan funded on the 1st back into the previous month.
 *
 * Note what a real export will do here. Encompass pipeline exports carry almost
 * no funded history, so year and month will read the same until a funded loans
 * report covering the year is imported. That is a data problem, not a display
 * one, and this returns whatever the imported file can support.
 */
function fundedTotals(loans, today = new Date()) {
  const year = String(today.getFullYear());
  const month = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const tally = (prefix) => {
    const hits = loans.filter((l) => !isProspect(l) && l.fundsReleased && l.fundsReleased.startsWith(prefix));
    return {
      units: hits.length,
      volume: hits.reduce((n, l) => n + (l.loanAmount || 0), 0),
    };
  };
  return { month: tally(month), year: tally(year) };
}

/**
 * Purchase price, down payment and LTV for one loan.
 *
 * Computed rather than stored so they can never contradict the two numbers
 * they come from. Returns null when the price is missing, which is every loan
 * in today's export, and the detail screen then shows neither row rather than
 * showing a down payment of the entire loan amount.
 */
function loanEquity(loan) {
  const price = Number(loan.purchasePrice) || 0;
  const amount = Number(loan.loanAmount) || 0;
  if (!price || !amount) return null;
  /* A loan larger than the price is a data error, not a negative down payment. */
  if (amount > price) return null;
  /*
   * Encompass carries its own DownPaymentAmount, and on most rows it does not
   * equal price minus loan amount: seller credits, financed fees and gift funds
   * all sit in the gap. It is the system of record, so it wins when present and
   * the subtraction is only the fallback. `derivedDown` says which one this is,
   * so the screen can be honest about it.
   */
  const stated = Number(loan.downPaymentAmount) || 0;
  const useStated = stated > 0 && stated <= price;
  return {
    price,
    downPayment: useStated ? stated : price - amount,
    derivedDown: !useStated,
    ltv: amount / price,
  };
}

function teamSlug(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Who else is on this file.
 *
 * Contact details are resolved in three steps, in this order:
 *   1. the loan's own columns, once the export carries them
 *   2. the directory in config.json, keyed by a slug of the person's name
 *   3. nothing, in which case the person is still listed by name with no
 *      contact actions offered
 *
 * Step 2 is the bridge. A real export today gives a processor name and nothing
 * else, so the directory is what turns that name into something tappable
 * without waiting on the export to change.
 */
function teamForLoan(loan, directory) {
  const dir = directory || {};
  const out = [];
  const add = (role, name, phone, email) => {
    const person = String(name || "").trim();
    if (!person) return;
    const known = dir[teamSlug(person)] || {};
    out.push({
      role,
      name: person,
      phone: String(phone || known.phone || "").trim(),
      email: String(email || known.email || "").trim(),
    });
  };
  add("Processor", loan.loanProcessor, loan.processorPhone, loan.processorEmail);
  add("Loan officer assistant", loan.loaName, loan.loaPhone, loan.loaEmail);
  /* The Active export's name for the same role. Two partners can be named on a
     file, so both are listed and the directory fills in their details. */
  add("Loan partner", loan.partner1, "", "");
  add("Loan partner", loan.partner2, "", "");
  /* The same person can arrive as both a processor and a partner. */
  const seen = new Set();
  return out.filter((m) => {
    const key = teamSlug(m.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Soonest first, funded loans last: an LO reads this list to plan a day. */
function sortForPipeline(loans, today = new Date()) {
  return [...loans].sort((a, b) => {
    if (isFunded(a) !== isFunded(b)) return isFunded(a) ? 1 : -1;
    const da = daysUntil(a.estClosingDate, today);
    const db = daysUntil(b.estClosingDate, today);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

/**
 * Match a stored loan to an LO. NMLS is the real key and is tried first; the
 * display name is the fallback, and it is fragile, which is worth knowing when
 * an LO's pipeline unexpectedly comes back empty.
 */
function loansForLo(loans, lo) {
  if (!lo) return [];
  const nmls = String(lo.nmls || "").trim();
  if (nmls) {
    const byId = loans.filter((l) => l.nmls && l.nmls === nmls);
    if (byId.length) return byId;
  }
  const name = (lo.name || "").trim().toLowerCase();
  return loans.filter((l) => (l.loanOfficer || "").trim().toLowerCase() === name);
}

/* ---------- device storage ---------- */

/**
 * The sample that ships in this repo.
 *
 * Dates are stored as offsets from the day it is viewed rather than as fixed
 * dates, so a committed sample never rots into a screen full of overdue loans.
 * It is flagged sample:true all the way through and labelled on screen, because
 * a demo that cannot be told from real data is how someone quotes a fake number
 * in a real meeting.
 */
const SAMPLE_URL = "data/pipeline-sample.json";

function offsetToIso(days, today = new Date()) {
  if (days === undefined || days === null) return null;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A given day of the *current* month, clamped so it is never in the future.
 *
 * A day offset cannot express "this month": viewed on the 2nd, minus six days
 * is last month, and the month to date figures in the sample would read zero
 * through the first week of every month. Anchoring a few sample fundings to a
 * day of the current month keeps the month face populated whenever it is
 * opened, without any fixed date that can rot.
 */
function monthDayToIso(day, today = new Date()) {
  if (day === undefined || day === null) return null;
  const wanted = Math.min(Math.max(1, Number(day) || 1), today.getDate());
  const d = new Date(today.getFullYear(), today.getMonth(), wanted, 12);
  return d.toISOString().slice(0, 10);
}

async function loadSamplePipeline() {
  try {
    const res = await fetch(SAMPLE_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.json();
    const loans = (raw.loans || []).map((l) => ({
      loanNumber: l.loanNumber,
      borrowerName: l.borrowerName,
      loanOfficer: l.loanOfficer,
      nmls: l.nmls || "",
      milestone: l.milestone,
      loanPurpose: l.loanPurpose,
      loanType: l.loanType,
      loanAmount: l.loanAmount,
      estClosingDate: offsetToIso(l.estClosingOffsetDays) || monthDayToIso(l.estClosingMonthDay),
      closedDateRaw: null,
      appraisalOrdered: offsetToIso(l.appraisalOrderedOffsetDays),
      rateLockExpires: offsetToIso(l.rateLockOffsetDays),
      fundsReleased: offsetToIso(l.fundedOffsetDays) || monthDayToIso(l.fundedMonthDay),
      cdSent: offsetToIso(l.cdSentOffsetDays),
      loanProcessor: l.loanProcessor || "",
      channel: l.channel || "",
      purchasePrice: l.purchasePrice || 0,
      processorEmail: l.processorEmail || "",
      processorPhone: l.processorPhone || "",
      loaName: l.loaName || "",
      loaEmail: l.loaEmail || "",
      loaPhone: l.loaPhone || "",
    }));
    return { loans, sample: true, importedAt: new Date().toISOString(), fileName: "", officers: 0 };
  } catch {
    return null;
  }
}

/**
 * A real pipeline baked into a local build.
 *
 * data/pipeline-local.json does not exist on the public site and never will:
 * it is real borrower data, so it is gitignored and no-pii-check.py refuses to
 * ship if it ever appears in the repo. On the public site this fetch 404s and
 * the app falls back to the synthetic sample exactly as before.
 *
 * It is flagged sample:false, so nothing in the UI calls it sample data. That
 * matters in both directions: a demo must never look real, and real numbers
 * must never be dismissed as a demo.
 */
const LOCAL_URL = "data/pipeline-local.json";

/**
 * Is this a local build?
 *
 * The public site must never so much as ask for the real data file. Gating on
 * the host means the request only happens on a machine serving the app itself,
 * and it keeps a 404 out of the console on every public launch. Private LAN
 * addresses count, so a build served from a laptop can be opened on a phone on
 * the same network, which is the only way to see it on a real device.
 */
function isLocalBuild(host = window.location.hostname) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === "" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

async function loadLocalPipeline() {
  if (!isLocalBuild()) return null;
  try {
    const res = await fetch(LOCAL_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw.loans) || !raw.loans.length) return null;
    return {
      loans: raw.loans,
      sample: false,
      local: true,
      importedAt: raw.generatedAt || new Date().toISOString(),
      fileName: raw.sourceFile || "",
      officers: [...new Set(raw.loans.map((l) => l.loanOfficer).filter(Boolean))].length,
    };
  } catch {
    return null;
  }
}

function loadPipeline() {
  try {
    const raw = localStorage.getItem(PIPELINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.loans) ? parsed : null;
  } catch {
    return null;
  }
}

function savePipeline(loans, meta = {}) {
  const payload = {
    loans,
    importedAt: new Date().toISOString(),
    fileName: meta.fileName || "",
    officers: [...new Set(loans.map((l) => l.loanOfficer).filter(Boolean))].length,
  };
  try {
    localStorage.setItem(PIPELINE_KEY, JSON.stringify(payload));
    return payload;
  } catch (err) {
    /* Quota is the realistic failure. Say so rather than appearing to succeed. */
    throw new Error(
      `Could not store the pipeline on this device (${err.name}). The file may be too large for browser storage.`
    );
  }
}

function clearPipeline() {
  localStorage.removeItem(PIPELINE_KEY);
}

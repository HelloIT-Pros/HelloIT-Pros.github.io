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

/** Deliberately not imported. Named so the omission is a decision on the page. */
const DROPPED_COLUMNS = ["InterestRate"];

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
      const col = COLUMNS[key];
      const pos = index[col];
      return pos === undefined ? "" : (cells[pos] || "").trim();
    };

    const name = at("borrowerName");
    if (!name) {
      problems.push(`Row ${i + 1} has no borrower name and was skipped.`);
      continue;
    }

    const amount = Number(at("loanAmount").replace(/[$,]/g, ""));
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

function daysUntil(iso, today = new Date()) {
  if (!iso) return null;
  const target = new Date(iso + "T12:00:00");
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((target - from) / 86400000);
}

function pipelineStats(loans, today = new Date()) {
  const active = loans.filter((l) => !isFunded(l));
  const funded = loans.filter(isFunded);
  const sum = (list) => list.reduce((n, l) => n + (l.loanAmount || 0), 0);
  return {
    total: loans.length,
    active: active.length,
    activeVolume: sum(active),
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
      estClosingDate: offsetToIso(l.estClosingOffsetDays),
      closedDateRaw: null,
      appraisalOrdered: offsetToIso(l.appraisalOrderedOffsetDays),
      rateLockExpires: offsetToIso(l.rateLockOffsetDays),
      fundsReleased: offsetToIso(l.fundedOffsetDays),
      cdSent: offsetToIso(l.cdSentOffsetDays),
      loanProcessor: l.loanProcessor || "",
      channel: l.channel || "",
    }));
    return { loans, sample: true, importedAt: new Date().toISOString(), fileName: "", officers: 0 };
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

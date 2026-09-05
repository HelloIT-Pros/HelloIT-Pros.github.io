/**
 * The pre-approval letter, drawn from a loan object with pdf-lib.
 *
 * Drawn rather than filled into a template PDF. A form field is a fixed
 * rectangle that does not reflow, so a long property address or a loan type
 * like "30-Year Fixed FHA with Temporary 2-1 Buydown" either clips or leaves a
 * gap. Measuring and wrapping means any value of any length lands correctly.
 * The letterhead is the real Homespire art, so the page still reads as company
 * letterhead rather than as something invented in code.
 *
 * When a compliance approved PDF exists, fill-and-flatten replaces this file
 * and nothing else changes: the loan object is the contract either way.
 *
 * No interest rate appears here, and none is passed in. The pipeline parser
 * drops the column, so there is no rate in memory to leak into a letter.
 */

const LETTER_PAGE = { w: 612, h: 792 };
const LETTER_MARGIN = 60;
const LETTER_BODY_W = LETTER_PAGE.w - LETTER_MARGIN * 2;

const LETTER_ART = {
  logo: "brand/letter-logo.png",
  bandTop: "brand/letter-band-top.png",
  bandBottom: "brand/letter-band-bottom.png",
};

/* Fetched once. Three PNGs re-fetched on every preview would make an already
   slow phone feel broken. */
const artCache = {};
async function letterArt(path) {
  if (!artCache[path]) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Letterhead art missing: ${path}`);
    artCache[path] = await res.arrayBuffer();
  }
  return artCache[path];
}

function letterMoney(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function letterLongDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Greedy wrap against real glyph widths, so nothing runs off the page. */
function wrapText(text, font, size, width) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Down payment and LTV, computed rather than stored so they cannot contradict
 * the numbers they came from. Returned for the editor to display; neither
 * appears on the letter.
 */
function letterDerived(values) {
  const price = Number(values.purchasePrice) || 0;
  const amount = Number(values.loanAmount) || 0;
  if (!price) return { downPayment: null, ltv: null, valid: false };
  const downPayment = price - amount;
  return {
    downPayment,
    ltv: amount / price,
    /* A loan larger than the price is not a rounding quibble, it is a typo
       that would otherwise become a PDF. */
    valid: downPayment >= 0,
  };
}

async function buildLetterPdf(values, officer) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  const PURPLE = rgb(0.322, 0.157, 0.506);
  const INK = rgb(0.09, 0.09, 0.11);
  const MUTED = rgb(0.42, 0.42, 0.46);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([LETTER_PAGE.w, LETTER_PAGE.h]);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const [logoBytes, topBytes, bottomBytes] = await Promise.all([
    letterArt(LETTER_ART.logo),
    letterArt(LETTER_ART.bandTop),
    letterArt(LETTER_ART.bandBottom),
  ]);
  const [logo, bandTop, bandBottom] = await Promise.all([
    pdf.embedPng(logoBytes),
    pdf.embedPng(topBytes),
    pdf.embedPng(bottomBytes),
  ]);

  /* ---------- letterhead ---------- */

  const topH = (LETTER_PAGE.w * bandTop.height) / bandTop.width;
  page.drawImage(bandTop, { x: 0, y: LETTER_PAGE.h - topH, width: LETTER_PAGE.w, height: topH });

  const botH = (LETTER_PAGE.w * bandBottom.height) / bandBottom.width;
  page.drawImage(bandBottom, { x: 0, y: 0, width: LETTER_PAGE.w, height: botH });

  const logoW = 168;
  const logoH = (logoW * logo.height) / logo.width;
  page.drawImage(logo, {
    x: LETTER_MARGIN,
    y: LETTER_PAGE.h - topH - 14 - logoH,
    width: logoW,
    height: logoH,
  });

  /* ---------- a cursor that moves down the page ---------- */

  let y = LETTER_PAGE.h - topH - 14 - logoH - 34;

  const line = (str, { font = body, size = 10.5, color = INK, lead = 14 } = {}) => {
    page.drawText(str, { x: LETTER_MARGIN, y, size, font, color });
    y -= lead;
  };

  const paragraph = (str, { size = 10.5, lead = 14.5, after = 12 } = {}) => {
    for (const l of wrapText(str, body, size, LETTER_BODY_W)) {
      page.drawText(l, { x: LETTER_MARGIN, y, size, font: body, color: INK });
      y -= lead;
    }
    y -= after;
  };

  /* Label left, value right. Both ends are pinned, so a long value grows
     inward rather than colliding with anything. */
  const factRow = (label, value, { emphasis = false } = {}) => {
    const size = 10.5;
    page.drawText(label, { x: LETTER_MARGIN, y, size, font: body, color: MUTED });
    const f = emphasis ? bold : body;
    const w = f.widthOfTextAtSize(value, size);
    page.drawText(value, { x: LETTER_PAGE.w - LETTER_MARGIN - w, y, size, font: f, color: INK });
    y -= 8;
    page.drawLine({
      start: { x: LETTER_MARGIN, y: y + 2 },
      end: { x: LETTER_PAGE.w - LETTER_MARGIN, y: y + 2 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.93),
    });
    y -= 12;
  };

  const bullet = (str) => {
    const size = 10.5;
    const indent = 14;
    page.drawText("•", { x: LETTER_MARGIN + 2, y, size, font: body, color: MUTED });
    for (const l of wrapText(str, body, size, LETTER_BODY_W - indent)) {
      page.drawText(l, { x: LETTER_MARGIN + indent, y, size, font: body, color: INK });
      y -= 14;
    }
  };

  /* ---------- the letter ---------- */

  line("PRE-APPROVAL LETTER", { font: bold, size: 15, color: PURPLE, lead: 20 });
  line(letterLongDate(values.letterDate), { size: 10, color: MUTED, lead: 26 });

  /* The Re: line wraps too. A long enough borrower name would otherwise be the
     one piece of text on the page that runs off the edge. */
  for (const l of wrapText(`Re:  ${values.borrowerName}`, bold, 11, LETTER_BODY_W)) {
    page.drawText(l, { x: LETTER_MARGIN, y, size: 11, font: bold, color: INK });
    y -= 15;
  }
  for (const l of wrapText(`Property:  ${values.propertyAddress}`, body, 10.5, LETTER_BODY_W)) {
    page.drawText(l, { x: LETTER_MARGIN, y, size: 10.5, font: body, color: INK });
    y -= 14;
  }
  y -= 16;

  /* Lender first, deliberately. "Marcus and Dana Whitfield has been approved"
     is wrong, and guessing plurality from a name is a losing game, so the
     sentence is built to have no subject-verb agreement to get wrong. */
  paragraph(
    `Homespire Home Loans has pre-approved ${values.borrowerName} for a ${values.loanType}. ` +
      `This pre-approval follows a full review of credit, income and asset documentation. ` +
      `It is not a pre-qualification.`
  );

  factRow("Pre-approved purchase price, up to", letterMoney(values.purchasePrice), { emphasis: true });
  factRow("Loan amount, up to", letterMoney(values.loanAmount), { emphasis: true });
  factRow("Prepared to close within", `${values.closingDays} days of contract acceptance`);
  factRow("This pre-approval is valid through", letterLongDate(values.expirationDate), { emphasis: true });

  y -= 6;
  paragraph(
    "An appraisal will be ordered within three business days of contract acceptance. Based on the " +
      "documentation reviewed, and absent material changes to the borrower's circumstances, we do not " +
      "anticipate financing issues."
  );

  line("Final approval is subject to:", { font: bold, size: 10.5, lead: 16 });
  bullet("A satisfactory appraisal at or above the purchase price");
  bullet("Clear and marketable title");
  bullet("An executed purchase contract");
  y -= 14;

  paragraph(
    "Please contact me directly with any questions. I am glad to provide updates at any point in the transaction."
  );

  /* ---------- signature ---------- */

  y -= 2;
  line(officer.name || "", { font: bold, size: 11, lead: 13.5 });
  if (officer.title) line(officer.title, { size: 10, color: MUTED, lead: 13 });
  if (officer.nmls) line(`NMLS #${officer.nmls}`, { size: 10, color: MUTED, lead: 13 });
  if (officer.phone) line(officer.phone, { size: 10, color: MUTED, lead: 13 });
  if (officer.email) line(officer.email, { size: 10, color: MUTED, lead: 13 });

  /* ---------- the line that keeps this out of trouble ---------- */

  const disclaimer =
    "This letter is not a commitment to lend and is not an offer of credit. " +
    "Homespire Mortgage Corporation. Equal Housing Lender.";
  let dy = botH + 22;
  for (const l of wrapText(disclaimer, body, 8, LETTER_BODY_W).reverse()) {
    page.drawText(l, { x: LETTER_MARGIN, y: dy, size: 8, font: body, color: MUTED });
    dy += 10;
  }

  return pdf.save();
}

/** A File, because that is what the share sheet takes. */
async function buildLetterFile(values, officer) {
  const bytes = await buildLetterPdf(values, officer);
  const who = (values.borrowerName || "borrower")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return new File([bytes], `preapproval-${who}.pdf`, { type: "application/pdf" });
}

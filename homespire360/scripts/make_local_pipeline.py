"""
Turn a real Encompass export into data/pipeline-local.json for a LOCAL build.

WHAT THIS FILE IS FOR, AND WHAT IT MUST NEVER DO

The output is real borrower data: names, mobile numbers, email addresses,
property addresses, loan amounts. It exists so an LO can see the app running on
her own book before any backend exists. It is gitignored, no-pii-check.py
refuses to ship if it appears in the repo, and the public site never has it.

Data minimisation is deliberate:
  - only the loan officers who actually exist in config.json are included, so a
    31 officer export does not become a 31 officer file
  - the interest rate column is never read, exactly as in the app's own parser
  - nothing is aggregated, reshaped or invented; the rows are the rows

Run: python3 make_local_pipeline.py <export.csv> [output.json]
"""
import csv
import json
import os
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CONFIG = os.path.join(ROOT, "data", "config.json")
DEFAULT_OUT = os.path.join(ROOT, "data", "pipeline-local.json")

# Same names the app's parser uses, so the two cannot drift.
COLS = {
    "loanNumber": "LoanNumber",
    "borrowerName": "BorrowerName",
    "loanOfficer": "LoanOfficer",
    "nmls": "NMLSLoanOriginatorID",
    "milestone": "CurrentMilestone",
    "loanPurpose": "LoanPurpose",
    "loanType": "LoanType",
    "loanAmount": "TotalLoanAmount",
    "estClosingDate": "EstClosingDate",
    "closedDate": "ClosedDate",
    "appraisalOrdered": "AppraisalOrderedDate",
    "rateLockExpires": "RateLockExpires",
    "fundsReleased": "FundingFundsReleased",
    "cdSent": "CDSentDateTime",
    "loanProcessor": "LoanProcessor",
    "channel": "NFMChannelDropdown",
    "purchasePrice": "PurchasePrice",
    "downPaymentAmount": "DownPaymentAmount",
    "appraisedValue": "AppraisedValue",
    "folder": "LoanFolderName",
    "street": "SubjectPropertyStreet",
    "city": "SubjectPropertyCity",
    "stateCode": "SubjectPropertyState",
    "zip": "SubjectPropertyZIP",
    "partner1": "LoanTeamMemberNameLoanPartner1",
    "partner2": "LoanTeamMemberNameLoanPartner2",
    "fileStarted": "DateFileStarted",
    "applicationDate": "GFEApplicationDate",
    "borrowerPhone": "BorrCell",
    "borrowerEmail": "BorrEmail",
}

# Never read. The app drops it at parse time for the same reason: a value that
# is never stored cannot leak through a feature nobody has written yet.
NEVER_READ = ("InterestRate",)


def clean_header(h):
    return h.strip().lstrip("﻿").strip("[]")


def date_only(v):
    v = (v or "").strip()
    return v[:10] if len(v) >= 10 and v[4] == "-" and v[7] == "-" else None


def money(v):
    v = (v or "").replace("$", "").replace(",", "").strip()
    try:
        n = float(v)
    except ValueError:
        return 0
    return int(round(n))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT

    cfg = json.load(open(CONFIG, encoding="utf-8"))
    wanted = {}
    for lo in cfg["los"]:
        nmls = str(lo.get("nmls") or "").strip()
        if nmls:
            wanted[nmls] = lo["name"]
    if not wanted:
        sys.exit("No LO in config.json has an NMLS number, so nothing can be matched.")

    with open(src, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header = [clean_header(h) for h in rows[0]]
    ix = {h: i for i, h in enumerate(header)}

    for banned in NEVER_READ:
        if banned in ix:
            del ix[banned]

    loans = []
    skipped_no_name = 0
    for r in rows[1:]:
        def at(key):
            col = COLS.get(key)
            pos = ix.get(col)
            return "" if pos is None or pos >= len(r) else (r[pos] or "").strip()

        nmls = at("nmls")
        if nmls not in wanted:
            continue
        name = at("borrowerName")
        if not name:
            skipped_no_name += 1
            continue

        address = ", ".join(
            p for p in (
                at("street"),
                ", ".join(x for x in (at("city"), at("stateCode")) if x),
                at("zip"),
            ) if p
        )

        loans.append({
            "loanNumber": at("loanNumber"),
            "borrowerName": name,
            "loanOfficer": at("loanOfficer"),
            "nmls": nmls,
            "milestone": at("milestone"),
            "loanPurpose": at("loanPurpose"),
            "loanType": at("loanType"),
            "loanAmount": money(at("loanAmount")),
            "estClosingDate": date_only(at("estClosingDate")),
            "closedDateRaw": date_only(at("closedDate")),
            "appraisalOrdered": date_only(at("appraisalOrdered")),
            "rateLockExpires": date_only(at("rateLockExpires")),
            "fundsReleased": date_only(at("fundsReleased")),
            "cdSent": date_only(at("cdSent")),
            "loanProcessor": at("loanProcessor"),
            "channel": at("channel"),
            "purchasePrice": money(at("purchasePrice")),
            "downPaymentAmount": money(at("downPaymentAmount")),
            "appraisedValue": money(at("appraisedValue")),
            "propertyAddress": address,
            "folder": at("folder"),
            "fileStarted": date_only(at("fileStarted")),
            "applicationDate": date_only(at("applicationDate")),
            "borrowerPhone": at("borrowerPhone"),
            "borrowerEmail": at("borrowerEmail"),
            "partner1": at("partner1"),
            "partner2": at("partner2"),
            "processorEmail": "",
            "processorPhone": "",
            "loaName": "",
            "loaEmail": "",
            "loaPhone": "",
        })

    payload = {
        "sample": False,
        "local": True,
        "note": "REAL BORROWER DATA. Local build only. Never commit, never publish.",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "sourceFile": os.path.basename(src),
        "loans": loans,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
        f.write("\n")

    # Counts only. Never print a borrower.
    print(f"{len(loans)} rows written to {out_path}")
    if skipped_no_name:
        print(f"  {skipped_no_name} rows skipped for having no borrower name")
    by_lo = {}
    for l in loans:
        key = l["loanOfficer"] or l["nmls"]
        b = by_lo.setdefault(key, {"active": 0, "prospect": 0, "volume": 0})
        if l["folder"] == "Prospects":
            b["prospect"] += 1
        else:
            b["active"] += 1
            b["volume"] += l["loanAmount"]
    for who, b in sorted(by_lo.items()):
        print(f"  {who:<18} {b['active']:>3} active  ${b['volume']:>12,}   {b['prospect']:>4} prospects")
    if any(l.get("fundsReleased") for l in loans):
        print("  some rows carry a funding date")
    else:
        print("  no row carries a funding date, so funded stays at zero")


if __name__ == "__main__":
    main()

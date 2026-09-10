"""
Generate the sample pipeline that ships in this repo.

WHY SYNTHETIC RATHER THAN ANONYMISED

Removing borrower names from a real export is not enough to make it publishable.
What remains is every named loan officer's real book: loan counts, volumes,
closing dates, milestones, real Encompass loan numbers and real rates. On a
public site that is permanent competitive information about the company, and
git history keeps whatever a later commit deletes.

So nothing here comes from a real record. What is copied is the *shape*: the
distribution of loan amounts, the mix of milestones and loan types, how far out
closings sit, and how sparse the optional columns are. The demo looks like a
real pipeline and reveals nothing, because there is nothing to reveal.

Real data still has a path: an LO imports her own export on her own device,
where it stays. That is the only way real loans reach this app.

Run: python3 make_sample_pipeline.py
"""
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "pipeline-sample.json")

random.seed(360)  # regenerating gives the same sample, so diffs stay readable

# Shape lifted from a real export. Numbers, not records.
MILESTONES = (["Started"] * 19) + (["Approval"] * 7) + ["Processing", "Submittal", "Funding", "Docs Signing"]
LOAN_TYPES = (["FHA"] * 9) + (["Conventional"] * 8) + (["VA"] * 3) + ["FarmersHomeAdministration", "Jumbo"]
PURPOSES = (["Purchase"] * 9) + ["Cash-Out Refinance", "NoCash-Out Refinance"]

FIRST = """Adaeze Rosalind Marcus Priya Tobias Yolanda Emeka Bridget Nikolai Simone Darnell Imani
Callum Ravi Beatriz Hakim Louisa Thabo Marisol Grant Oksana Dmitri Camille Theo Anaya Bo
Sunni Quentin Ingrid Malik Renata Otis Freya Jamal Delphine Hector Naomi Soren Wren Cyrus""".split()

LAST = """Okonkwo Whitfield Raghunathan Lindqvist Achebe Fairweather Oyelaran Marsh Castellanos
Nakamura Delacroix Abernathy Vasquez Boateng Kowalczyk Fitzgerald Mbeki Sandoval Ferreira
Halvorsen Adeyemi Winterbourne Espinoza Tanaka Rutherford Olawale Petrov Guzman Ashworth""".split()

PROCESSORS = ["R Alvarez", "T Nakashima", "K Boyd", "M Okafor", "", "", ""]

# Property addresses. Invented streets in real Maryland and Virginia towns, so
# the screen shows a plausible address without pointing at anyone's house.
STREETS = """Larkspur Kettlepond Windham Sable Ridge Amberleaf Quarry Bell Hollow Fenwick
Stillwater Dunmore Highcroft Arrowwood Crestleigh Marbury Thistledown Ravensworth""".split()
STREET_TYPES = ["Ct", "Ln", "Way", "Dr", "Rd", "Ter", "Pl"]
TOWNS = [
    ("Rockville", "MD", "20850"), ("Frederick", "MD", "21702"),
    ("Columbia", "MD", "21044"), ("Bowie", "MD", "20716"),
    ("Sterling", "VA", "20164"), ("Manassas", "VA", "20110"),
    ("Woodbridge", "VA", "22191"), ("Silver Spring", "MD", "20904"),
]


def an_address():
    st = f"{random.randint(100, 9899)} {random.choice(STREETS)} {random.choice(STREET_TYPES)}"
    town, state, zip_code = random.choice(TOWNS)
    return f"{st}, {town}, {state}, {zip_code}"


def a_phone():
    """555-01xx is the reserved fictional range, so no real line can be dialled."""
    return f"(240) 555-01{random.randint(10, 99)}"


def an_email(name):
    handle = "".join(ch for ch in name.split()[0].lower() if ch.isalpha())
    return f"{handle}{random.randint(2, 89)}@example.com"

# Loan officer assistants. Not in today's export either, so the sample supplies
# them and config.json holds their contact details. Sparse on purpose: a file
# with no assistant assigned is normal and the screen has to handle it.
ASSISTANTS = ["J Castellanos", "P Nguyen", "S Abiodun", "", ""]

# The app's own roster. A sample pipeline for someone who is not in the app
# would just be dead rows.
# "loans" is the live book. "closedYtd" is loans already funded earlier in the
# year, which exist only so the funded tiles have something different to say
# when they are flipped from the month to the year. A real export barely carries
# any funded history, so without these the flip would look broken in the demo.
# "prospects" are leads sitting in the Prospects folder. A real Active export is
# overwhelmingly leads, so a sample without them does not exercise the folder
# filters or the prospects note on the tiles.
OFFICERS = [
    {"name": "Amy LeBlanc", "nmls": "1405094", "loans": 9, "closedYtd": 11, "prospects": 24},
    {"name": "Edwin Oquendo", "nmls": "931021", "loans": 7, "closedYtd": 8, "prospects": 19},
    {"name": "Nick Stacy", "nmls": "1756053", "loans": 8, "closedYtd": 9, "prospects": 31},
    {"name": "Demo LO", "nmls": "", "loans": 4, "closedYtd": 3, "prospects": 6},
]


def a_name(used):
    """Mostly individuals, sometimes a couple, occasionally a suffix."""
    while True:
        first, last = random.choice(FIRST), random.choice(LAST)
        roll = random.random()
        if roll < 0.14:
            name = f"{first} and {random.choice(FIRST)} {last}"
        elif roll < 0.20:
            # A comma in a CSV field is the classic parser break, so the sample
            # carries one on purpose.
            name = f"{last}, {first} Jr."
        elif roll < 0.28:
            name = f"{first} {last}-{random.choice(LAST)}"
        else:
            name = f"{first} {last}"
        if name not in used:
            used.add(name)
            return name


def an_amount():
    """
    Matched to the real book's shape rather than invented: median around
    $280k, quartiles near $207k and $368k, a thin tail past $580k. A sample
    full of jumbos would make the screen look wrong to anyone who knows the
    business.
    """
    base = random.lognormvariate(12.55, 0.42)
    return max(45000, int(round(base / 1000) * 1000) + random.randint(-999, 999))


def a_price(loan_amount):
    """
    A plausible purchase price for a given loan amount: LTV between 80% and
    97%, rounded the way a contract price actually looks.
    """
    ltv = random.choice([0.80, 0.85, 0.90, 0.95, 0.9650, 0.97])
    price = loan_amount / ltv
    return int(round(price / 500) * 500)


def enrich(loan, address_odds=0.85, contact_odds=0.8):
    """
    The optional columns, at roughly the density a real export has them.

    Two rules the screens are built against: a stated down payment wins over a
    derived one, and a blank field has to be blank in the sample too, or the
    "not on file yet" state never gets exercised.
    """
    price = loan.get("purchasePrice") or 0
    if price and random.random() < 0.6:
        loan["downPaymentAmount"] = int(round((price - loan["loanAmount"]) / 100) * 100)
    if random.random() < address_odds:
        loan["propertyAddress"] = an_address()
    if random.random() < contact_odds:
        loan["borrowerPhone"] = a_phone()
    if random.random() < contact_odds - 0.1:
        loan["borrowerEmail"] = an_email(loan["borrowerName"])
    if random.random() < 0.3:
        loan["partner1"] = random.choice([p for p in ASSISTANTS if p])
    return loan


def build():
    used = set()
    loans = []
    for officer in OFFICERS:
        for i in range(officer["loans"]):
            # Guarantee a couple of funded loans per officer. Left to chance the
            # sample lands with none, and then the funded state, the one the
            # milestone field gets wrong, never appears in a demo.
            funded = i < 2 and officer["loans"] >= 4
            milestone = "Funding" if funded else random.choice(MILESTONES)
            # Days from "today" at render time, so the sample never goes stale
            # and starts reading as a pile of overdue loans.
            offset = (
                random.randint(-6, -1)
                if funded
                else random.randint(4, 74)
                if milestone == "Started"
                else random.randint(2, 58)
            )

            amount = an_amount()
            purpose = random.choice(PURPOSES)
            loan = {
                "loanNumber": f"7{random.randint(1000000000, 9999999999)}",
                "borrowerName": a_name(used),
                "loanOfficer": officer["name"],
                "nmls": officer["nmls"],
                "milestone": milestone,
                "loanPurpose": purpose,
                "loanType": random.choice(LOAN_TYPES),
                "loanAmount": amount,
                "estClosingOffsetDays": offset,
                "loanProcessor": random.choice(PROCESSORS),
                "loaName": random.choice(ASSISTANTS),
                "channel": "NFM Lending",
                "folder": "My Pipeline",
            }
            # A purchase price above the loan amount, so down payment has
            # something real to derive from. A refinance gets none, which is
            # correct: there is no purchase, and the screen must handle the
            # rows simply being absent.
            if purpose == "Purchase":
                loan["purchasePrice"] = a_price(amount)
            # Optional columns are sparse in a real export, and a screen built
            # against a fully populated sample breaks on the real thing.
            if funded:
                # Anchored to a day of the current month rather than to a day
                # offset, so the month to date tile is never empty when the app
                # is opened in the first week of a month. The loader clamps a
                # day that has not arrived yet back to today.
                day = random.choice([2, 3, 5, 6, 9, 11, 14])
                loan["fundedMonthDay"] = day
                loan["estClosingMonthDay"] = day
                loan.pop("estClosingOffsetDays", None)
            if random.random() < 0.25:
                loan["appraisalOrderedOffsetDays"] = offset - random.randint(14, 40)
            if random.random() < 0.25:
                loan["rateLockOffsetDays"] = offset + random.randint(2, 21)
            if random.random() < 0.12:
                loan["cdSentOffsetDays"] = offset - random.randint(2, 8)
            loan["fileStartedOffsetDays"] = offset - random.randint(30, 70)
            if milestone != "Started":
                loan["applicationOffsetDays"] = offset - random.randint(20, 55)
            loans.append(enrich(loan))

        # Funded earlier in the year. Spread from roughly three weeks back to
        # about eight months back, so the year figure is meaningfully larger
        # than the month figure. Offsets rather than fixed dates means the
        # oldest of these fall out of the year total as the calendar turns,
        # which is what a real year to date should do.
        for _ in range(officer.get("closedYtd", 0)):
            fund_offset = -random.randint(20, 230)
            amount = an_amount()
            purpose = random.choice(PURPOSES)
            closed = {
                "loanNumber": f"7{random.randint(1000000000, 9999999999)}",
                "borrowerName": a_name(used),
                "loanOfficer": officer["name"],
                "nmls": officer["nmls"],
                "milestone": "Funding",
                "loanPurpose": purpose,
                "loanType": random.choice(LOAN_TYPES),
                "loanAmount": amount,
                "estClosingOffsetDays": fund_offset + random.randint(0, 3),
                "fundedOffsetDays": fund_offset,
                "loanProcessor": random.choice(PROCESSORS),
                "loaName": random.choice(ASSISTANTS),
                "channel": "NFM Lending",
                "folder": "My Pipeline",
            }
            if purpose == "Purchase":
                closed["purchasePrice"] = a_price(amount)
            closed["fileStartedOffsetDays"] = fund_offset - random.randint(35, 80)
            closed["applicationOffsetDays"] = fund_offset - random.randint(25, 60)
            loans.append(enrich(closed))

        # Leads. Started, mostly no closing date, a price and a down payment,
        # and a property only sometimes: the shape a real Prospects folder has.
        for _ in range(officer.get("prospects", 0)):
            amount = an_amount()
            purpose = random.choice(PURPOSES)
            lead = {
                "loanNumber": f"7{random.randint(1000000000, 9999999999)}",
                "borrowerName": a_name(used),
                "loanOfficer": officer["name"],
                "nmls": officer["nmls"],
                "milestone": "Started",
                "loanPurpose": purpose,
                "loanType": random.choice(LOAN_TYPES),
                "loanAmount": amount,
                "loanProcessor": "",
                "loaName": random.choice(ASSISTANTS),
                "channel": "NFM Lending",
                "folder": "Prospects",
            }
            if purpose == "Purchase":
                lead["purchasePrice"] = a_price(amount)
            # A lead rarely has a closing date yet.
            if random.random() < 0.08:
                lead["estClosingOffsetDays"] = random.randint(20, 90)
            lead["fileStartedOffsetDays"] = -random.randint(1, 120)
            loans.append(enrich(lead, address_odds=0.35, contact_odds=0.7))

    return {
        "sample": True,
        "note": "Generated by scripts/make_sample_pipeline.py. No real borrower, loan or officer record. Dates are offsets from the day it is viewed.",
        "loans": loans,
    }


if __name__ == "__main__":
    data = build()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    total = sum(l["loanAmount"] for l in data["loans"])
    print(f"{len(data['loans'])} sample loans, ${total:,}")
    for o in OFFICERS:
        mine = [l for l in data["loans"] if l["loanOfficer"] == o["name"]]
        print(f"  {o['name']:<16} {len(mine)} loans  ${sum(l['loanAmount'] for l in mine):,}")

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

# The app's own roster. A sample pipeline for someone who is not in the app
# would just be dead rows.
OFFICERS = [
    {"name": "Amy LeBlanc", "nmls": "1405094", "loans": 9},
    {"name": "Edwin Oquendo", "nmls": "931021", "loans": 7},
    {"name": "Demo LO", "nmls": "", "loans": 4},
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
                random.randint(-11, -1)
                if funded
                else random.randint(4, 74)
                if milestone == "Started"
                else random.randint(2, 58)
            )

            loan = {
                "loanNumber": f"7{random.randint(1000000000, 9999999999)}",
                "borrowerName": a_name(used),
                "loanOfficer": officer["name"],
                "nmls": officer["nmls"],
                "milestone": milestone,
                "loanPurpose": random.choice(PURPOSES),
                "loanType": random.choice(LOAN_TYPES),
                "loanAmount": an_amount(),
                "estClosingOffsetDays": offset,
                "loanProcessor": random.choice(PROCESSORS),
                "channel": "NFM Lending",
            }
            # Optional columns are sparse in a real export, and a screen built
            # against a fully populated sample breaks on the real thing.
            if funded:
                loan["fundedOffsetDays"] = offset - random.randint(0, 3)
            if random.random() < 0.25:
                loan["appraisalOrderedOffsetDays"] = offset - random.randint(14, 40)
            if random.random() < 0.25:
                loan["rateLockOffsetDays"] = offset + random.randint(2, 21)
            if random.random() < 0.12:
                loan["cdSentOffsetDays"] = offset - random.randint(2, 8)
            loans.append(loan)

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

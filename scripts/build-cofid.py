"""Convert McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID) into public/cofid.json.

Download the workbook from
https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
then run:

    uv run --with openpyxl scripts/build-cofid.py McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx

Contains public sector information licensed under the Open Government Licence v3.0.
"""

import json
import sys
from pathlib import Path

import openpyxl

# (sheet, CoFID column code(s), our nutrient key, factor from the CoFID unit to grams; energy stays in kcal).
# When several codes are listed, the first one with a value wins.
COLUMNS = [
    ("1.3 Proximates", ["KCALS"], "energy-kcal", 1),
    ("1.3 Proximates", ["FAT"], "fat", 1),
    ("1.3 Proximates", ["SATFOD"], "saturated-fat", 1),
    ("1.3 Proximates", ["MONOFOD"], "monounsaturated-fat", 1),
    ("1.3 Proximates", ["POLYFOD"], "polyunsaturated-fat", 1),
    ("1.3 Proximates", ["TOTn3PFOD"], "omega-3-fat", 1),
    ("1.3 Proximates", ["TOTn6PFOD"], "omega-6-fat", 1),
    ("1.3 Proximates", ["FODTRANS"], "trans-fat", 1),
    ("1.3 Proximates", ["CHOL"], "cholesterol", 1e-3),
    ("1.3 Proximates", ["CHO"], "carbohydrates", 1),
    ("1.3 Proximates", ["TOTSUG"], "sugars", 1),
    ("1.3 Proximates", ["STAR"], "starch", 1),
    # UK labels use AOAC fibre; older foods only have NSP (Englyst) fibre.
    ("1.3 Proximates", ["AOACFIB", "ENGFIB"], "fiber", 1),
    ("1.3 Proximates", ["PROT"], "proteins", 1),
    ("1.4 Inorganics", ["NA"], "sodium", 1e-3),
    ("1.4 Inorganics", ["K"], "potassium", 1e-3),
    ("1.4 Inorganics", ["CA"], "calcium", 1e-3),
    ("1.4 Inorganics", ["MG"], "magnesium", 1e-3),
    ("1.4 Inorganics", ["P"], "phosphorus", 1e-3),
    ("1.4 Inorganics", ["FE"], "iron", 1e-3),
    ("1.4 Inorganics", ["CU"], "copper", 1e-3),
    ("1.4 Inorganics", ["ZN"], "zinc", 1e-3),
    ("1.4 Inorganics", ["CL"], "chloride", 1e-3),
    ("1.4 Inorganics", ["MN"], "manganese", 1e-3),
    ("1.4 Inorganics", ["SE"], "selenium", 1e-6),
    ("1.4 Inorganics", ["I"], "iodine", 1e-6),
    ("1.5 Vitamins", ["RETEQU"], "vitamin-a", 1e-6),
    ("1.5 Vitamins", ["VITD"], "vitamin-d", 1e-6),
    ("1.5 Vitamins", ["VITE"], "vitamin-e", 1e-3),
    ("1.5 Vitamins", ["VITK1"], "vitamin-k", 1e-6),
    ("1.5 Vitamins", ["THIA"], "vitamin-b1", 1e-3),
    ("1.5 Vitamins", ["RIBO"], "vitamin-b2", 1e-3),
    ("1.5 Vitamins", ["NIACEQU", "NIAC"], "vitamin-pp", 1e-3),
    ("1.5 Vitamins", ["PANTO"], "pantothenic-acid", 1e-3),
    ("1.5 Vitamins", ["VITB6"], "vitamin-b6", 1e-3),
    ("1.5 Vitamins", ["BIOT"], "biotin", 1e-6),
    ("1.5 Vitamins", ["FOLT"], "vitamin-b9", 1e-6),
    ("1.5 Vitamins", ["VITB12"], "vitamin-b12", 1e-6),
    ("1.5 Vitamins", ["VITC"], "vitamin-c", 1e-3),
]


def parse(value):
    """CoFID uses 'Tr' for trace amounts and 'N' for present-but-unmeasured."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value = value.strip()
    if value == "Tr":
        return 0.0
    try:
        return float(value)
    except ValueError:
        return None


def read_sheet(wb, name):
    rows = wb[name].iter_rows(values_only=True)
    next(rows)  # human-readable headers
    codes = next(rows)  # CoFID column codes
    next(rows)  # long names
    data = {}
    for row in rows:
        if row[0] and row[1]:
            data[row[0].strip()] = {
                "name": row[1].strip(),
                "group": (row[3] or "").strip(),
                **{code: row[i] for i, code in enumerate(codes) if code},
            }
    return data


def main(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    sheets = {name: read_sheet(wb, name) for name in {c[0] for c in COLUMNS}}
    keys = [c[2] for c in COLUMNS]
    foods = []
    for code, base in sheets["1.3 Proximates"].items():
        values = []
        for sheet, cofid_codes, _key, _factor in COLUMNS:
            row = sheets[sheet].get(code, {})
            values.append(next((v for c in cofid_codes if (v := parse(row.get(c))) is not None), None))
        if values[0] is None:  # no energy value
            continue
        alcohol = parse(base.get("ALCO")) or 0
        # Alcoholic drinks are given per 100 ml in CoFID.
        basis = "ml" if base["group"].startswith("Q") and alcohol > 0 else "g"
        foods.append([code, base["name"], basis, [None if v is None else round(v, 4) for v in values]])
    out = {
        "source": "McCance and Widdowson's Composition of Foods Integrated Dataset 2021",
        "licence": "Contains public sector information licensed under the Open Government Licence v3.0.",
        "keys": keys,
        "toGrams": [c[3] for c in COLUMNS],
        "foods": foods,
    }
    path = Path(__file__).resolve().parent.parent / "public" / "cofid.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote {len(foods)} foods to {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])

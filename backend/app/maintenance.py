"""Mileage- and date-aware maintenance status (contract section 4)."""
from __future__ import annotations

import re
from datetime import date, timedelta

LABELS = {
    "oil_change": "Oil change",
    "oil_filter": "Oil filter",
    "air_filter": "Air filter",
    "brake_pads": "Brake pads",
    "tires": "Tires",
    "battery": "Battery",
    "lights": "Lights",
    "wipers": "Wipers",
    "other": "Other",
}

# part -> (interval_days, interval_km or None)
INTERVALS = {
    "oil_change": (180, 10_000),
    "oil_filter": (180, 10_000),
    "air_filter": (365, 20_000),
    "brake_pads": (730, 40_000),
    "tires": (1095, 50_000),
    "battery": (1095, None),
}

DUE_SOON_DAYS = 21
DUE_SOON_KM = 1000

# Title-based recognition is only used for legacy records (no treatment_type) and records explicitly
# classified "Other". It is deliberately conservative: a phrase must clearly describe replacing/servicing
# the item, and known look-alikes (leaks, sensors, pressure checks, rotation...) are excluded.
_OIL_EXCL = re.compile(r"\b(?:leak\w*|pressure|sensor|cooler|seal|gasket|pan|dipstick|warning)\b")
_TIRE_EXCL = re.compile(r"\b(?:pressure|rotat\w*|puncture\w*|repair\w*|balanc\w*|align\w*|valve|sensor|patch\w*)\b")
_BATT_EXCL = re.compile(r"\b(?:terminals?|cables?|charg\w*|test\w*|clean\w*|jump\w*)\b")

_RULES = [
    # (include, exclude, categories)
    (re.compile(r"\boil\s*(?:and|&|\+|/)\s*(?:oil\s+)?filters?\b|\boil\s+change\s*(?:and|&|\+|with)\s*(?:the\s+|new\s+)?filters?\b"),
     _OIL_EXCL, ("oil_change", "oil_filter")),
    (re.compile(r"\boil\s+filters?\b"), None, ("oil_filter",)),
    (re.compile(
        r"\b(?:engine\s+)?oil\s+(?:change|changed|service|replacement)\b"
        r"|\bchang(?:e|ed)\s+(?:the\s+)?(?:engine\s+)?oil\b"
        r"|^\s*(?:engine\s+)?oil\s*$"),
     _OIL_EXCL, ("oil_change",)),
    (re.compile(r"\b(?:air|cabin|pollen)\s+filters?\b"), None, ("air_filter",)),
    (re.compile(
        r"\bbrake\s+pads?\b|\bbrake\s+shoes?\b"
        r"|\bbrakes?\s+(?:service|replacement|replaced|change|changed)\b|\bnew\s+brakes\b|^\s*brakes?\s*$"),
     None, ("brake_pads",)),
    (re.compile(r"\b(?:tires?|tyres?)\b"), _TIRE_EXCL, ("tires",)),
    (re.compile(r"\bbatter(?:y|ies)\b"), _BATT_EXCL, ("battery",)),
]

_STATUS_RANK = {"ok": 0, "due_soon": 1, "overdue": 2}


def label_for(treatment_type: str | None) -> str:
    if not treatment_type:
        return LABELS["other"]
    return LABELS.get(treatment_type) or treatment_type.replace("_", " ").capitalize()


def _legacy_parts(title: str | None, parts: str | None) -> set[str]:
    found: set[str] = set()
    chunks = [title or ""] + [p for p in (parts or "").split(",")]
    for chunk in chunks:
        c = chunk.strip().lower()
        if not c:
            continue
        for include, exclude, keys in _RULES:
            if include.search(c) and not (exclude and exclude.search(c)):
                found.update(keys)
    return found


def records_parts(rec) -> set[str]:
    """Tracked parts a record counts towards."""
    tt = (rec.treatment_type or "").strip()
    if tt and tt != "other":
        return {tt} if tt in INTERVALS else set()
    # no type, or the generic "Other" with a custom title like "Brake pads replaced"
    return _legacy_parts(rec.title, rec.parts_replaced)


def category(rec) -> str:
    """Single bucket for reporting (expenses): a tracked part if one is recognised, else the stored type."""
    parts = sorted(records_parts(rec))
    if parts:
        return parts[0]
    return (rec.treatment_type or "").strip() or "other"


def happened(records, today: date | None = None) -> list:
    """Services whose date has arrived. Future-dated entries are scheduled work: they are kept and
    shown, but they are not a maintenance baseline and their odometer is not a current reading."""
    today = today or date.today()
    return [r for r in records if r.service_date <= today]


def current_km(records, today: date | None = None) -> int | None:
    """Highest odometer reading found in (already happened) service records."""
    vals = [r.odometer_km for r in happened(records, today) if r.odometer_km is not None]
    return max(vals) if vals else None


def effective_km(records, manual_km: int | None = None, today: date | None = None) -> int | None:
    """The vehicle's current odometer: the highest of the manual reading and all service readings.
    Every km-based calculation (due km, remaining km, garage odometer) goes through this."""
    vals = [v for v in (current_km(records, today), manual_km) if v is not None]
    return max(vals) if vals else None


def baseline_key(rec):
    """Deterministic ordering of same-category records: date, then higher odometer, then entry id.
    On a single day the reading with the higher odometer is the later one."""
    return (rec.service_date, rec.odometer_km if rec.odometer_km is not None else -1, rec.id or 0)


def compute(records, today: date | None = None, manual_km: int | None = None) -> list[dict]:
    today = today or date.today()
    records = happened(records, today)
    km_now = effective_km(records, manual_km, today)
    last: dict[str, object] = {}
    for r in sorted(records, key=baseline_key):
        for part in records_parts(r):
            last[part] = r  # later wins

    out = []
    for part, (days, km_int) in INTERVALS.items():
        rec = last.get(part)
        item = {
            "part": part,
            "label": LABELS[part],
            "last_service_date": None,
            "last_service_km": None,
            "due_date": None,
            "due_km": None,
            "remaining_days": None,
            "remaining_km": None,
            "progress": 0.0,
            "status": "unknown",
        }
        if rec is None:
            out.append(item)
            continue
        last_date = rec.service_date
        last_km = rec.odometer_km
        due_date = last_date + timedelta(days=days)
        remaining_days = (due_date - today).days
        due_km = remaining_km = None
        if km_int and last_km is not None:
            due_km = last_km + km_int
            if km_now is not None:
                remaining_km = due_km - km_now

        overdue = remaining_days < 0 or (remaining_km is not None and remaining_km < 0)
        soon = remaining_days <= DUE_SOON_DAYS or (remaining_km is not None and remaining_km <= DUE_SOON_KM)
        status = "overdue" if overdue else ("due_soon" if soon else "ok")

        prog = max(0.0, (today - last_date).days / days)
        if km_int and last_km is not None and km_now is not None:
            prog = max(prog, max(0, km_now - last_km) / km_int)
        prog = round(min(1.0, max(0.0, prog)), 4)

        item.update(
            last_service_date=last_date,
            last_service_km=last_km,
            due_date=due_date,
            due_km=due_km,
            remaining_days=remaining_days,
            remaining_km=remaining_km,
            progress=prog,
            status=status,
        )
        out.append(item)
    return out


def coverage(items: list[dict]) -> dict:
    """How many tracked categories have any service history."""
    return {"tracked": len(items), "known": sum(1 for i in items if i["status"] in _STATUS_RANK)}


def overall(items: list[dict]) -> tuple[str, dict | None]:
    """Overall vehicle status + the most urgent item.

    * any overdue / due-soon item always wins (urgent work is never hidden by missing data);
    * otherwise "ok" only when at least half of the tracked categories have history;
    * otherwise "unknown" (insufficient data) - never a misleading "all good".
    """
    known = [i for i in items if i["status"] in _STATUS_RANK]
    if not known:
        return "unknown", None
    worst = max(_STATUS_RANK[i["status"]] for i in known)
    cands = [i for i in known if _STATUS_RANK[i["status"]] == worst]
    cands.sort(key=lambda i: (i["due_date"] or date.max, i["part"]))
    top = cands[0]
    urgent = {"item": top["part"], "status": top["status"], "due_date": top["due_date"], "due_km": top["due_km"]}
    if worst == 0 and len(known) * 2 < len(items):
        return "unknown", urgent
    status = [k for k, v in _STATUS_RANK.items() if v == worst][0]
    return status, urgent

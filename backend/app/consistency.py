"""Non-blocking data-consistency warnings for a vehicle's service history.

These never reject input: historical corrections and legitimate exceptions must stay possible.
Hard integrity rules (negative values, absurd bounds, empty titles) live in the schemas/routers.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date

from . import maintenance

SAME_DAY_KM_TOLERANCE = 1000      # two readings on one day further apart than this look wrong
SAME_CATEGORY_KM_TOLERANCE = 100  # same maintenance category, same day: readings should agree closely
MAX_PLAUSIBLE_KM_PER_DAY = 1500   # average distance between consecutive readings
LARGE_JUMP_KM = 50_000            # manual odometer far above anything known


def _fmt_date(d: date) -> str:
    return d.strftime("%d %b %Y").lstrip("0")


def _km(n: int) -> str:
    return f"{n:,} km"


def _warning(code: str, message: str, record_ids=()) -> dict:
    return {"code": code, "message": message, "record_ids": sorted({i for i in record_ids if i is not None})}


def check(records, car=None, today: date | None = None) -> list[dict]:
    """Return a list of {code, message, record_ids} describing suspicious (but possible) data."""
    today = today or date.today()
    out: list[dict] = []

    # -- date based checks -----------------------------------------------------------------------
    seen = defaultdict(list)
    for r in records:
        title = r.title or "Service"
        if r.service_date > today:
            out.append(
                _warning(
                    "future_date",
                    f"\"{title}\" is dated {_fmt_date(r.service_date)}, which is in the future. "
                    "It is saved as scheduled, but it is not counted for maintenance status until that date.",
                    [r.id],
                )
            )
        if car is not None and car.year and r.service_date.year < car.year:
            out.append(
                _warning(
                    "before_model_year",
                    f"\"{title}\" is dated {_fmt_date(r.service_date)}, before this vehicle's model year ({car.year}).",
                    [r.id],
                )
            )
        key = (r.service_date, (r.treatment_type or "").lower(), (title or "").strip().lower(), int(r.cost or 0))
        seen[key].append(r)
    for (d, _t, _title, _c), group in seen.items():
        if len(group) > 1:
            out.append(
                _warning(
                    "possible_duplicate",
                    f"\"{group[0].title}\" appears {len(group)} times on {_fmt_date(d)} with the same cost - "
                    "possible duplicate entry.",
                    [g.id for g in group],
                )
            )

    # -- odometer checks -------------------------------------------------------------------------
    # same category, same day, different readings: the higher one is used as the baseline
    by_cat_day: dict = defaultdict(list)
    for r in maintenance.happened(records, today):
        if r.odometer_km is None:
            continue
        for part in maintenance.records_parts(r):
            by_cat_day[(part, r.service_date)].append(r)
    for (part, d), group in by_cat_day.items():
        kms = [int(g.odometer_km) for g in group]
        if len(group) > 1 and max(kms) - min(kms) >= SAME_CATEGORY_KM_TOLERANCE:
            out.append(
                _warning(
                    "same_day_category_mismatch",
                    f"{len(group)} {maintenance.LABELS.get(part, part).lower()} entries on {_fmt_date(d)} have "
                    f"different readings ({', '.join(_km(k) for k in sorted(set(kms)))}). "
                    f"The higher reading ({_km(max(kms))}) is used as the baseline.",
                    [g.id for g in group],
                )
            )

    # future-dated entries are scheduled work, not odometer evidence
    points = [
        (r.service_date, int(r.odometer_km), r.id, r.title or "Service")
        for r in maintenance.happened(records, today)
        if r.odometer_km is not None
    ]
    manual = getattr(car, "odometer_km", None) if car is not None else None
    if manual is not None:
        mdate = getattr(car, "odometer_updated_at", None) or today
        points.append((mdate, int(manual), None, "your current odometer entry"))

    by_date: dict[date, list] = defaultdict(list)
    for p in points:
        by_date[p[0]].append(p)

    prev_max = None  # (date, km, id, title) with the highest km seen on earlier dates
    prev_group_date = None
    for d in sorted(by_date):
        group = by_date[d]
        lo, hi = min(group, key=lambda p: p[1]), max(group, key=lambda p: p[1])
        if len(group) > 1 and hi[1] - lo[1] >= SAME_DAY_KM_TOLERANCE:
            out.append(
                _warning(
                    "same_day_mismatch",
                    f"Readings on {_fmt_date(d)} differ by {_km(hi[1] - lo[1])} "
                    f"(\"{lo[3]}\": {_km(lo[1])} vs \"{hi[3]}\": {_km(hi[1])}). One of them may be a typo.",
                    [p[2] for p in group],
                )
            )
        if prev_max is not None:
            for p in group:
                if p[1] < prev_max[1]:
                    manual_involved = p[2] is None
                    out.append(
                        _warning(
                            "manual_regression" if manual_involved else "odometer_regression",
                            f"\"{p[3]}\" ({_fmt_date(p[0])}) shows {_km(p[1])}, lower than {_km(prev_max[1])} "
                            f"recorded earlier on {_fmt_date(prev_max[0])} (\"{prev_max[3]}\"). "
                            "The odometer normally only goes up - check both readings.",
                            [p[2], prev_max[2]],
                        )
                    )
            gap_days = (d - prev_group_date).days
            if gap_days >= 1 and hi[1] > prev_max[1]:
                per_day = (hi[1] - prev_max[1]) / gap_days
                if per_day > MAX_PLAUSIBLE_KM_PER_DAY:
                    out.append(
                        _warning(
                            "implausible_distance",
                            f"{_km(hi[1] - prev_max[1])} in {gap_days} day{'s' if gap_days != 1 else ''} between "
                            f"\"{prev_max[3]}\" and \"{hi[3]}\" looks too far to drive. Check the dates or readings.",
                            [hi[2], prev_max[2]],
                        )
                    )
        if prev_max is None or hi[1] >= prev_max[1]:
            prev_max = hi
        prev_group_date = d

    return out


def for_record(warnings: list[dict], record_id: int) -> list[dict]:
    return [w for w in warnings if record_id in w["record_ids"]]

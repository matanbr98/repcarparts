from datetime import date

from ..errors import bad_field


def parse_date(value: str | None, field: str, required: bool = False, bounds: bool = False) -> date | None:
    if value is None or str(value).strip() == "":
        if required:
            raise bad_field(field, "Date is required (YYYY-MM-DD)")
        return None
    try:
        parsed = date.fromisoformat(str(value).strip())
    except ValueError:
        raise bad_field(field, "Invalid date, expected YYYY-MM-DD")
    if bounds:
        from ..schemas import check_service_date

        try:
            check_service_date(parsed)
        except ValueError as e:
            raise bad_field(field, str(e))
    return parsed

from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]{3,40}$"
TREATMENT_TYPES = ("oil_change", "oil_filter", "air_filter", "brake_pads", "battery", "tires", "lights", "wipers", "other")


MAX_KM = 3_000_000          # odometer upper bound (matches the manual odometer endpoint)
MAX_COST = 100_000_000      # whole currency units; keeps values inside SQLite's INTEGER range
MIN_SERVICE_YEAR = 1900
FUTURE_DATE_TOLERANCE_DAYS = 366


def check_service_date(d):
    """Hard bounds only: absurd dates are typos. Plausible future dates are allowed (and warned about)."""
    if d is None:
        return d
    if d.year < MIN_SERVICE_YEAR:
        raise ValueError(f"Date is too far in the past (before {MIN_SERVICE_YEAR}).")
    if d > date.today() + timedelta(days=FUTURE_DATE_TOLERANCE_DAYS):
        raise ValueError("Date is more than a year in the future. Check the year.")
    return d


def _strip_required(v):
    if isinstance(v, str):
        v = v.strip()
    return v


def _clean_type(v):
    if v is None:
        return None
    v = str(v).strip()
    if not v:
        return None
    if v not in TREATMENT_TYPES:
        raise ValueError("Unknown treatment type; allowed: " + ", ".join(TREATMENT_TYPES))
    return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_image_url: Optional[str] = None
    must_change_password: bool = False

    @field_validator("must_change_password", mode="before")
    @classmethod
    def _none_false(cls, v):
        return bool(v)


class RegisterRequest(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    username: str = Field(max_length=80)
    password: str = Field(max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    must_change_password: bool = False


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class CarCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    make: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    year: Optional[int] = Field(None, ge=1886, le=2100)
    license_plate: Optional[str] = Field(None, max_length=20)


class CarUpdate(BaseModel):
    nickname: Optional[str] = Field(None, min_length=1, max_length=80)
    make: Optional[str] = Field(None, min_length=1, max_length=80)
    model: Optional[str] = Field(None, min_length=1, max_length=80)
    year: Optional[int] = Field(None, ge=1886, le=2100)
    license_plate: Optional[str] = Field(None, max_length=20)


class CarOut(CarCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int] = None


class ServiceRecordCreate(BaseModel):
    service_date: date
    odometer_km: Optional[int] = Field(None, ge=0, le=MAX_KM)
    title: str = Field(min_length=1, max_length=120)
    treatment_type: Optional[str] = None
    position: Optional[str] = Field(None, max_length=30)
    tire_position: Optional[str] = Field(None, max_length=30)
    tires_count: Optional[int] = Field(None, ge=0, le=20)
    parts_replaced: Optional[str] = Field(None, max_length=255)
    cost: Optional[int] = Field(0, ge=0, le=MAX_COST)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("title", mode="before")
    @classmethod
    def _title_strip(cls, v):
        return _strip_required(v)

    @field_validator("service_date")
    @classmethod
    def _date_bounds(cls, v):
        return check_service_date(v)


class ServiceRecordUpdate(BaseModel):
    service_date: Optional[date] = None
    odometer_km: Optional[int] = Field(None, ge=0, le=MAX_KM)
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    treatment_type: Optional[str] = None
    position: Optional[str] = Field(None, max_length=30)
    tire_position: Optional[str] = Field(None, max_length=30)
    tires_count: Optional[int] = Field(None, ge=0, le=20)
    parts_replaced: Optional[str] = Field(None, max_length=255)
    cost: Optional[int] = Field(None, ge=0, le=MAX_COST)
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("title", mode="before")
    @classmethod
    def _title_strip(cls, v):
        return _strip_required(v)

    @field_validator("service_date")
    @classmethod
    def _date_bounds(cls, v):
        return check_service_date(v)

    @field_validator("treatment_type")
    @classmethod
    def _tt(cls, v):
        return _clean_type(v)


class ConsistencyWarning(BaseModel):
    code: str
    message: str
    record_ids: list[int] = []


class ServiceRecordOut(ServiceRecordCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    car_id: int
    image_url: Optional[str] = None
    # Legacy rows may hold free-text / odd values; never fail a response because of stored data.
    title: str = ""
    service_date: date
    odometer_km: Optional[int] = None
    cost: Optional[int] = 0
    notes: Optional[str] = None
    treatment_type: Optional[str] = None
    # Only populated on create/update responses: non-blocking data-quality hints for this record.
    warnings: list[ConsistencyWarning] = []


class StatsOut(BaseModel):
    users: int
    cars: int
    records: int
    total_cost: int


class PartAverageOut(BaseModel):
    part: str
    avg_cost: float
    count: int


class CarCostOut(BaseModel):
    car_id: int
    total_cost: int


class UserCostSummaryOut(BaseModel):
    total_cost: int
    by_car: list[CarCostOut]


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_user_id: int
    user_id: int
    car_id: Optional[int] = None
    title: str
    message: str
    due_date: Optional[date] = None
    created_at: date
    image_url: Optional[str] = None
    done: bool = False
    done_at: Optional[date] = None
    car_label: Optional[str] = None
    source: str = "manager"

    @field_validator("done", mode="before")
    @classmethod
    def _done(cls, v):
        return bool(v)

    @field_validator("source", mode="before")
    @classmethod
    def _source(cls, v):
        return v or "manager"


class SelfReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    message: Optional[str] = Field(None, max_length=2000)
    due_date: Optional[date] = None
    car_id: Optional[int] = None


class ReminderPatch(BaseModel):
    done: bool


class MaintenanceDueOut(BaseModel):
    part: str
    label: Optional[str] = None
    last_service_date: Optional[date] = None
    last_service_km: Optional[int] = None
    due_date: Optional[date] = None
    due_km: Optional[int] = None
    remaining_days: Optional[int] = None
    remaining_km: Optional[int] = None
    progress: float = 0.0
    status: str  # "ok" | "due_soon" | "overdue" | "unknown"


class ExpenseByType(BaseModel):
    treatment_type: str
    label: str
    total: int
    count: int


class ExpenseByMonth(BaseModel):
    month: str
    total: int


class ExpensesOut(BaseModel):
    total: int
    year_total: int
    records_count: int
    by_type: list[ExpenseByType]
    by_month: list[ExpenseByMonth]


class MostUrgent(BaseModel):
    item: str
    status: str
    due_date: Optional[date] = None
    due_km: Optional[int] = None


class OdometerIn(BaseModel):
    odometer_km: int = Field(ge=0, le=3_000_000)


class OdometerOut(BaseModel):
    warnings: list[ConsistencyWarning] = []
    odometer_km: Optional[int] = None          # effective current reading
    source: Optional[str] = None               # "manual" | "service" | None
    manual_km: Optional[int] = None
    manual_updated_at: Optional[date] = None
    last_record_km: Optional[int] = None       # highest reading among service records


class Coverage(BaseModel):
    tracked: int
    known: int


class CarOverviewOut(BaseModel):
    status: str  # "ok" | "due_soon" | "overdue" | "unknown" (unknown = insufficient data)
    coverage: Coverage
    most_urgent: Optional[MostUrgent] = None
    odometer: OdometerOut
    warnings: list[ConsistencyWarning] = []


class GarageCar(CarOut):
    odometer_km: Optional[int] = None
    coverage: Optional[Coverage] = None
    last_service_date: Optional[date] = None
    total_cost: int = 0
    records_count: int = 0
    status: str = "unknown"
    most_urgent: Optional[MostUrgent] = None


class GarageSummary(BaseModel):
    cars: int
    services_this_year: int
    spend_this_year: int
    spend_total: int


class GarageOut(BaseModel):
    summary: GarageSummary
    cars: list[GarageCar]


def validate_treatment_type(v):
    """Used by multipart endpoints (returns cleaned value or raises ValueError)."""
    return _clean_type(v)

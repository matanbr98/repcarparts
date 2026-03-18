from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True

class RegisterRequest(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CarCreate(BaseModel):
    nickname: str
    make: str
    model: str
    year: Optional[int] = None
    license_plate: Optional[str] = None

class CarOut(CarCreate):
    id: int
    user_id: Optional[int] = None
    class Config:
        from_attributes = True

class ServiceRecordCreate(BaseModel):
    service_date: date
    odometer_km: Optional[int] = None
    title: str
    treatment_type: Optional[str] = None
    position: Optional[str] = None
    tire_position: Optional[str] = None
    tires_count: Optional[int] = None
    parts_replaced: Optional[str] = None
    cost: Optional[int] = 0
    notes: Optional[str] = None

class ServiceRecordUpdate(BaseModel):
    service_date: Optional[date] = None
    odometer_km: Optional[int] = None
    title: Optional[str] = None
    treatment_type: Optional[str] = None
    position: Optional[str] = None
    tire_position: Optional[str] = None
    tires_count: Optional[int] = None
    parts_replaced: Optional[str] = None
    cost: Optional[int] = None
    notes: Optional[str] = None

class ServiceRecordOut(ServiceRecordCreate):
    id: int
    car_id: int
    image_url: Optional[str] = None
    class Config:
        from_attributes = True

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

class CreateReminderRequest(BaseModel):
    title: str
    message: str
    # if broadcast_all_users=True, ignore target_user_id
    broadcast_all_users: bool = False
    target_user_id: Optional[int] = None
    target_car_id: Optional[int] = None
    due_date: Optional[date] = None

class ReminderOut(BaseModel):
    id: int
    created_by_user_id: int
    user_id: int
    car_id: Optional[int] = None
    title: str
    message: str
    due_date: Optional[date] = None
    created_at: date
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class MaintenanceDueOut(BaseModel):
    part: str
    last_service_date: Optional[date] = None
    due_date: Optional[date] = None
    status: str  # "ok" | "due_soon" | "overdue" | "unknown"
from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # "user" | "manager"
    name = Column(String(120), nullable=True)
    phone = Column(String(40), nullable=True)
    email = Column(String(120), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    must_change_password = Column(Boolean, nullable=False, default=False, server_default="0")
    pwd_version = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(Date, nullable=True)

    cars = relationship("Car", back_populates="user", cascade="all, delete-orphan")


class Car(Base):
    __tablename__ = "cars"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    nickname = Column(String(80), nullable=False)
    make = Column(String(80), nullable=False)
    model = Column(String(80), nullable=False)
    year = Column(Integer, nullable=True)
    license_plate = Column(String(20), nullable=True)
    # Manually entered current odometer (independent of service logs); see maintenance.effective_km
    odometer_km = Column(Integer, nullable=True)
    odometer_updated_at = Column(Date, nullable=True)

    service_records = relationship("ServiceRecord", back_populates="car", cascade="all, delete-orphan")
    user = relationship("User", back_populates="cars")


class ServiceRecord(Base):
    __tablename__ = "service_records"
    id = Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    image_url = Column(String(255), nullable=True)
    service_date = Column(Date, nullable=False)
    odometer_km = Column(Integer, nullable=True)
    title = Column(String(120), nullable=False)
    treatment_type = Column(String(60), nullable=True)
    position = Column(String(30), nullable=True)
    tire_position = Column(String(30), nullable=True)
    tires_count = Column(Integer, nullable=True)
    parts_replaced = Column(String(255), nullable=True)
    cost = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(Date, nullable=True)

    car = relationship("Car", back_populates="service_records")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=True, index=True)

    title = Column(String(120), nullable=False)
    message = Column(Text, nullable=False)
    due_date = Column(Date, nullable=True)
    created_at = Column(Date, nullable=False)
    image_url = Column(String(255), nullable=True)
    done = Column(Boolean, nullable=False, default=False, server_default="0")
    done_at = Column(Date, nullable=True)
    source = Column(String(10), nullable=False, default="manager", server_default="manager")

    car = relationship("Car", lazy="joined")

    @property
    def car_label(self):
        c = self.car
        if not c:
            return None
        return f"{c.nickname} ({c.make} {c.model})"

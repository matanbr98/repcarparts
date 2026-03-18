from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text
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

    service_records = relationship("ServiceRecord", back_populates="car", cascade="all, delete-orphan")
    user = relationship("User", back_populates="cars")

class ServiceRecord(Base):
    __tablename__ = "service_records"
    id = Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    image_url = Column(String(255), nullable=True) # Path to the stored photo
    service_date = Column(Date, nullable=False)
    odometer_km = Column(Integer, nullable=True)
    title = Column(String(120), nullable=False)     # e.g., "Annual Service"
    treatment_type = Column(String(60), nullable=True)  # e.g., "oil_change", "tires"
    position = Column(String(30), nullable=True)  # e.g., "front" | "rear" | "all"
    tire_position = Column(String(30), nullable=True)  # e.g., "front_left"
    tires_count = Column(Integer, nullable=True)
    parts_replaced = Column(String(255), nullable=True) # e.g., "Oil filter, Brake pads"
    cost = Column(Integer, default=0)               # Store as whole numbers for now
    notes = Column(Text, nullable=True)

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

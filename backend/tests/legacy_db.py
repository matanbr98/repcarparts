"""Builds a v1 (legacy) SQLite database, exactly as the pre-upgrade app laid it out."""
import sqlite3
from pathlib import Path

from passlib.context import CryptContext

_ctx = CryptContext(schemes=["pbkdf2_sha256"])

LEGACY_DDL = """
CREATE TABLE users (
  id INTEGER PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL, name VARCHAR(120), phone VARCHAR(40), email VARCHAR(120),
  profile_image_url VARCHAR(255));
CREATE TABLE cars (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), nickname VARCHAR(80) NOT NULL,
  make VARCHAR(80) NOT NULL, model VARCHAR(80) NOT NULL, year INTEGER, license_plate VARCHAR(20));
CREATE TABLE service_records (
  id INTEGER PRIMARY KEY, car_id INTEGER NOT NULL REFERENCES cars(id), image_url VARCHAR(255),
  service_date DATE NOT NULL, odometer_km INTEGER, title VARCHAR(120) NOT NULL,
  treatment_type VARCHAR(60), position VARCHAR(30), tire_position VARCHAR(30), tires_count INTEGER,
  parts_replaced VARCHAR(255), cost INTEGER, notes TEXT);
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY, created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  user_id INTEGER NOT NULL REFERENCES users(id), car_id INTEGER REFERENCES cars(id),
  title VARCHAR(120) NOT NULL, message TEXT NOT NULL, due_date DATE, created_at DATE NOT NULL,
  image_url VARCHAR(255));
"""

NEW_USER_COLS = {"must_change_password", "pwd_version", "created_at"}
NEW_REMINDER_COLS = {"done", "done_at", "source"}


def build_legacy_db(path: Path):
    path = Path(path)
    con = sqlite3.connect(path)
    con.executescript(LEGACY_DDL)
    con.executemany(
        "INSERT INTO users (id,username,password_hash,role,name) VALUES (?,?,?,?,?)",
        [
            (1, "aa", _ctx.hash("aa"), "manager", "Old Admin"),
            (2, "dana", _ctx.hash("Strong-Pass-1"), "user", "Dana"),
        ],
    )
    con.execute("INSERT INTO cars VALUES (1, 2, 'dana-car', 'mazda', '3', 2015, '111-22-333')")
    con.executemany(
        "INSERT INTO service_records (id,car_id,service_date,odometer_km,title,treatment_type,"
        "parts_replaced,cost,notes) VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (1, 1, "2025-01-05", 40000, "Oil change", "oil_change", "oil filter", 350, "ok"),
            (2, 1, "2025-08-20", 52000, "Brakes", None, "brake pads", 900, None),
        ],
    )
    con.execute(
        "INSERT INTO reminders (id,created_by_user_id,user_id,car_id,title,message,due_date,created_at)"
        " VALUES (1,1,2,1,'Test drive','Come in','2026-12-01','2026-01-01')"
    )
    con.commit()
    con.close()
    return path

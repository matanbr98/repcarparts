"""baseline: legacy (v1) schema, created or completed idempotently

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Every column the v1 app ever had (added over time via ad-hoc ALTERs).
LEGACY_COLUMNS = {
    "users": [
        ("name", sa.String(120)),
        ("phone", sa.String(40)),
        ("email", sa.String(120)),
        ("profile_image_url", sa.String(255)),
    ],
    "cars": [("user_id", sa.Integer())],
    "service_records": [
        ("image_url", sa.String(255)),
        ("treatment_type", sa.String(60)),
        ("position", sa.String(30)),
        ("tire_position", sa.String(30)),
        ("tires_count", sa.Integer()),
    ],
}


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    existing = set(insp.get_table_names())

    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("username", sa.String(80), nullable=False),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("role", sa.String(20), nullable=False),
            sa.Column("name", sa.String(120)),
            sa.Column("phone", sa.String(40)),
            sa.Column("email", sa.String(120)),
            sa.Column("profile_image_url", sa.String(255)),
        )
        op.create_index("ix_users_id", "users", ["id"])
        op.create_index("ix_users_username", "users", ["username"], unique=True)

    if "cars" not in existing:
        op.create_table(
            "cars",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id")),
            sa.Column("nickname", sa.String(80), nullable=False),
            sa.Column("make", sa.String(80), nullable=False),
            sa.Column("model", sa.String(80), nullable=False),
            sa.Column("year", sa.Integer()),
            sa.Column("license_plate", sa.String(20)),
        )
        op.create_index("ix_cars_id", "cars", ["id"])
        op.create_index("ix_cars_user_id", "cars", ["user_id"])

    if "service_records" not in existing:
        op.create_table(
            "service_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("car_id", sa.Integer(), sa.ForeignKey("cars.id"), nullable=False),
            sa.Column("image_url", sa.String(255)),
            sa.Column("service_date", sa.Date(), nullable=False),
            sa.Column("odometer_km", sa.Integer()),
            sa.Column("title", sa.String(120), nullable=False),
            sa.Column("treatment_type", sa.String(60)),
            sa.Column("position", sa.String(30)),
            sa.Column("tire_position", sa.String(30)),
            sa.Column("tires_count", sa.Integer()),
            sa.Column("parts_replaced", sa.String(255)),
            sa.Column("cost", sa.Integer()),
            sa.Column("notes", sa.Text()),
        )
        op.create_index("ix_service_records_id", "service_records", ["id"])

    if "reminders" not in existing:
        op.create_table(
            "reminders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("car_id", sa.Integer(), sa.ForeignKey("cars.id")),
            sa.Column("title", sa.String(120), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("due_date", sa.Date()),
            sa.Column("created_at", sa.Date(), nullable=False),
            sa.Column("image_url", sa.String(255)),
        )
        op.create_index("ix_reminders_id", "reminders", ["id"])
        op.create_index("ix_reminders_user_id", "reminders", ["user_id"])
        op.create_index("ix_reminders_created_by_user_id", "reminders", ["created_by_user_id"])
        op.create_index("ix_reminders_car_id", "reminders", ["car_id"])

    # Complete tables that predate some v1 columns (only for tables that already existed).
    for table, cols in LEGACY_COLUMNS.items():
        if table not in existing:
            continue
        have = {c["name"] for c in insp.get_columns(table)}
        for name, typ in cols:
            if name not in have:
                op.add_column(table, sa.Column(name, typ, nullable=True))


def downgrade() -> None:
    # Intentionally a no-op: dropping the baseline would destroy user data.
    pass

"""v2 additive columns (contract section 8)

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# (table, column name, type, server_default)
ADDED = [
    ("users", "must_change_password", sa.Boolean(), "0"),
    ("users", "pwd_version", sa.Integer(), "0"),
    ("users", "created_at", sa.Date(), None),
    ("reminders", "done", sa.Boolean(), "0"),
    ("reminders", "done_at", sa.Date(), None),
    ("reminders", "source", sa.String(10), "manager"),
    ("service_records", "created_at", sa.Date(), None),
]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table, name, typ, default in ADDED:
        have = {c["name"] for c in insp.get_columns(table)}
        if name in have:
            continue
        kw = {"nullable": True}
        if default is not None:
            kw["server_default"] = default
        op.add_column(table, sa.Column(name, typ, **kw))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    by_table: dict[str, list[str]] = {}
    for table, name, _t, _d in ADDED:
        have = {c["name"] for c in insp.get_columns(table)}
        if name in have:
            by_table.setdefault(table, []).append(name)
    for table, cols in by_table.items():
        with op.batch_alter_table(table) as batch:
            for c in cols:
                batch.drop_column(c)

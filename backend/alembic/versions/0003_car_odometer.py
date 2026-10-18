"""Manual vehicle odometer (additive)

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ADDED = [("cars", "odometer_km", sa.Integer()), ("cars", "odometer_updated_at", sa.Date())]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    have = {c["name"] for c in insp.get_columns("cars")}
    for table, name, typ in ADDED:
        if name not in have:
            op.add_column(table, sa.Column(name, typ, nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    have = {c["name"] for c in insp.get_columns("cars")}
    cols = [n for _t, n, _ty in ADDED if n in have]
    if cols:
        with op.batch_alter_table("cars") as batch:
            for c in cols:
                batch.drop_column(c)

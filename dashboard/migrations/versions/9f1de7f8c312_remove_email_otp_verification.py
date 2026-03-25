"""remove_email_otp_verification

Revision ID: 9f1de7f8c312
Revises: 5ae9618b1db2
Create Date: 2026-03-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f1de7f8c312"
down_revision = "5ae9618b1db2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("email_otps"):
        op.drop_table("email_otps")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("email_otps"):
        op.create_table(
            "email_otps",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("email", sa.String(length=120), nullable=False),
            sa.Column("purpose", sa.String(length=50), nullable=False),
            sa.Column("otp_hash", sa.String(length=128), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used", sa.Boolean(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("email_otps", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_email_otps_email"), ["email"], unique=False)
            batch_op.create_index(batch_op.f("ix_email_otps_purpose"), ["purpose"], unique=False)
            batch_op.create_index(batch_op.f("ix_email_otps_used"), ["used"], unique=False)
            batch_op.create_index(batch_op.f("ix_email_otps_created_at"), ["created_at"], unique=False)

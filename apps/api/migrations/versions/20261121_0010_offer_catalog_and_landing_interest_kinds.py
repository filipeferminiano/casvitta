"""offer catalog plan and landing-page interest kinds

Adds the `corretor` plan (new default; `essencial`/`profissional` stay valid as legacy) and the
interest kinds `owner_listing_start` and `agency_demo`. Both enums are VARCHAR + CHECK, so only
the constraints change.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-21 15:00:00+00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "agency",
    "owner_listing",
    "developer",
    "investor_institutional",
    "rental_admin",
    "auction",
)
NEW_KINDS = (*OLD_KINDS, "owner_listing_start", "agency_demo")
OLD_PLANS = ("essencial", "profissional")
NEW_PLANS = ("corretor", *OLD_PLANS)


def _check(table: str, name: str, column: str, values: Sequence[str]) -> None:
    constraint = f"ck_{table}_{name}"
    allowed = ", ".join(f"'{v}'" for v in values)
    op.execute(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "{constraint}"')
    op.execute(f'ALTER TABLE {table} ADD CONSTRAINT "{constraint}" CHECK ({column} IN ({allowed}))')


def upgrade() -> None:
    _check("interest_signups", "interest_kind", "kind", NEW_KINDS)
    _check("workspaces", "plan", "plan", NEW_PLANS)
    op.alter_column("workspaces", "plan", server_default="corretor")


def downgrade() -> None:
    op.execute("DELETE FROM interest_signups WHERE kind IN ('owner_listing_start', 'agency_demo')")
    op.execute("UPDATE workspaces SET plan = 'profissional' WHERE plan = 'corretor'")
    op.alter_column("workspaces", "plan", server_default="profissional")
    _check("workspaces", "plan", "plan", OLD_PLANS)
    _check("interest_signups", "interest_kind", "kind", OLD_KINDS)

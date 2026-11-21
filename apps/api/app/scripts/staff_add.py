"""Add (or reactivate) a backoffice staff member. Audited as "system".

Run: python -m app.scripts.staff_add <email> "<name>" <role>
(role: admin, operations, commercial, finance or read_only)

For local development and first setup. In production prefer POST /v1/staff/bootstrap for the
first Admin, then invitations from the backoffice (Equipe e auditoria).
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

import app.models  # noqa: F401 - every table, for foreign keys across domains
from app.core.db import get_sessionmaker
from app.domains.staff.audit import Actor, record
from app.domains.staff.models import StaffRole, StaffUser


async def add(email: str, name: str, role: StaffRole) -> None:
    email = email.strip().lower()
    async with get_sessionmaker()() as session, session.begin():
        staff = await session.scalar(select(StaffUser).where(StaffUser.email == email))
        if staff is None:
            staff = StaffUser(email=email, name=name, role=role, active=True)
            session.add(staff)
        else:
            staff.name, staff.role, staff.active = name, role, True
        await session.flush()
        record(session, Actor.system(), "staff.added_by_script", "staff_users", staff.id, role=role)
    print(f"{email}: {role.value}, active")


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__)
        raise SystemExit(2)
    asyncio.run(add(sys.argv[1], sys.argv[2], StaffRole(sys.argv[3])))


if __name__ == "__main__":
    main()

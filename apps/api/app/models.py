"""Import every ORM model so Base.metadata is complete (Alembic autogenerate, tests)."""

from app.domains.accounts.models import (
    AuditLog,
    AuthSession,
    BrokerProfile,
    LoginToken,
    Membership,
    User,
    Workspace,
)
from app.domains.interest.models import InterestSignup, InterestSignupConsent

__all__ = [
    "AuditLog",
    "AuthSession",
    "BrokerProfile",
    "InterestSignup",
    "InterestSignupConsent",
    "LoginToken",
    "Membership",
    "User",
    "Workspace",
]

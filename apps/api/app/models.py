"""Import every ORM model so Base.metadata is complete (Alembic autogenerate, tests)."""

from app.domains.accounts.models import Workspace
from app.domains.interest.models import InterestSignup, InterestSignupConsent

__all__ = ["InterestSignup", "InterestSignupConsent", "Workspace"]

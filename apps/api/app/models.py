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
from app.domains.market_data.models import (
    IptuStandardCode,
    IptuUseCode,
    ItbiIngestionRun,
    ItbiTransactionRaw,
    MarketCity,
)

__all__ = [
    "AuditLog",
    "AuthSession",
    "BrokerProfile",
    "InterestSignup",
    "InterestSignupConsent",
    "IptuStandardCode",
    "IptuUseCode",
    "ItbiIngestionRun",
    "ItbiTransactionRaw",
    "LoginToken",
    "MarketCity",
    "Membership",
    "User",
    "Workspace",
]

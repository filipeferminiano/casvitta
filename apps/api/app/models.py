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
from app.domains.alerts.models import PropertyAlert, PropertyAlertConsent
from app.domains.interest.models import InterestSignup, InterestSignupConsent
from app.domains.market_data.models import (
    IptuStandardCode,
    IptuUseCode,
    ItbiIngestionRun,
    ItbiLocationReview,
    ItbiTransaction,
    ItbiTransactionRaw,
    MarketBuilding,
    MarketCity,
    MarketMonthly,
    MarketNeighborhood,
    MarketNeighborhoodAdjacency,
    MarketSlugRedirect,
    MarketStats,
    MarketStreet,
)
from app.domains.staff.models import StaffLoginToken, StaffSession, StaffUser

__all__ = [
    "AuditLog",
    "AuthSession",
    "BrokerProfile",
    "InterestSignup",
    "InterestSignupConsent",
    "IptuStandardCode",
    "IptuUseCode",
    "ItbiIngestionRun",
    "ItbiLocationReview",
    "ItbiTransaction",
    "ItbiTransactionRaw",
    "LoginToken",
    "MarketBuilding",
    "MarketCity",
    "MarketMonthly",
    "MarketNeighborhood",
    "MarketNeighborhoodAdjacency",
    "MarketSlugRedirect",
    "MarketStats",
    "MarketStreet",
    "Membership",
    "PropertyAlert",
    "PropertyAlertConsent",
    "StaffLoginToken",
    "StaffSession",
    "StaffUser",
    "User",
    "Workspace",
]

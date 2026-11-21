"""Import every ORM model so Base.metadata is complete (Alembic autogenerate, tests)."""

from app.domains.accounts.models import (
    AccountNote,
    AuditLog,
    AuthSession,
    BrokerProfile,
    LoginToken,
    Membership,
    User,
    Workspace,
)
from app.domains.alerts.models import PropertyAlert, PropertyAlertConsent
from app.domains.interest.models import (
    InterestAssignment,
    InterestSignup,
    InterestSignupConsent,
)
from app.domains.listings.models import Listing
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
from app.domains.properties.models import OwnerAuthorization, Property, PropertyMedia
from app.domains.staff.models import StaffLoginToken, StaffSession, StaffUser

__all__ = [
    "AccountNote",
    "AuditLog",
    "AuthSession",
    "BrokerProfile",
    "InterestAssignment",
    "InterestSignup",
    "InterestSignupConsent",
    "IptuStandardCode",
    "IptuUseCode",
    "ItbiIngestionRun",
    "ItbiLocationReview",
    "ItbiTransaction",
    "ItbiTransactionRaw",
    "Listing",
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
    "OwnerAuthorization",
    "Property",
    "PropertyAlert",
    "PropertyAlertConsent",
    "PropertyMedia",
    "StaffLoginToken",
    "StaffSession",
    "StaffUser",
    "User",
    "Workspace",
]

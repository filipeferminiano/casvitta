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
from app.domains.activity.models import KeyEvent
from app.domains.alerts.models import PropertyAlert, PropertyAlertConsent
from app.domains.appointments.models import Appointment, CalendarBlock, CalendarSettings
from app.domains.billing.models import PlanChangeRequest
from app.domains.contacts.models import Consent, ContactInterest, ContactNote, Person
from app.domains.conversations.models import Conversation, Message
from app.domains.interest.models import (
    InterestAssignment,
    InterestSignup,
    InterestSignupConsent,
)
from app.domains.leads.models import Lead, PipelineStage, Task
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
from app.domains.pages.models import (
    BrokerPage,
    PageCollection,
    PageCollectionItem,
    PageEvent,
    PageInstagramPost,
    PageReport,
    PageSlugRedirect,
)
from app.domains.properties.models import OwnerAuthorization, Property, PropertyMedia
from app.domains.staff.models import StaffLoginToken, StaffSession, StaffUser

__all__ = [
    "AccountNote",
    "Appointment",
    "AuditLog",
    "AuthSession",
    "BrokerPage",
    "BrokerProfile",
    "CalendarBlock",
    "CalendarSettings",
    "Consent",
    "ContactInterest",
    "ContactNote",
    "Conversation",
    "InterestAssignment",
    "InterestSignup",
    "InterestSignupConsent",
    "IptuStandardCode",
    "IptuUseCode",
    "ItbiIngestionRun",
    "ItbiLocationReview",
    "ItbiTransaction",
    "ItbiTransactionRaw",
    "KeyEvent",
    "Lead",
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
    "Message",
    "OwnerAuthorization",
    "PageCollection",
    "PageCollectionItem",
    "PageEvent",
    "PageInstagramPost",
    "PageReport",
    "PageSlugRedirect",
    "Person",
    "PipelineStage",
    "PlanChangeRequest",
    "Property",
    "PropertyAlert",
    "PropertyAlertConsent",
    "PropertyMedia",
    "StaffLoginToken",
    "StaffSession",
    "StaffUser",
    "Task",
    "User",
    "Workspace",
]

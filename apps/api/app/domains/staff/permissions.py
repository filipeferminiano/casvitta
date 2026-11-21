"""What each staff role may do: the matrix in docs/mockups/backoffice/08-team-audit, exactly.

Every role can open the backoffice and read masked data. Everything else is a permission checked
in the API by `require_permission` (app/api/v1/staff_deps.py), never only in the UI.
"""

from __future__ import annotations

from enum import StrEnum

from app.domains.staff.models import StaffRole


class Permission(StrEnum):
    VERIFY_CRECI = "creci.verify"  # Verificar CRECI
    HANDLE_CAPTURES = "captures.handle"  # Indicar corretor e tratar captações
    EXPORT_CONTACTS = "contacts.export"  # Exportar contatos (CSV)
    MODERATE_LISTINGS = "listings.moderate"  # Moderar e pausar anúncios
    REVEAL_CONTACTS = "contacts.reveal"  # Ver telefone e e-mail completos
    VIEW_AS_CUSTOMER = "accounts.view_as"  # Ver como o cliente
    MANAGE_BILLING = "billing.manage"  # Assinaturas, faturas e links de pagamento
    MANAGE_STAFF = "staff.manage"  # Convidar equipe e mudar papéis
    # Not in the mockup matrix (decided with the product owner on 21/11/2026):
    VIEW_AUDIT = "audit.view"  # everyone except Leitura
    EXPORT_AUDIT = "audit.export"  # Admin only


P = Permission

ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = {
    StaffRole.ADMIN: frozenset(Permission),
    StaffRole.OPERATIONS: frozenset(
        {
            P.VERIFY_CRECI,
            P.HANDLE_CAPTURES,
            P.EXPORT_CONTACTS,
            P.MODERATE_LISTINGS,
            P.REVEAL_CONTACTS,
            P.VIEW_AS_CUSTOMER,
            P.VIEW_AUDIT,
        }
    ),
    StaffRole.COMMERCIAL: frozenset(
        {P.HANDLE_CAPTURES, P.EXPORT_CONTACTS, P.REVEAL_CONTACTS, P.VIEW_AUDIT}
    ),
    StaffRole.FINANCE: frozenset(
        {P.REVEAL_CONTACTS, P.VIEW_AS_CUSTOMER, P.MANAGE_BILLING, P.VIEW_AUDIT}
    ),
    StaffRole.READ_ONLY: frozenset(),
}

# Actions that also need a recent proof of identity (email link or re-auth code).
SENSITIVE: frozenset[Permission] = frozenset(
    {
        P.EXPORT_CONTACTS,
        P.REVEAL_CONTACTS,
        P.VIEW_AS_CUSTOMER,
        P.MANAGE_STAFF,
        P.EXPORT_AUDIT,
    }
)


def permissions_for(role: StaffRole) -> frozenset[Permission]:
    return ROLE_PERMISSIONS[role]

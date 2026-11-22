"""Custom domains for broker pages: DNS lookup and the HTTPS certificate for a customer hostname.

Real adapter (decided 22/11/2026): Google Certificate Manager with load balancer authorization in
front of the existing load balancer (first 100 certificates free, then US$ 0.20/month each).
Not built yet: it needs the certificate map on the load balancer, created only with the owner's
OK. Dev and tests use the fake.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol


@dataclass(frozen=True, slots=True)
class DnsAnswer:
    txt: tuple[str, ...] = field(default_factory=tuple)  # values at the verification name
    cname: str | None = None  # target of the hostname's CNAME, lowercase, no trailing dot


class CertificateState(StrEnum):
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"


class DomainsPort(Protocol):
    async def lookup(self, hostname: str, verification_name: str) -> DnsAnswer: ...

    async def request_certificate(self, hostname: str) -> None: ...

    async def certificate_state(self, hostname: str) -> CertificateState: ...

    async def release_certificate(self, hostname: str) -> None: ...

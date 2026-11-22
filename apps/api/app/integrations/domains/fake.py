"""In-memory DNS and certificates. A requested certificate is active at the next check unless the
hostname is in `failing`. Dev sets records through /v1/dev/dns (never in production)."""

from __future__ import annotations

from app.integrations.domains.port import CertificateState, DnsAnswer


class FakeDomains:
    def __init__(self) -> None:
        self.records: dict[str, DnsAnswer] = {}  # hostname -> answer
        self.certificates: dict[str, CertificateState] = {}
        self.failing: set[str] = set()

    def set_dns(
        self, hostname: str, *, txt: list[str] | None = None, cname: str | None = None
    ) -> None:
        self.records[hostname.lower()] = DnsAnswer(tuple(txt or ()), cname)

    async def lookup(self, hostname: str, verification_name: str) -> DnsAnswer:
        return self.records.get(hostname.lower(), DnsAnswer())

    async def request_certificate(self, hostname: str) -> None:
        self.certificates[hostname] = CertificateState.PROVISIONING

    async def certificate_state(self, hostname: str) -> CertificateState:
        state = self.certificates.get(hostname, CertificateState.FAILED)
        if state == CertificateState.PROVISIONING:
            failed = hostname in self.failing
            state = CertificateState.FAILED if failed else CertificateState.ACTIVE
            self.certificates[hostname] = state
        return state

    async def release_certificate(self, hostname: str) -> None:
        self.certificates.pop(hostname, None)

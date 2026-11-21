"""BO6 moderation checks (pure functions) and the queue rule: exceptions and reports only."""

from __future__ import annotations

import uuid
from datetime import date

from app.core.settings import Settings
from app.domains.backoffice.moderation import (
    Authorization,
    ListingForReview,
    NoListingsYet,
    check_authorization,
    check_creci,
    check_duplicate,
    check_photo_text,
    check_price,
    expires_soon,
    needs_person,
    queue,
    run_checks,
)

TODAY = date(2026, 11, 21)
SETTINGS = Settings()


def listing(**overrides: object) -> ListingForReview:
    fields: dict[str, object] = {
        "listing_id": uuid.uuid4(),
        "title": "Apto · Rua Joaquim Távora",
        "broker_name": "Bianca Lopes",
        "broker_creci_verified": True,
        "transaction": "sale",
        "price_cents": 69_000_000,
        "authorization": Authorization(kind="sale", expires_on=date(2027, 3, 10)),
        "comparable_prices_cents": [70_000_000, 71_200_000, 69_500_000, 72_000_000, 70_800_000],
        "photo_text_ratios": [0.0, 0.02],
    }
    fields.update(overrides)
    return ListingForReview(**fields)  # type: ignore[arg-type]


def test_clean_listing_publishes_directly() -> None:
    item = listing()
    checks = run_checks(item, SETTINGS, TODAY)
    assert [c.outcome for c in checks] == ["ok"] * 5
    assert not needs_person(checks, item)


def test_creci_must_be_verified() -> None:
    assert check_creci(listing(broker_creci_verified=False)).outcome == "fail"


def test_authorization_missing_wrong_kind_or_expired_fails() -> None:
    assert check_authorization(listing(authorization=None), TODAY).detail == {"reason": "missing"}
    wrong = listing(authorization=Authorization(kind="rent", expires_on=date(2027, 1, 1)))
    assert check_authorization(wrong, TODAY).detail == {"reason": "wrong_kind"}
    expired = listing(authorization=Authorization(kind="sale", expires_on=date(2026, 11, 20)))
    result = check_authorization(expired, TODAY)
    assert result.outcome == "fail" and result.detail["reason"] == "expired"
    today = listing(authorization=Authorization(kind="sale", expires_on=TODAY))
    assert check_authorization(today, TODAY).outcome == "ok"  # valid through its last day


def test_price_far_from_the_median_goes_to_a_person() -> None:
    # The mockup case: 27 % below the median of the comparables.
    comps = [71_200_000] * 14
    cheap = check_price(listing(price_cents=52_000_000, comparable_prices_cents=comps), SETTINGS)
    assert cheap.outcome == "review" and cheap.detail["pct"] == -27
    assert cheap.detail["count"] == 14 and cheap.detail["median_cents"] == 71_200_000
    near = check_price(listing(price_cents=60_000_000, comparable_prices_cents=comps), SETTINGS)
    assert near.outcome == "ok"  # -16 %, inside the 25 % band


def test_price_is_not_judged_with_few_comparables() -> None:
    result = check_price(
        listing(price_cents=10_000_000, comparable_prices_cents=[70_000_000] * 4), SETTINGS
    )
    assert result.outcome == "ok" and result.detail == {"count": 4, "few": 1}


def test_text_on_photos_and_duplicates_go_to_a_person() -> None:
    assert check_photo_text(listing(photo_text_ratios=[0.01, 0.4]), SETTINGS).outcome == "review"
    assert check_photo_text(listing(photo_text_ratios=[]), SETTINGS).outcome == "ok"
    assert check_duplicate(listing(duplicate_of=uuid.uuid4())).outcome == "review"


def test_a_report_always_goes_to_a_person() -> None:
    item = listing(reports=["já vendido"])
    assert needs_person(run_checks(item, SETTINGS, TODAY), item)


def test_thresholds_come_from_settings() -> None:
    strict = Settings(moderation_price_deviation_pct=10)
    comps = [71_200_000] * 14
    assert (
        check_price(listing(price_cents=62_000_000, comparable_prices_cents=comps), strict).outcome
        == "review"
    )


def test_authorization_expiring_soon() -> None:
    assert expires_soon(Authorization(kind="sale", expires_on=date(2026, 12, 10)), TODAY)
    assert not expires_soon(Authorization(kind="sale", expires_on=date(2027, 3, 10)), TODAY)
    assert not expires_soon(None, TODAY)


async def test_queue_is_off_until_listings_exist() -> None:
    off = await queue(NoListingsYet(), SETTINGS, TODAY)
    assert off.enabled is False and off.items == []

    class Two:
        async def listings_to_check(self) -> list[ListingForReview]:
            return [
                listing(),
                listing(price_cents=52_000_000, comparable_prices_cents=[71_200_000] * 14),
            ]

    on = await queue(Two(), Settings(backoffice_modules=["moderation"]), TODAY)
    assert on.enabled is True
    assert [i.price_cents for i in on.items] == [52_000_000]  # only the exception


def test_revenue_shows_catalog_lines_without_amounts() -> None:
    from app.domains.backoffice.revenue import revenue  # noqa: PLC0415

    out = revenue(Settings(offer_broker_price_cents=9_900))
    assert out.enabled is False  # billing is not wired: no numbers
    lines = {line.key: line for line in out.lines}
    assert lines["saas_broker"].price_cents == 9_900
    assert lines["saas_agency_larger"].price_cents is None  # "sob consulta"
    assert lines["highlight_7d"].price_cents == 3_900
    assert lines["highlight_30d"].price_cents == 11_900
    assert {lines[k].status for k in ("commission_rent", "commission_sale", "insurance")} == {
        "soon"
    }
    assert not any("media" in key or "ads" in key for key in lines)  # rule 14

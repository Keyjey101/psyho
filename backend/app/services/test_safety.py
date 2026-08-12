"""Safety rules for psychological screening tests.

Deliberately server-side. A client could be modified, cached, or simply out of
date; whether a result screen must lead with live crisis contacts is not a
decision we delegate to the browser.

Two independent triggers, either of which forces the safe layout:

* **Sensitive item** — the questionnaire contains a self-harm / suicidal-ideation
  item and the user answered it above zero (PHQ-9 item 9 is the canonical case).
* **Severe band** — the total lands in the top severity band of a screening scale.

When either fires: crisis contacts render above and larger than any CTA, no
monetisation is offered, and the wording carries no diagnosis.
"""
from __future__ import annotations

from typing import Optional

# Zero-based indices of items asking about self-harm or wanting to be dead.
SENSITIVE_ITEMS: dict[str, tuple[int, ...]] = {
    "phq9": (8,),
}

# Fraction of the maximum score at which a screening scale is treated as severe.
# Only for scales where a HIGH score means more symptoms.
SEVERE_RATIO: dict[str, float] = {
    "phq9": 0.60,          # 15+/27 — moderately severe and up
    "gad7": 0.66,          # 14+/21 — severe anxiety
    "pss10": 0.68,         # high perceived stress
    "burnout-short": 0.70,
    "social-anxiety": 0.70,
    "health-anx": 0.70,
    "ucla3": 0.75,
}

CRISIS_CONTACTS: list[dict[str, str]] = [
    {
        "title": "Единый телефон доверия",
        "phone": "8-800-333-44-34",
        "note": "бесплатно, круглосуточно, по всей России",
    },
    {
        "title": "Телефон доверия для детей и подростков",
        "phone": "8-800-2000-122",
        "note": "бесплатно, круглосуточно",
    },
    {
        "title": "Экстренные службы",
        "phone": "112",
        "note": "если жизни угрожает опасность прямо сейчас",
    },
]

CRISIS_HEADLINE = "Пожалуйста, поговори с живым человеком"
CRISIS_BODY = (
    "Судя по ответам, тебе сейчас тяжело. Это не диагноз и не приговор — "
    "это повод не оставаться с этим наедине. Ниже — бесплатные линии, где "
    "отвечают живые люди, круглосуточно и анонимно."
)


def is_sensitive_answer(test_id: str, answers: Optional[list[int]]) -> bool:
    """True if a self-harm item was answered above the lowest option."""
    indices = SENSITIVE_ITEMS.get(test_id)
    if not indices or not answers:
        return False
    return any(
        idx < len(answers) and isinstance(answers[idx], int) and answers[idx] > 0
        for idx in indices
    )


def is_severe_score(test_id: str, score: int, max_score: int) -> bool:
    ratio = SEVERE_RATIO.get(test_id)
    if ratio is None or max_score <= 0:
        return False
    return (score / max_score) >= ratio


def assess(
    test_id: str,
    score: int,
    max_score: int,
    answers: Optional[list[int]] = None,
) -> dict:
    """Decide how the result screen must behave for this outcome."""
    sensitive = is_sensitive_answer(test_id, answers)
    severe = is_severe_score(test_id, score, max_score)
    unsafe = sensitive or severe

    return {
        "is_severe": severe,
        "sensitive_item_flagged": sensitive,
        # Contacts go above the CTA, bigger than it.
        "show_crisis_resources": unsafe,
        # No monetisation whatsoever on a heavy result.
        "allow_monetization": not unsafe,
        "crisis": {
            "headline": CRISIS_HEADLINE,
            "body": CRISIS_BODY,
            "contacts": CRISIS_CONTACTS,
        } if unsafe else None,
    }

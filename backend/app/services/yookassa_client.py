"""Thin async wrapper around the YooKassa REST API.

We deliberately don't pull the official ``yookassa`` SDK — it's sync, requests
based and brings extra moving parts. ``httpx`` + their auth scheme is enough
for the payment flows we need.
"""
from __future__ import annotations

import base64
import ipaddress
from typing import Any, Optional

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger()

YOOKASSA_API = "https://api.yookassa.ru/v3"

# Source: https://yookassa.ru/developers/using-api/webhooks#ip
_TRUSTED_NETS = [
    ipaddress.ip_network("185.71.76.0/27"),
    ipaddress.ip_network("185.71.77.0/27"),
    ipaddress.ip_network("77.75.153.0/25"),
    ipaddress.ip_network("77.75.154.128/25"),
    ipaddress.ip_network("77.75.156.11/32"),
    ipaddress.ip_network("77.75.156.35/32"),
    ipaddress.ip_network("2a02:5180::/32"),
]


def _basic_auth() -> str:
    s = get_settings()
    raw = f"{s.YOOKASSA_SHOP_ID}:{s.YOOKASSA_SECRET_KEY}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def is_trusted_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in _TRUSTED_NETS)


def is_configured() -> bool:
    s = get_settings()
    return bool(s.YOOKASSA_SHOP_ID and s.YOOKASSA_SECRET_KEY)


async def _post(path: str, body: dict, idempotence_key: str) -> dict:
    headers = {
        "Authorization": _basic_auth(),
        "Content-Type": "application/json",
        "Idempotence-Key": idempotence_key,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(f"{YOOKASSA_API}{path}", json=body, headers=headers)
        if resp.status_code >= 400:
            logger.error("yookassa_error", path=path, status=resp.status_code, body=resp.text)
            resp.raise_for_status()
        return resp.json()


async def _get(path: str) -> dict:
    headers = {"Authorization": _basic_auth()}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{YOOKASSA_API}{path}", headers=headers)
        if resp.status_code >= 400:
            logger.error("yookassa_get_error", path=path, status=resp.status_code, body=resp.text)
            resp.raise_for_status()
        return resp.json()


async def create_payment(
    amount_kopecks: int,
    description: str,
    idempotence_key: str,
    return_url: str,
    metadata: Optional[dict] = None,
    save_payment_method: bool = False,
    receipt_email: Optional[str] = None,
) -> dict:
    """Initial payment with hosted ЮKassa form.

    Setting ``save_payment_method`` returns a ``payment_method.id`` that can
    later be reused in :func:`charge_recurring` for autorenew.
    """
    body: dict[str, Any] = {
        "amount": {"value": f"{amount_kopecks / 100:.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description[:128],
        "save_payment_method": save_payment_method,
    }
    if metadata:
        body["metadata"] = metadata
    if receipt_email:
        body["receipt"] = {
            "customer": {"email": receipt_email},
            "items": [
                {
                    "description": description[:128],
                    "quantity": "1.00",
                    "amount": {"value": f"{amount_kopecks / 100:.2f}", "currency": "RUB"},
                    "vat_code": 1,
                    "payment_subject": "service",
                    "payment_mode": "full_prepayment",
                }
            ],
        }
    return await _post("/payments", body, idempotence_key)


async def charge_recurring(
    payment_method_id: str,
    amount_kopecks: int,
    description: str,
    idempotence_key: str,
    metadata: Optional[dict] = None,
) -> dict:
    body: dict[str, Any] = {
        "amount": {"value": f"{amount_kopecks / 100:.2f}", "currency": "RUB"},
        "capture": True,
        "payment_method_id": payment_method_id,
        "description": description[:128],
    }
    if metadata:
        body["metadata"] = metadata
    return await _post("/payments", body, idempotence_key)


async def get_payment(payment_id: str) -> dict:
    return await _get(f"/payments/{payment_id}")

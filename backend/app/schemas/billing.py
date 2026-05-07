from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


PlanCode = Literal["pro_month", "pro_3m", "pro_year"]
PackCode = Literal["pack_5", "pack_15"]


class PricingResponse(BaseModel):
    monetization_enabled: bool
    free_lifetime_sessions: int
    plans: dict
    packs: dict


class SubscriptionMe(BaseModel):
    tier: Literal["free", "pro"]
    expires_at: Optional[datetime]
    autorenew: bool
    free_sessions_left: int
    paid_sessions_left: int
    notify_telegram_linked: bool


class SubscribeRequest(BaseModel):
    plan: PlanCode
    promo_code: Optional[str] = None


class PackageRequest(BaseModel):
    pack: PackCode
    promo_code: Optional[str] = None


class CheckoutResponse(BaseModel):
    confirmation_url: str
    payment_id: str
    amount_kopecks: int
    discount_kopecks: int


class PromoCheckRequest(BaseModel):
    code: str
    purpose: str


class PromoCheckResponse(BaseModel):
    valid: bool
    discount_percent: int = 0
    final_amount_kopecks: int = 0
    error: Optional[str] = None


class NotifyLinkResponse(BaseModel):
    bot_url: str


class PaymentItem(BaseModel):
    id: str
    purpose: str
    amount_kopecks: int
    discount_kopecks: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PromoCreateRequest(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    discount_percent: int = Field(ge=1, le=99)
    max_uses: Optional[int] = Field(default=None, ge=1)
    valid_until: Optional[datetime] = None
    applies_to: Literal["all", "pro_month", "pro_3m", "pro_year", "pack"] = "all"


class PromoUpdateRequest(BaseModel):
    active: Optional[bool] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)

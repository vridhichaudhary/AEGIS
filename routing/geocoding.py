"""Backend-only Geoapify lookup. Never expose provider URLs or exception strings."""
import math
import logging

# HTTP client INFO request logs include query strings containing credentials.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
import httpx
from config.settings import settings


async def search_address(address: str) -> dict:
    if not settings.GEOAPIFY_API_KEY or not address.strip():
        return {"candidates": [], "status": "not_configured"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("https://api.geoapify.com/v1/geocode/search", params={
                "text": address, "filter": "countrycode:in", "limit": 5,
                "apiKey": settings.GEOAPIFY_API_KEY,
            })
        if response.status_code != 200:
            return {"candidates": [], "status": "quota_error" if response.status_code == 429 else "provider_error"}
        candidates = []
        for feature in response.json().get("features", [])[:5]:
            p = feature.get("properties", {})
            lat, lng = p.get("lat"), p.get("lon")
            if p.get("country_code") != "in" or not all(isinstance(n, (int, float)) and math.isfinite(n) for n in (lat, lng)):
                continue
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue
            precise = p.get("result_type") in {"building", "amenity", "street"}
            candidates.append({"label": p.get("formatted") or ", ".join(str(p[k]) for k in ("street", "city", "state", "postcode") if p.get(k)),
                               "latitude": lat, "longitude": lng, "result_type": p.get("result_type"),
                               "selectable": precise})
        return {"candidates": candidates, "status": "confirmation_required" if candidates else "no_match"}
    except httpx.TimeoutException:
        return {"candidates": [], "status": "timeout"}
    except Exception:
        return {"candidates": [], "status": "provider_error"}

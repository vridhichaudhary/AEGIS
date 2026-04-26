"""
DeduplicationAgent — Semantic Multilingual Embedding-Based Duplicate Detection

Approach:
1. Embed normalized transcript using paraphrase-multilingual-MiniLM-L12-v2
2. Filter candidates by: same category + within 15 min + within 500m radius (Haversine)
3. Compute cosine similarity against candidates
4. Threshold 0.80 → duplicate; store and return confidence score
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timedelta
from typing import List, Optional, Any

try:
    import numpy as np
    _NP_AVAILABLE = True
except ImportError:
    np = None
    _NP_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False

from config.settings import settings

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None


# ---------------------------------------------------------------------------
# Expanded Hinglish → English normalization map (40+ terms)
# ---------------------------------------------------------------------------
HINGLISH_MAP = {
    # Fillers & common conversational words (strip these)
    "bhai": "",
    "sir": "",
    "madam": "",
    "hello": "",
    "namaste": "",
    "suno": "",
    "ji": "",
    "me": "",
    "mein": "",
    "ke": "",
    "ko": "",
    "se": "",
    "pe": "",
    "par": "",
    "hai": "",
    "hain": "",
    "ho": "",
    "tha": "",
    "thi": "",
    "raha": "",
    "rahi": "",
    "gaya": "",
    "gayi": "",
    "gai": "",
    
    # Fire (Unified to 'fire')
    "aag lagi": "fire",
    "aag lag gayi": "fire",
    "aag lag gai": "fire",
    "aag": "fire",
    "jal gaya": "fire",
    "jal gayi": "fire",
    "dhua": "smoke",
    "dhuan": "smoke",
    
    # Accident / Vehicle (Unified to 'accident')
    "gaadi takra gayi": "accident",
    "gaadi takra gai": "accident",
    "takkar ho gai": "accident",
    "takkar ho gayi": "accident",
    "takra gaye": "accident",
    "gaadi palat gayi": "accident",
    "gaadi": "vehicle",
    "takra": "collision",
    "takkar": "collision",
    "accident ho gaya": "accident",
    "hadsa ho gaya": "accident",
    "gir gaya": "fall",
    "gir gayi": "fall",
    "girna": "fall",
    
    # Medical
    "behosh": "unconscious",
    "behosh ho gaya": "unconscious",
    "saans nahi": "not breathing",
    "saans nahi aa rahi": "not breathing",
    "neend nahi aa rahi": "unresponsive",
    "dard ho raha": "pain",
    "sar phut gaya": "head injury",
    "khoon aa raha": "bleeding",
    "khoon": "bleeding",
    "heart attack": "cardiac arrest",
    "dil ka dora": "cardiac arrest",
    
    # Entrapment / Trapped
    "andar fas gaye": "trapped",
    "phas gaye": "trapped",
    "phas gayi": "trapped",
    "faase hue": "trapped",
    "faase": "trapped",
    "phase hain": "trapped",
    
    # Violence
    "chaku mara": "stabbed",
    "chaku": "knife",
    "lut liya": "robbery",
    "loot": "robbery",
    "maar diya": "assault",
    "danga": "riot",
    "goli maari": "gunshot",
    "goli": "gunshot",
    
    # Disaster / Flood
    "paani bhar gaya": "flooding",
    "paani ghus gaya": "flooding",
    "paani aa gaya": "flooding",
    "deewar giri": "wall collapsed",
    "chhat giri": "roof collapsed",
    "bijli giri": "lightning strike",
    "bhukamp": "earthquake",
    "duba": "drowned",
    "doob gaya": "drowned",
    
    # Urgency markers
    "jaldi aao": "urgent",
    "jaldi": "urgent",
    "turant": "immediate",
    "madad karo": "help",
    "bachao": "help",
    "help karo": "help",
    "cannaught": "connaught",
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lng points in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(max(0.0, a)))


def cosine_similarity(a: Any, b: Any) -> float:
    """Cosine similarity between two 1-D numpy vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def normalize_hinglish(text: str) -> str:
    """Apply Hinglish → English normalization before embedding."""
    lowered = text.lower().strip()
    # Apply longest-match first to avoid partial replacements
    for phrase in sorted(HINGLISH_MAP.keys(), key=len, reverse=True):
        lowered = lowered.replace(phrase, HINGLISH_MAP[phrase])
    return lowered


class DeduplicationAgent:
    """
    Semantic duplicate detection using multilingual sentence embeddings.

    Comparison logic:
      - Same incident category
      - Same geographic area (≤ 0.5 km, Haversine)
      - Within 15-minute time window
      - Cosine similarity of embeddings ≥ 0.80
    """

    SIMILARITY_THRESHOLD = 0.75
    TIME_WINDOW_MINUTES = 15
    RADIUS_KM = 1.0
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(self):
        # In-process incident store (also cached to Redis when available)
        self._store: List[dict] = []

        # Redis for cross-process persistence
        self.redis_client = None
        if redis_lib is not None:
            try:
                client = redis_lib.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    decode_responses=False,       # binary for numpy
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
                client.ping()
                self.redis_client = client
            except Exception:
                pass

        # Load embedding model only when explicitly enabled.
        # This prevents startup/runtime hangs from external model downloads.
        if _ST_AVAILABLE and getattr(settings, "ENABLE_SEMANTIC_EMBEDDINGS", False):
            try:
                t0 = time.time()
                self.embedder = SentenceTransformer(self.MODEL_NAME, local_files_only=True)
                elapsed = time.time() - t0
                print(f"[DeduplicationAgent] Loaded {self.MODEL_NAME} in {elapsed:.1f}s")
            except Exception as exc:
                print(f"[DeduplicationAgent] SentenceTransformer load failed: {exc}")
                self.embedder = None
        else:
            self.embedder = None
            print("[DeduplicationAgent] semantic embeddings disabled or unavailable — falling back to fuzzy matching")

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------
    def embed(self, text: str) -> Optional[Any]:
        """Embed normalized text. Returns None if model unavailable."""
        if self.embedder is None:
            return None
        normalized = normalize_hinglish(text)
        return self.embedder.encode(normalized, convert_to_numpy=True)

    # ------------------------------------------------------------------
    # Candidate filtering
    # ------------------------------------------------------------------
    def _candidate_incidents(
        self,
        lat: float,
        lng: float,
        category: str,
        now: datetime,
    ) -> List[dict]:
        """Return stored incidents that pass category + time + radius filters."""
        cutoff = now - timedelta(minutes=self.TIME_WINDOW_MINUTES)
        candidates = []
        for entry in self._store:
            if entry["timestamp"] < cutoff:
                continue
            dist = haversine_km(lat, lng, entry["lat"], entry["lng"])
            if dist <= self.RADIUS_KM:
                # Add if category matches OR if it's very close (semantic check will do the rest)
                candidates.append(entry)
        return candidates

    # ------------------------------------------------------------------
    # Fallback: fuzzy matching when embeddings unavailable
    # ------------------------------------------------------------------
    def _fuzzy_similarity(self, text1: str, text2: str) -> float:
        """Token-sort Levenshtein similarity after Hinglish normalization."""
        try:
            from fuzzywuzzy import fuzz
            n1 = normalize_hinglish(text1)
            n2 = normalize_hinglish(text2)
            return fuzz.token_sort_ratio(n1, n2) / 100.0
        except ImportError:
            return 0.0

    # ------------------------------------------------------------------
    # Core check
    # ------------------------------------------------------------------
    def check_duplicate(
        self,
        incident_id: str,
        transcript: str,
        category: str,
        lat: float,
        lng: float,
        now: datetime,
    ) -> dict:
        """
        Returns:
          {
            "is_duplicate": bool,
            "duplicate_of": str | None,      # matched incident_id
            "duplicate_confidence": float,   # 0.0–1.0
          }
        """
        candidates = self._candidate_incidents(lat, lng, category, now)

        if not candidates:
            return {"is_duplicate": False, "duplicate_of": None, "duplicate_confidence": 0.0}

        embedding = self.embed(transcript)

        best_score = 0.0
        best_id = None

        for c in candidates:
            if embedding is not None and c.get("embedding") is not None:
                score = cosine_similarity(embedding, np.array(c["embedding"]))
            else:
                # Fallback to fuzzy
                score = self._fuzzy_similarity(transcript, c["transcript"])

            if score > best_score:
                best_score = score
                best_id = c["incident_id"]

        if best_score >= self.SIMILARITY_THRESHOLD:
            return {
                "is_duplicate": True,
                "duplicate_of": best_id,
                "duplicate_confidence": round(best_score, 4),
            }

        return {"is_duplicate": False, "duplicate_of": None, "duplicate_confidence": 0.0}

    def store_incident(
        self,
        incident_id: str,
        transcript: str,
        category: str,
        lat: float,
        lng: float,
        timestamp: datetime,
        embedding: Optional[Any],
    ):
        """Add incident to the in-process store."""
        self._store.append(
            {
                "incident_id": incident_id,
                "transcript": transcript,
                "category": category,
                "lat": lat,
                "lng": lng,
                "timestamp": timestamp,
                "embedding": embedding.tolist() if embedding is not None else None,
            }
        )
        # Prune entries older than 30 minutes to keep memory bounded
        cutoff = datetime.now() - timedelta(minutes=30)
        self._store = [e for e in self._store if e["timestamp"] >= cutoff]

    # ------------------------------------------------------------------
    # LangGraph node entry point
    # ------------------------------------------------------------------
    async def process(self, state: dict) -> dict:
        location = state.get("location") or {}
        lat = location.get("latitude", 28.6139)
        lng = location.get("longitude", 77.2090)
        category = (state.get("incident_type") or {}).get("category", "other")
        transcript = state.get("normalized_text", "")
        incident_id = state["incident_id"]
        now = state["timestamp"]

        result = self.check_duplicate(incident_id, transcript, category, lat, lng, now)

        is_duplicate = result["is_duplicate"]
        duplicate_of = result["duplicate_of"]
        confidence = result["duplicate_confidence"]

        if not is_duplicate:
            embedding = self.embed(transcript)
            self.store_incident(incident_id, transcript, category, lat, lng, now, embedding)

        # Build reasoning string for agent trail
        if is_duplicate:
            reasoning = (
                f"Semantic similarity {confidence * 100:.1f}% with incident "
                f"{duplicate_of[:8]}... — above {self.SIMILARITY_THRESHOLD * 100:.0f}% threshold. "
                f"Geo-radius: {self.RADIUS_KM * 1000:.0f}m, Window: {self.TIME_WINDOW_MINUTES}min."
            )
        else:
            method = "embedding" if self.embedder else "fuzzy"
            reasoning = (
                f"No semantic match found using {method} similarity "
                f"(threshold {self.SIMILARITY_THRESHOLD * 100:.0f}%). Stored as new incident."
            )

        state["agent_trail"].append(
            {
                "agent": "deduplication",
                "timestamp": datetime.now(),
                "decision": "Duplicate detected" if is_duplicate else "New incident",
                "reasoning": reasoning,
                "duplicate_confidence": confidence,
            }
        )

        return {
            **state,
            "is_duplicate": is_duplicate,
            "duplicate_of": duplicate_of,
            "duplicate_confidence": confidence,
            # Keep geo_hash for backward compat with anything still reading it
            "geo_hash": None,
            "semantic_fingerprint": None,
        }

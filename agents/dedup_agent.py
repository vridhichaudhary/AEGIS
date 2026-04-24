from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import List, Optional

from config.settings import settings

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None

try:
    import numpy as np
except ImportError:  # pragma: no cover - optional dependency
    np = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - optional dependency
    SentenceTransformer = None


class DeduplicationAgent:
    """Detects duplicate incident reports while tolerating missing infra."""

    _memory_store: dict[str, str] = {}

    def __init__(self):
        self.redis_client = None
        if redis is not None:
            try:
                client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    socket_connect_timeout=0.2,
                    socket_timeout=0.2,
                )
                client.ping()
                self.redis_client = client
            except Exception:
                self.redis_client = None

        self.embedding_model = None
        if SentenceTransformer is not None and settings.ENABLE_SEMANTIC_EMBEDDINGS:
            try:
                self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception:
                self.embedding_model = None

        self.similarity_threshold = settings.DEDUP_SIMILARITY_THRESHOLD
        self.time_window_minutes = 10

    def generate_geo_hash(self, location_text: str, incident_type: str) -> str:
        key = f"{location_text.lower().strip()}:{incident_type}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def compute_semantic_fingerprint(self, text: str) -> Optional[List[float]]:
        if self.embedding_model is None:
            return None
        embedding = self.embedding_model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        if np is None:
            return SequenceMatcher(None, json.dumps(vec1[:16]), json.dumps(vec2[:16])).ratio()
        a = np.array(vec1)
        b = np.array(vec2)
        denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
        if denominator == 0:
            return 0.0
        return float(np.dot(a, b) / denominator)

    def fuzzy_text_similarity(self, text1: str, text2: str) -> float:
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    def list_keys(self, search_key: str) -> list[str]:
        if self.redis_client is not None:
            return self.redis_client.keys(search_key)
        prefix = search_key.replace("*", "")
        return [key for key in self._memory_store if key.startswith(prefix)]

    def get_value(self, key: str) -> Optional[str]:
        if self.redis_client is not None:
            return self.redis_client.get(key)
        return self._memory_store.get(key)

    def set_value(self, key: str, value: str):
        if self.redis_client is not None:
            self.redis_client.setex(key, 3600, value)
        else:
            self._memory_store[key] = value

    async def find_duplicates(self, state: dict) -> Optional[str]:
        geo_hash = state.get("geo_hash")
        current_fingerprint = state.get("semantic_fingerprint")
        incident_category = state["incident_type"]["category"]

        try:
            search_key = f"incident:geohash:{geo_hash}:"
            for key in self.list_keys(f"{search_key}*"):
                stored_data = self.get_value(key)
                if not stored_data:
                    continue

                stored_incident = json.loads(stored_data)
                stored_time = datetime.fromisoformat(stored_incident["timestamp"])
                current_time = state["timestamp"]

                if (current_time - stored_time) > timedelta(minutes=self.time_window_minutes):
                    continue

                if stored_incident.get("incident_category") != incident_category:
                    continue

                stored_fingerprint = stored_incident.get("fingerprint")
                if stored_fingerprint and current_fingerprint:
                    similarity = self.cosine_similarity(current_fingerprint, stored_fingerprint)
                else:
                    similarity = self.fuzzy_text_similarity(
                        state["normalized_text"], stored_incident.get("normalized_text", "")
                    )

                if similarity >= self.similarity_threshold:
                    return stored_incident["incident_id"]
        except Exception:
            return None

        return None

    async def store_incident(self, state: dict):
        key = f"incident:geohash:{state['geo_hash']}:{state['incident_id']}"
        data = {
            "incident_id": state["incident_id"],
            "timestamp": state["timestamp"].isoformat(),
            "incident_category": state["incident_type"]["category"],
            "fingerprint": state["semantic_fingerprint"],
            "normalized_text": state["normalized_text"],
            "location": state["location"]["raw_text"],
        }
        try:
            self.set_value(key, json.dumps(data))
        except Exception:
            return None
        return None

    async def process(self, state: dict) -> dict:
        location_text = state["location"]["raw_text"]
        incident_category = state["incident_type"]["category"]
        normalized_text = state["normalized_text"]

        geo_hash = self.generate_geo_hash(location_text, incident_category)
        fingerprint = self.compute_semantic_fingerprint(normalized_text)

        state["geo_hash"] = geo_hash
        state["semantic_fingerprint"] = fingerprint

        duplicate_id = await self.find_duplicates(state)
        is_duplicate = duplicate_id is not None

        if not is_duplicate:
            await self.store_incident(state)

        state["agent_trail"].append(
            {
                "agent": "deduplication",
                "timestamp": datetime.now(),
                "decision": "Duplicate detected" if is_duplicate else "New incident",
                "reasoning": f"Geo-hash: {geo_hash}, Similarity check: {'matched' if is_duplicate else 'unique'}",
            }
        )

        return {
            **state,
            "is_duplicate": is_duplicate,
            "duplicate_of": duplicate_id,
            "geo_hash": geo_hash,
            "semantic_fingerprint": fingerprint,
        }

from __future__ import annotations
import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fuzzywuzzy import fuzz
from config.settings import settings

try:
    import redis
except ImportError:
    redis = None

class DeduplicationAgent:
    """Lightweight deduplication using fuzzy string matching (NO ML)"""
    
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
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
                client.ping()
                self.redis_client = client
            except Exception:
                pass
        
        self.similarity_threshold = 75  # Fuzzy match threshold (0-100)
        self.time_window_minutes = 10
    
    def generate_geo_hash(self, location_text: str, incident_type: str) -> str:
        """Create location + type hash"""
        # Normalize location
        normalized = location_text.lower().strip()
        # Remove common words
        normalized = normalized.replace("near", "").replace("ke paas", "").strip()
        
        key = f"{normalized}:{incident_type}"
        return hashlib.md5(key.encode()).hexdigest()[:12]
    
    def normalize_text(self, text: str) -> str:
        """Normalize for comparison"""
        # Convert to lowercase
        normalized = text.lower()
        
        # Hindi -> English common terms
        replacements = {
            "aag lagi": "fire",
            "aag": "fire",
            "behosh": "unconscious",
            "khoon": "bleeding",
            "phas gaye": "trapped",
            "faase": "trapped",
            "cylinder blast": "blast",
            "phat gaya": "blast",
        }
        
        for hindi, english in replacements.items():
            normalized = normalized.replace(hindi, english)
        
        return normalized
    
    def compute_similarity(self, text1: str, text2: str) -> float:
        """Fuzzy string similarity (0-100)"""
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        
        # Token sort ratio (best for emergency calls)
        return fuzz.token_sort_ratio(norm1, norm2)
    
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
        """Find duplicate incidents"""
        geo_hash = state.get("geo_hash")
        current_text = state["normalized_text"]
        incident_category = state["incident_type"]["category"]
        
        try:
            search_key = f"incident:geohash:{geo_hash}:"
            
            for key in self.list_keys(f"{search_key}*"):
                stored_data = self.get_value(key)
                if not stored_data:
                    continue
                
                stored = json.loads(stored_data)
                
                # Check time window
                stored_time = datetime.fromisoformat(stored["timestamp"])
                if (state["timestamp"] - stored_time) > timedelta(minutes=self.time_window_minutes):
                    continue
                
                # Check incident type
                if stored.get("incident_category") != incident_category:
                    continue
                
                # Fuzzy text similarity
                similarity = self.compute_similarity(current_text, stored.get("normalized_text", ""))
                
                # Location boost
                if stored.get("location", "").lower() in state["location"]["raw_text"].lower():
                    similarity += 10
                
                # Blast keyword boost
                if "blast" in current_text.lower() and "blast" in stored.get("normalized_text", "").lower():
                    similarity += 15
                
                similarity = min(similarity, 100)
                
                # Match threshold
                if similarity >= self.similarity_threshold:
                    return stored["incident_id"]
        
        except Exception as e:
            print(f"Dedup error: {e}")
        
        return None
    
    async def store_incident(self, state: dict):
        """Store incident for future dedup"""
        key = f"incident:geohash:{state['geo_hash']}:{state['incident_id']}"
        
        data = {
            "incident_id": state["incident_id"],
            "timestamp": state["timestamp"].isoformat(),
            "incident_category": state["incident_type"]["category"],
            "normalized_text": state["normalized_text"],
            "location": state["location"]["raw_text"],
        }
        
        try:
            self.set_value(key, json.dumps(data))
        except Exception:
            pass
    
    async def process(self, state: dict) -> dict:
        """Main deduplication logic"""
        location_text = state["location"]["raw_text"]
        incident_category = state["incident_type"]["category"]
        normalized_text = state["normalized_text"]
        
        # Generate geo-hash
        geo_hash = self.generate_geo_hash(location_text, incident_category)
        state["geo_hash"] = geo_hash
        state["semantic_fingerprint"] = None  # No longer needed
        
        # Find duplicates
        duplicate_id = await self.find_duplicates(state)
        is_duplicate = duplicate_id is not None
        
        # Store if not duplicate
        if not is_duplicate:
            await self.store_incident(state)
        
        # Log
        state["agent_trail"].append({
            "agent": "deduplication",
            "timestamp": datetime.now(),
            "decision": "Duplicate detected" if is_duplicate else "New incident",
            "reasoning": f"Geo-hash: {geo_hash}, Match: {'YES' if is_duplicate else 'NO'}"
        })
        
        return {
            **state,
            "is_duplicate": is_duplicate,
            "duplicate_of": duplicate_id,
            "geo_hash": geo_hash,
            "semantic_fingerprint": None
        }
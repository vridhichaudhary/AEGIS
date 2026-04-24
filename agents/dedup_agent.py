import hashlib
import redis
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Optional, List
from config.settings import settings
from datetime import datetime, timedelta
import json

class DeduplicationAgent:
    """Detects duplicate incident reports using semantic similarity"""
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        
        # Lightweight embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.similarity_threshold = settings.DEDUP_SIMILARITY_THRESHOLD
        self.time_window_minutes = 10
    
    def generate_geo_hash(self, location_text: str, incident_type: str) -> str:
        """Create deterministic hash for geo-bucketing"""
        key = f"{location_text.lower().strip()}:{incident_type}"
        return hashlib.md5(key.encode()).hexdigest()[:12]
    
    def compute_semantic_fingerprint(self, text: str) -> List[float]:
        """Generate embedding vector for semantic comparison"""
        embedding = self.embedding_model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        a = np.array(vec1)
        b = np.array(vec2)
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    async def find_duplicates(self, state: dict) -> Optional[str]:
        """Check Redis for similar incidents within time window"""
        geo_hash = state.get("geo_hash")
        current_fingerprint = state.get("semantic_fingerprint")
        incident_category = state["incident_type"]["category"]
        
        try:
            # Query Redis for recent incidents
            search_key = f"incident:geohash:{geo_hash}:*"
            matching_keys = self.redis_client.keys(search_key)
            
            for key in matching_keys:
                stored_data = self.redis_client.get(key)
                if not stored_data:
                    continue
                
                stored_incident = json.loads(stored_data)
                
                # Check time window
                stored_time = datetime.fromisoformat(stored_incident["timestamp"])
                current_time = state["timestamp"]
                
                if (current_time - stored_time) > timedelta(minutes=self.time_window_minutes):
                    continue
                
                # Check incident type match
                if stored_incident.get("incident_category") != incident_category:
                    continue
                
                # Semantic similarity check
                stored_fingerprint = stored_incident.get("fingerprint", [])
                if stored_fingerprint and current_fingerprint:
                    similarity = self.cosine_similarity(current_fingerprint, stored_fingerprint)
                    
                    if similarity >= self.similarity_threshold:
                        return stored_incident["incident_id"]
        except Exception as e:
            print(f"Dedup error: {e}")
        
        return None
    
    async def store_incident(self, state: dict):
        """Store incident fingerprint in Redis for future dedup checks"""
        geo_hash = state["geo_hash"]
        incident_id = state["incident_id"]
        
        key = f"incident:geohash:{geo_hash}:{incident_id}"
        
        data = {
            "incident_id": incident_id,
            "timestamp": state["timestamp"].isoformat(),
            "incident_category": state["incident_type"]["category"],
            "fingerprint": state["semantic_fingerprint"],
            "location": state["location"]["raw_text"]
        }
        
        try:
            self.redis_client.setex(key, 3600, json.dumps(data))
        except Exception as e:
            print(f"Redis store error: {e}")
    
    async def process(self, state: dict) -> dict:
        """Main deduplication logic"""
        location_text = state["location"]["raw_text"]
        incident_category = state["incident_type"]["category"]
        normalized_text = state["normalized_text"]
        
        # Generate geo-hash
        geo_hash = self.generate_geo_hash(location_text, incident_category)
        
        # Generate semantic fingerprint
        fingerprint = self.compute_semantic_fingerprint(normalized_text)
        
        # Update state with fingerprint
        state["geo_hash"] = geo_hash
        state["semantic_fingerprint"] = fingerprint
        
        # Check for duplicates
        duplicate_id = await self.find_duplicates(state)
        
        is_duplicate = duplicate_id is not None
        
        # Store if not duplicate
        if not is_duplicate:
            await self.store_incident(state)
        
        # Log decision
        state["agent_trail"].append({
            "agent": "deduplication",
            "timestamp": datetime.now(),
            "decision": "Duplicate detected" if is_duplicate else "New incident",
            "reasoning": f"Geo-hash: {geo_hash}, Similarity check: {'matched' if is_duplicate else 'unique'}"
        })
        
        return {
            **state,
            "is_duplicate": is_duplicate,
            "duplicate_of": duplicate_id,
            "geo_hash": geo_hash,
            "semantic_fingerprint": fingerprint
        }
"""
Rate limiting middleware and utilities.
Uses in-memory storage for simplicity, can be upgraded to Redis.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import time

class RateLimitError(Exception):
    """Exception raised when rate limit is exceeded."""
    pass


# In-memory rate limit store
# format: { key: [timestamp1, timestamp2, ...] }
_rate_limit_store: Dict[str, List[datetime]] = {}


def check_rate_limit(
    key: str, 
    max_attempts: int = 5, 
    window_seconds: int = 3600,
    raise_exception: bool = True
) -> bool:
    """
    Check if a key has exceeded rate limit.
    
    Args:
        key: Unique identifier (e.g., 'ip:127.0.0.1', 'phone:1234567890')
        max_attempts: Maximum allowed attempts in window
        window_seconds: Time window in seconds (default 1 hour)
        raise_exception: Whether to raise RateLimitError or return False
        
    Returns:
        True if within limit, False (or raises exception) if exceeded
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=window_seconds)
    
    # Initialize list if not exists
    if key not in _rate_limit_store:
        _rate_limit_store[key] = []
    
    # Clean old entries
    _rate_limit_store[key] = [
        ts for ts in _rate_limit_store[key] 
        if ts > window_start
    ]
    
    # Check limit
    current_count = len(_rate_limit_store[key])
    if current_count >= max_attempts:
        if raise_exception:
            raise RateLimitError(f"Too many attempts. Try again in {window_seconds // 60} minutes.")
        return False
    
    return True


def record_attempt(key: str):
    """
    Record an attempt for rate limiting.
    
    Args:
        key: Unique identifier
    """
    now = datetime.now(timezone.utc)
    if key not in _rate_limit_store:
        _rate_limit_store[key] = []
    _rate_limit_store[key].append(now)


def clear_rate_limit(key: str):
    """
    Clear rate limit for a key (after successful action).
    
    Args:
        key: Unique identifier
    """
    if key in _rate_limit_store:
        del _rate_limit_store[key]


def cleanup_rate_limits():
    """
    Periodic cleanup of empty or expired keys to prevent memory leaks.
    Should be called periodically in a background task.
    """
    now = datetime.now(timezone.utc)
    keys_to_remove = []
    
    for key, timestamps in _rate_limit_store.items():
        # Keep only timestamps within the last 24 hours (generous max window)
        valid_timestamps = [ts for ts in timestamps if (now - ts).total_seconds() < 86400]
        if not valid_timestamps:
            keys_to_remove.append(key)
        else:
            _rate_limit_store[key] = valid_timestamps
            
    for key in keys_to_remove:
        del _rate_limit_store[key]

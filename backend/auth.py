"""
Authentication utilities for Thanni Canuuu multi-vendor system.
Handles PIN hashing, JWT tokens, and session management.
"""
import os
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================
# CONFIGURATION
# ============================================

SECRET_KEY = os.environ.get("SECRET_KEY", "thanni-canuuu-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_DAYS", "7"))

# Password/PIN hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================
# PIN HASHING FUNCTIONS
# ============================================

def hash_pin(pin: str) -> str:
    """
    Hash a PIN using bcrypt.
    
    Args:
        pin: Plain text PIN (typically 4-6 digits)
        
    Returns:
        Bcrypt hashed PIN string
    """
    return pwd_context.hash(pin)


def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """
    Verify a plain PIN against a hashed PIN.
    
    Args:
        plain_pin: Plain text PIN to verify
        hashed_pin: Bcrypt hashed PIN from database
        
    Returns:
        True if PIN matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_pin, hashed_pin)
    except Exception:
        return False


# ============================================
# JWT TOKEN FUNCTIONS
# ============================================

def create_access_token(vendor_id: str, session_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token for a vendor session.
    
    Args:
        vendor_id: The vendor's database ID
        session_id: Unique session identifier (UUID)
        expires_delta: Optional custom expiry time
        
    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "vendor_id": str(vendor_id),
        "session_id": session_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Token payload dict if valid, None if invalid/expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        vendor_id: str = payload.get("vendor_id")
        session_id: str = payload.get("session_id")
        
        if vendor_id is None or session_id is None:
            return None
            
        return payload
    except JWTError:
        return None


# ============================================
# DEVICE FINGERPRINTING
# ============================================

def generate_device_fingerprint(user_agent: str, ip_address: str) -> str:
    """
    Generate a unique device fingerprint from User-Agent and IP.
    
    Args:
        user_agent: Browser/device User-Agent string
        ip_address: Client IP address
        
    Returns:
        SHA256 hash of the combined fingerprint
    """
    fingerprint_data = f"{user_agent}:{ip_address}"
    return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]


def generate_session_id() -> str:
    """
    Generate a unique session ID using UUID4.
    
    Returns:
        UUID4 string
    """
    return str(uuid.uuid4())


# ============================================
# TOKEN EXTRACTION
# ============================================

def extract_token_from_header(authorization: str) -> Optional[str]:
    """
    Extract Bearer token from Authorization header.
    
    Args:
        authorization: Full Authorization header value
        
    Returns:
        Token string if valid Bearer format, None otherwise
    """
    if not authorization:
        return None
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]


# ============================================
# OTP GENERATION & VERIFICATION
# ============================================

import random
import string

def generate_otp(length: int = 6) -> str:
    """
    Generate a numeric OTP.
    
    Args:
        length: Number of digits (default 6)
        
    Returns:
        Random numeric OTP string
    """
    return ''.join(random.choices(string.digits, k=length))


def generate_reset_token() -> str:
    """
    Generate a secure reset token for PIN reset.
    
    Returns:
        32-character hex token
    """
    return hashlib.sha256(os.urandom(32)).hexdigest()[:32]





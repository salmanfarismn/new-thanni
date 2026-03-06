"""
Security middleware and utilities for input sanitization and validation.
"""
import re
import html
from typing import Optional

def sanitize_text(text: str) -> str:
    """
    Sanitize text input to prevent XSS and injection attacks.
    - Strips whitespace
    - Escapes HTML special characters
    - Removes potentially dangerous characters
    
    Args:
        text: Raw input string
        
    Returns:
        Sanitized string
    """
    if not text:
        return ""
    
    # Strip whitespace
    text = text.strip()
    
    # Escape HTML entities (prevents basic XSS)
    text = html.escape(text)
    
    return text


def validate_phone_number(phone: str) -> Optional[str]:
    """
    Validate and normalize Indian phone number.
    Returns normalized E.164 format (+91XXXXXXXXXX) or None if invalid.
    
    Args:
        phone: Input phone number string
        
    Returns:
        Normalized phone string or None
    """
    if not phone:
        return None
        
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    
    # Check length
    if len(digits) == 10:
        return f"+91{digits}"
    elif len(digits) == 12 and digits.startswith('91'):
        return f"+{digits}"
    elif len(digits) > 12:
        # Too long
        return None
    elif len(digits) < 10:
        # Too short
        return None
    
    return None


def is_safe_input(text: str) -> bool:
    """
    Check if input contains suspicious patterns (NoSQL injection, script tags, XSS vectors).
    
    Args:
        text: Input text
        
    Returns:
        True if safe, False if suspicious
    """
    if not text:
        return True
        
    # Check for common NoSQL injection operators if passed as string
    nosql_patterns = [
        r'\$gt', r'\$lt', r'\$ne', r'\$in', r'\$where',
        r'\$regex', r'\$or', r'\$and', r'\$set', r'\$unset',
        r'\$exists', r'\$elemMatch', r'\$nin'
    ]
    
    for pattern in nosql_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False
            
    # Check for script tags and XSS vectors
    xss_patterns = [
        r'<script', r'javascript:', r'data:text/html',
        r'vbscript:', r'on\w+\s*=',  # onclick=, onerror=, etc.
    ]
    for pattern in xss_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False
        
    return True

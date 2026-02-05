"""
Pydantic schemas for authentication and vendor management.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


# ============================================
# VENDOR SCHEMAS
# ============================================

class VendorRegister(BaseModel):
    """Schema for vendor registration."""
    name: str = Field(..., min_length=2, max_length=100, description="Vendor's personal name (e.g., Kumar, Rajesh)")
    business_name: str = Field(..., min_length=2, max_length=100, description="Business/Company name (e.g., Kumar Water Supply)")
    phone: str = Field(..., description="Phone number with country code")
    pin: str = Field(..., min_length=4, max_length=6, description="4-6 digit PIN")
    security_question: str = Field(..., description="Security question for recovery")
    security_answer: str = Field(..., min_length=3, description="Answer to security question")
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        # Remove spaces and dashes
        cleaned = re.sub(r'[\s\-]', '', v)
        # Must be digits, optionally starting with +
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Invalid phone number format. Use format: +919876543210')
        return cleaned
    
    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v


class VendorLogin(BaseModel):
    """Schema for vendor login."""
    phone: str = Field(..., description="Registered phone number")
    pin: str = Field(..., min_length=4, max_length=6, description="Account PIN")
    device_name: Optional[str] = Field(default="Unknown Device", max_length=100, description="Device name for session tracking")
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        cleaned = re.sub(r'[\s\-]', '', v)
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Invalid phone number format')
        return cleaned


class VendorResponse(BaseModel):
    """Schema for vendor data in responses."""
    id: str = Field(..., description="Vendor ID")
    name: str = Field(..., description="Vendor's personal name")
    business_name: str
    phone: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class VendorProfileResponse(BaseModel):
    """Schema for full vendor profile."""
    id: str
    name: str = Field(..., description="Vendor's personal name")
    business_name: str
    phone: str
    is_active: bool
    created_at: datetime
    total_orders: Optional[int] = 0
    total_customers: Optional[int] = 0
    total_revenue: Optional[float] = 0.0


# ============================================
# SESSION SCHEMAS
# ============================================

class SessionResponse(BaseModel):
    """Schema for session data in responses."""
    session_id: str
    device_name: str
    ip_address: str
    created_at: datetime
    last_active: datetime
    is_current: bool = False  # Will be set dynamically
    
    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    """Schema for list of sessions."""
    sessions: List[SessionResponse]
    total: int


# ============================================
# AUTH RESPONSE SCHEMAS
# ============================================

class LoginResponse(BaseModel):
    """Schema for successful login response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiry in seconds")
    vendor: VendorResponse


class MessageResponse(BaseModel):
    """Generic message response."""
    success: bool
    message: str
    data: Optional[dict] = None  # For returning additional data like reset tokens


class ErrorResponse(BaseModel):
    """Error response schema."""
    success: bool = False
    error: str
    detail: Optional[str] = None


# ============================================
# PIN CHANGE SCHEMAS
# ============================================

class PinChangeRequest(BaseModel):
    """Schema for changing PIN."""
    current_pin: str = Field(..., min_length=4, max_length=6)
    new_pin: str = Field(..., min_length=4, max_length=6)
    
    @field_validator('current_pin', 'new_pin')
    @classmethod
    def validate_pin(cls, v):
        if not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v


class ProfileUpdateRequest(BaseModel):
    """Schema for updating vendor profile."""
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Vendor's personal name")
    business_name: Optional[str] = Field(None, min_length=2, max_length=100)


class GreetingResponse(BaseModel):
    """Schema for personalized greeting based on time of day."""
    greeting: str = Field(..., description="Time-based greeting (Good morning, afternoon, evening, night)")
    vendor_name: str = Field(..., description="Vendor's personal name for personalization")
    business_name: str = Field(..., description="Vendor's business name")
    time_of_day: str = Field(..., description="Current time period (morning, afternoon, evening, night)")

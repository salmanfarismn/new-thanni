"""
Role-based authentication guard middleware for Thanni Canuuu.
Provides FastAPI dependencies to enforce vendor/agent role-based access control.
"""
from fastapi import HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Annotated, Dict
from auth import decode_token, extract_token_from_header

security = HTTPBearer(auto_error=False)


async def _extract_payload(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)] = None,
    authorization: Annotated[Optional[str], Header()] = None
) -> Dict:
    """Extract and validate JWT payload from request."""
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization:
        token = extract_token_from_header(authorization)
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please provide a valid access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return payload


async def get_current_user_with_role(
    payload: Dict = Depends(_extract_payload)
) -> Dict:
    """
    Get current user info including role from JWT.
    Returns: {user_id, role, vendor_id, session_id}
    """
    return {
        "user_id": payload.get("user_id", payload.get("vendor_id")),
        "role": payload.get("role", "vendor"),
        "vendor_id": payload.get("vendor_id"),
        "session_id": payload.get("session_id"),
    }


async def require_vendor(
    user: Dict = Depends(get_current_user_with_role)
) -> str:
    """
    Dependency that enforces vendor role.
    Returns vendor_id if authorized.
    Raises 403 if user is not a vendor.
    """
    if user["role"] != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Access denied. Vendor role required."
        )
    return user["vendor_id"]


async def require_agent(
    user: Dict = Depends(get_current_user_with_role)
) -> Dict:
    """
    Dependency that enforces delivery_agent role.
    Returns {agent_id, vendor_id} if authorized.
    Raises 403 if user is not a delivery agent.
    """
    if user["role"] != "delivery_agent":
        raise HTTPException(
            status_code=403,
            detail="Access denied. Delivery agent role required."
        )
    return {
        "agent_id": user["user_id"],
        "vendor_id": user["vendor_id"],
    }

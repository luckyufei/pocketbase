"""JWT utility functions for PocketBase SDK.

This module provides functions for parsing JWT tokens without
signature verification (for client-side use only).
"""

import base64
import json
import time
from typing import Any


def get_token_payload(token: str) -> dict[str, Any]:
    """Extract the payload from a JWT token without verification.
    
    This function decodes the payload part of a JWT token. It does NOT
    verify the signature - this is intended for client-side use where
    we trust the server but need to read token claims.
    
    Args:
        token: The JWT token string.
        
    Returns:
        The decoded payload as a dictionary, or empty dict if invalid.
    """
    if not token:
        return {}

    parts = token.split(".")
    if len(parts) != 3:
        return {}

    try:
        # Get the payload (second part)
        payload_b64 = parts[1]
        
        # Add padding if needed (base64 requires padding to be multiple of 4)
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += "=" * padding

        # Decode base64url (JWT uses URL-safe base64)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        return payload if isinstance(payload, dict) else {}
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def is_token_expired(token: str, threshold_seconds: int = 0) -> bool:
    """Check if a JWT token is expired.
    
    Args:
        token: The JWT token string.
        threshold_seconds: Additional seconds to consider as buffer.
            If the token expires within this threshold, it's considered expired.
            
    Returns:
        True if the token is expired or invalid, False otherwise.
    """
    payload = get_token_payload(token)
    
    if not payload:
        return True
    
    exp = payload.get("exp")
    if exp is None:
        return True
    
    try:
        exp_timestamp = int(exp)
        current_time = int(time.time())
        return current_time + threshold_seconds >= exp_timestamp
    except (ValueError, TypeError):
        return True

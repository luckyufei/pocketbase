"""Auth models for PocketBase SDK.

This module contains models for authentication-related responses including:
- AuthMethodsList: Available authentication methods for a collection
- AuthProviderInfo: OAuth2 provider information
- RecordAuthResponse: Response from authentication endpoints
- OAuthMeta: OAuth2 user metadata
"""

from typing import Any

from pydantic import BaseModel, Field

from pocketbase.models.record import RecordModel


class MFAConfig(BaseModel):
    """MFA (Multi-Factor Authentication) configuration.
    
    Attributes:
        enabled: Whether MFA is enabled for the collection.
        duration: MFA session duration in seconds.
    """
    
    enabled: bool = False
    duration: int = 0


class OTPConfig(BaseModel):
    """OTP (One-Time Password) configuration.
    
    Attributes:
        enabled: Whether OTP is enabled for the collection.
        duration: OTP validity duration in seconds.
    """
    
    enabled: bool = False
    duration: int = 0


class PasswordConfig(BaseModel):
    """Password authentication configuration.
    
    Attributes:
        enabled: Whether password auth is enabled for the collection.
        identityFields: List of fields that can be used as identity (e.g., email, username).
    """
    
    enabled: bool = False
    identityFields: list[str] = Field(default_factory=list)


class AuthProviderInfo(BaseModel):
    """OAuth2 provider information.
    
    Contains details about an OAuth2 authentication provider including
    PKCE (Proof Key for Code Exchange) data for secure authentication.
    
    Attributes:
        name: Provider identifier (e.g., "google", "github").
        displayName: Human-readable provider name.
        state: OAuth2 state parameter for CSRF protection.
        codeVerifier: PKCE code verifier (optional).
        codeChallenge: PKCE code challenge (optional).
        codeChallengeMethod: PKCE challenge method, usually "S256" (optional).
        authURL: Full OAuth2 authorization URL (optional).
    """
    
    name: str
    displayName: str
    state: str
    codeVerifier: str | None = None
    codeChallenge: str | None = None
    codeChallengeMethod: str | None = None
    authURL: str | None = None


class OAuth2Config(BaseModel):
    """OAuth2 authentication configuration.
    
    Attributes:
        enabled: Whether OAuth2 is enabled for the collection.
        providers: List of available OAuth2 providers.
    """
    
    enabled: bool = False
    providers: list[AuthProviderInfo] = Field(default_factory=list)


class AuthMethodsList(BaseModel):
    """List of available authentication methods for a collection.
    
    Returned by the /api/collections/{collection}/auth-methods endpoint.
    
    Attributes:
        mfa: MFA configuration (optional).
        otp: OTP configuration (optional).
        password: Password auth configuration (optional).
        oauth2: OAuth2 configuration (optional).
    
    Example:
        >>> response = pb.collection("users").auth_methods()
        >>> if response.password and response.password.enabled:
        ...     print("Password auth is available")
        >>> if response.oauth2 and response.oauth2.enabled:
        ...     for provider in response.oauth2.providers:
        ...         print(f"OAuth2 provider: {provider.name}")
    """
    
    mfa: MFAConfig | None = None
    otp: OTPConfig | None = None
    password: PasswordConfig | None = None
    oauth2: OAuth2Config | None = None


class OAuthMeta(BaseModel):
    """OAuth2 user metadata from the provider.
    
    Contains user information retrieved from the OAuth2 provider
    during authentication.
    
    Attributes:
        id: User ID from the OAuth2 provider.
        name: User's full name (optional).
        username: User's username (optional).
        email: User's email address (optional).
        isNew: Whether this is a newly created user (optional).
        avatarURL: URL to user's avatar image (optional).
        rawUser: Raw user data from the provider (optional).
    """
    
    id: str
    name: str | None = None
    username: str | None = None
    email: str | None = None
    isNew: bool | None = None
    avatarURL: str | None = None
    rawUser: dict[str, Any] | None = None


class RecordAuthResponse(BaseModel):
    """Response from record authentication endpoints.
    
    Returned by authentication methods like authWithPassword,
    authWithOAuth2, etc.
    
    Attributes:
        token: JWT authentication token.
        record: The authenticated user record.
        meta: OAuth2 metadata (only present for OAuth2 auth).
    
    Example:
        >>> response = pb.collection("users").auth_with_password(
        ...     "user@example.com", "password123"
        ... )
        >>> print(response.token)
        >>> print(response.record.email)
    """
    
    token: str
    record: RecordModel
    meta: dict[str, Any] | None = None

"""Tests for Auth Models - TDD Red Phase 🔴"""

from typing import Any

import pytest


class TestAuthMethodsList:
    """Test suite for AuthMethodsList model."""

    def test_auth_methods_list_from_dict(self) -> None:
        """Test creating AuthMethodsList from dict."""
        from pocketbase.models.auth import AuthMethodsList

        data = {
            "mfa": {"enabled": True, "duration": 300},
            "otp": {"enabled": True, "duration": 300},
            "password": {"enabled": True, "identityFields": ["email", "username"]},
            "oauth2": {
                "enabled": True,
                "providers": [
                    {"name": "google", "displayName": "Google", "state": "abc123"}
                ],
            },
        }

        methods = AuthMethodsList.model_validate(data)

        assert methods.mfa is not None
        assert methods.mfa.enabled is True
        assert methods.otp is not None
        assert methods.otp.enabled is True
        assert methods.password is not None
        assert methods.password.enabled is True
        assert methods.oauth2 is not None
        assert methods.oauth2.enabled is True

    def test_auth_methods_list_empty(self) -> None:
        """Test AuthMethodsList with empty data."""
        from pocketbase.models.auth import AuthMethodsList

        methods = AuthMethodsList.model_validate({})

        assert methods.mfa is None
        assert methods.otp is None
        assert methods.password is None
        assert methods.oauth2 is None

    def test_auth_methods_list_partial(self) -> None:
        """Test AuthMethodsList with partial data."""
        from pocketbase.models.auth import AuthMethodsList

        data = {
            "password": {"enabled": True, "identityFields": ["email"]},
        }

        methods = AuthMethodsList.model_validate(data)

        assert methods.password is not None
        assert methods.password.enabled is True
        assert methods.mfa is None
        assert methods.oauth2 is None


class TestMFAConfig:
    """Test suite for MFA config."""

    def test_mfa_config(self) -> None:
        """Test MFA config parsing."""
        from pocketbase.models.auth import MFAConfig

        data = {"enabled": True, "duration": 300}
        config = MFAConfig.model_validate(data)

        assert config.enabled is True
        assert config.duration == 300

    def test_mfa_config_disabled(self) -> None:
        """Test MFA config when disabled."""
        from pocketbase.models.auth import MFAConfig

        data = {"enabled": False, "duration": 0}
        config = MFAConfig.model_validate(data)

        assert config.enabled is False


class TestOTPConfig:
    """Test suite for OTP config."""

    def test_otp_config(self) -> None:
        """Test OTP config parsing."""
        from pocketbase.models.auth import OTPConfig

        data = {"enabled": True, "duration": 300}
        config = OTPConfig.model_validate(data)

        assert config.enabled is True
        assert config.duration == 300


class TestPasswordConfig:
    """Test suite for Password config."""

    def test_password_config(self) -> None:
        """Test Password config parsing."""
        from pocketbase.models.auth import PasswordConfig

        data = {"enabled": True, "identityFields": ["email", "username"]}
        config = PasswordConfig.model_validate(data)

        assert config.enabled is True
        assert "email" in config.identityFields
        assert "username" in config.identityFields

    def test_password_config_single_field(self) -> None:
        """Test Password config with single identity field."""
        from pocketbase.models.auth import PasswordConfig

        data = {"enabled": True, "identityFields": ["email"]}
        config = PasswordConfig.model_validate(data)

        assert config.identityFields == ["email"]


class TestOAuth2Config:
    """Test suite for OAuth2 config."""

    def test_oauth2_config(self) -> None:
        """Test OAuth2 config parsing."""
        from pocketbase.models.auth import OAuth2Config

        data = {
            "enabled": True,
            "providers": [
                {"name": "google", "displayName": "Google", "state": "abc123"},
                {"name": "github", "displayName": "GitHub", "state": "def456"},
            ],
        }
        config = OAuth2Config.model_validate(data)

        assert config.enabled is True
        assert len(config.providers) == 2
        assert config.providers[0].name == "google"
        assert config.providers[1].name == "github"

    def test_oauth2_config_empty_providers(self) -> None:
        """Test OAuth2 config with no providers."""
        from pocketbase.models.auth import OAuth2Config

        data = {"enabled": False, "providers": []}
        config = OAuth2Config.model_validate(data)

        assert config.enabled is False
        assert len(config.providers) == 0


class TestAuthProviderInfo:
    """Test suite for AuthProviderInfo model."""

    def test_auth_provider_info_basic(self) -> None:
        """Test creating AuthProviderInfo."""
        from pocketbase.models.auth import AuthProviderInfo

        data = {
            "name": "google",
            "displayName": "Google",
            "state": "abc123xyz",
        }

        provider = AuthProviderInfo.model_validate(data)

        assert provider.name == "google"
        assert provider.displayName == "Google"
        assert provider.state == "abc123xyz"

    def test_auth_provider_info_with_pkce(self) -> None:
        """Test AuthProviderInfo with PKCE data."""
        from pocketbase.models.auth import AuthProviderInfo

        data = {
            "name": "google",
            "displayName": "Google",
            "state": "abc123",
            "codeVerifier": "verifier123",
            "codeChallenge": "challenge123",
            "codeChallengeMethod": "S256",
            "authURL": "https://accounts.google.com/o/oauth2/auth?...",
        }

        provider = AuthProviderInfo.model_validate(data)

        assert provider.codeVerifier == "verifier123"
        assert provider.codeChallenge == "challenge123"
        assert provider.codeChallengeMethod == "S256"
        assert "accounts.google.com" in (provider.authURL or "")

    def test_auth_provider_info_minimal(self) -> None:
        """Test AuthProviderInfo with minimal fields."""
        from pocketbase.models.auth import AuthProviderInfo

        data = {
            "name": "github",
            "displayName": "GitHub",
            "state": "state123",
        }

        provider = AuthProviderInfo.model_validate(data)

        assert provider.name == "github"
        assert provider.codeVerifier is None
        assert provider.authURL is None


class TestRecordAuthResponse:
    """Test suite for RecordAuthResponse model."""

    def test_record_auth_response_basic(self, sample_record_data: dict[str, Any]) -> None:
        """Test creating RecordAuthResponse."""
        from pocketbase.models.auth import RecordAuthResponse

        data = {
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "record": sample_record_data,
        }

        response = RecordAuthResponse.model_validate(data)

        assert response.token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        assert response.record is not None
        assert response.record.id == "record123"

    def test_record_auth_response_with_meta(self, sample_record_data: dict[str, Any]) -> None:
        """Test RecordAuthResponse with meta data."""
        from pocketbase.models.auth import RecordAuthResponse

        data = {
            "token": "token123",
            "record": sample_record_data,
            "meta": {
                "id": "oauth_meta_id",
                "name": "John Doe",
                "email": "john@example.com",
                "avatarURL": "https://example.com/avatar.png",
                "rawUser": {"sub": "12345"},
            },
        }

        response = RecordAuthResponse.model_validate(data)

        assert response.meta is not None
        assert response.meta.get("id") == "oauth_meta_id"
        assert response.meta.get("email") == "john@example.com"

    def test_record_auth_response_without_meta(self, sample_record_data: dict[str, Any]) -> None:
        """Test RecordAuthResponse without meta."""
        from pocketbase.models.auth import RecordAuthResponse

        data = {
            "token": "token123",
            "record": sample_record_data,
        }

        response = RecordAuthResponse.model_validate(data)

        assert response.meta is None


class TestOAuthMeta:
    """Test suite for OAuth meta data."""

    def test_oauth_meta_from_dict(self) -> None:
        """Test OAuth meta parsing."""
        from pocketbase.models.auth import OAuthMeta

        data = {
            "id": "oauth_user_id",
            "name": "John Doe",
            "username": "johndoe",
            "email": "john@example.com",
            "isNew": True,
            "avatarURL": "https://example.com/avatar.png",
            "rawUser": {"sub": "12345", "email_verified": True},
        }

        meta = OAuthMeta.model_validate(data)

        assert meta.id == "oauth_user_id"
        assert meta.name == "John Doe"
        assert meta.username == "johndoe"
        assert meta.email == "john@example.com"
        assert meta.isNew is True
        assert meta.avatarURL == "https://example.com/avatar.png"
        assert meta.rawUser is not None

    def test_oauth_meta_minimal(self) -> None:
        """Test OAuth meta with minimal data."""
        from pocketbase.models.auth import OAuthMeta

        data = {"id": "user123"}

        meta = OAuthMeta.model_validate(data)

        assert meta.id == "user123"
        assert meta.name is None
        assert meta.email is None
        assert meta.isNew is None

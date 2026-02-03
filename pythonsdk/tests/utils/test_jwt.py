"""Tests for JWT utilities - TDD Red Phase 🔴"""

import time

import pytest


class TestJwtUtils:
    """Test suite for JWT utility functions."""

    def test_get_token_payload_valid_token(self, valid_token: str) -> None:
        """Test extracting payload from a valid token."""
        from pocketbase.utils.jwt import get_token_payload

        payload = get_token_payload(valid_token)

        assert payload is not None
        assert payload.get("id") == "test_user_id"
        assert payload.get("type") == "authRecord"
        assert payload.get("collectionId") == "_pb_users_auth_"

    def test_get_token_payload_empty_token(self) -> None:
        """Test extracting payload from empty token."""
        from pocketbase.utils.jwt import get_token_payload

        payload = get_token_payload("")

        assert payload == {}

    def test_get_token_payload_invalid_token(self) -> None:
        """Test extracting payload from invalid token."""
        from pocketbase.utils.jwt import get_token_payload

        payload = get_token_payload("invalid.token")

        assert payload == {}

    def test_get_token_payload_malformed_token(self) -> None:
        """Test extracting payload from malformed token."""
        from pocketbase.utils.jwt import get_token_payload

        payload = get_token_payload("not_a_jwt")

        assert payload == {}

    def test_is_token_expired_valid_token(self, valid_token: str) -> None:
        """Test checking expiration of valid (non-expired) token."""
        from pocketbase.utils.jwt import is_token_expired

        # Token with exp=9999999999 should not be expired
        assert is_token_expired(valid_token) is False

    def test_is_token_expired_expired_token(self, expired_token: str) -> None:
        """Test checking expiration of expired token."""
        from pocketbase.utils.jwt import is_token_expired

        # Token with exp=1000000000 should be expired
        assert is_token_expired(expired_token) is True

    def test_is_token_expired_empty_token(self) -> None:
        """Test checking expiration of empty token."""
        from pocketbase.utils.jwt import is_token_expired

        assert is_token_expired("") is True

    def test_is_token_expired_with_threshold(self, valid_token: str) -> None:
        """Test checking expiration with threshold."""
        from pocketbase.utils.jwt import is_token_expired

        # With a huge threshold, even future tokens should be "expired"
        assert is_token_expired(valid_token, threshold_seconds=9999999999999) is True

    def test_is_token_expired_no_exp_claim(self) -> None:
        """Test token without exp claim is considered expired."""
        from pocketbase.utils.jwt import is_token_expired

        # Token without exp: eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InRlc3QifQ.signature
        token_no_exp = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InRlc3QifQ.signature"
        assert is_token_expired(token_no_exp) is True

    def test_get_token_payload_base64_padding(self) -> None:
        """Test that base64 padding is handled correctly."""
        from pocketbase.utils.jwt import get_token_payload

        # Create a token where payload needs padding
        # Payload: {"id":"a"} which base64 is "eyJpZCI6ImEifQ" (no padding needed)
        # But some payloads may need padding
        token = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImEifQ.sig"
        payload = get_token_payload(token)

        assert payload.get("id") == "a"

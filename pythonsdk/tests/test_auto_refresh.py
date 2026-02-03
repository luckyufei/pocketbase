"""Tests for auto refresh mechanism."""

import time
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_httpx import HTTPXMock


class TestAutoRefreshBasics:
    """Test auto refresh basic functionality."""

    def test_auth_with_password_no_auto_refresh(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test auth_with_password without auto refresh."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/auth-with-password",
            json={
                "token": "test_token_123",
                "record": {
                    "id": "user123",
                    "collectionId": "_pb_users_auth_",
                    "collectionName": "users",
                    "created": "",
                    "updated": "",
                },
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").auth_with_password(
            identity="test@example.com",
            password="password123",
        )

        assert result["token"] == "test_token_123"
        # No auto refresh callback should be set
        assert pb._auto_refresh_callback is None

    def test_auth_with_password_with_auto_refresh(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test auth_with_password with auto_refresh_threshold."""
        from pocketbase.client import PocketBase
        import base64
        import json
        
        # Create a token that will expire in the future
        exp_time = int(time.time()) + 3600  # 1 hour from now
        payload = {"id": "user123", "type": "authRecord", "collectionId": "_superusers", "exp": exp_time}
        payload_json = json.dumps(payload)
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
        token = f"header.{payload_b64}.signature"

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/_superusers/auth-with-password",
            json={
                "token": token,
                "record": {
                    "id": "user123",
                    "collectionId": "_superusers",
                    "collectionName": "_superusers",
                    "created": "",
                    "updated": "",
                },
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("_superusers").auth_with_password(
            identity="admin@example.com",
            password="password123",
            auto_refresh_threshold=300,  # 5 minutes
        )

        assert result["token"] == token
        # Auto refresh should be enabled for superusers
        assert pb._auto_refresh_threshold == 300


class TestAutoRefreshCallback:
    """Test auto refresh callback mechanism."""

    def test_set_auto_refresh(self, base_url: str) -> None:
        """Test setting auto refresh callback."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        callback = MagicMock()

        pb.set_auto_refresh(300, callback)

        assert pb._auto_refresh_threshold == 300
        assert pb._auto_refresh_callback is callback

    def test_reset_auto_refresh(self, base_url: str) -> None:
        """Test resetting auto refresh."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        pb._auto_refresh_threshold = 300
        pb._auto_refresh_callback = MagicMock()

        pb.reset_auto_refresh()

        assert pb._auto_refresh_threshold is None
        assert pb._auto_refresh_callback is None


class TestAutoRefreshOnExpiredToken:
    """Test auto refresh on token expiration."""

    def test_auto_refresh_triggered_on_expired_token(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that auto refresh is triggered when token is about to expire."""
        from pocketbase.client import PocketBase
        import base64
        import json

        # Create a token that will expire soon (within threshold)
        exp_time = int(time.time()) + 60  # Expires in 1 minute
        payload = {"id": "user123", "type": "authRecord", "collectionId": "_superusers", "exp": exp_time}
        payload_json = json.dumps(payload)
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
        old_token = f"header.{payload_b64}.signature"

        # New token with longer expiry
        new_exp_time = int(time.time()) + 3600
        new_payload = {"id": "user123", "type": "authRecord", "collectionId": "_superusers", "exp": new_exp_time}
        new_payload_json = json.dumps(new_payload)
        new_payload_b64 = base64.urlsafe_b64encode(new_payload_json.encode()).decode().rstrip("=")
        new_token = f"header.{new_payload_b64}.signature"

        pb = PocketBase(base_url)
        pb.auth_store.save(old_token, {"id": "user123", "collectionId": "_superusers"})

        # Track if refresh was called
        refresh_called = False

        def mock_refresh() -> dict[str, Any]:
            nonlocal refresh_called
            refresh_called = True
            pb.auth_store.save(new_token, {"id": "user123", "collectionId": "_superusers"})
            return {"token": new_token}

        pb.set_auto_refresh(300, mock_refresh)  # 5 minute threshold

        # Mock the actual request
        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/test/records?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 0,
                "totalPages": 0,
                "items": [],
            },
        )

        # Make a request - this should trigger auto refresh since token expires in 60s < 300s threshold
        pb.collection("test").get_list()

        assert refresh_called is True
        assert pb.auth_store.token == new_token

    def test_no_auto_refresh_when_token_valid(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that auto refresh is NOT triggered when token has plenty of time."""
        from pocketbase.client import PocketBase
        import base64
        import json

        # Create a token that won't expire soon
        exp_time = int(time.time()) + 7200  # Expires in 2 hours
        payload = {"id": "user123", "type": "authRecord", "collectionId": "_superusers", "exp": exp_time}
        payload_json = json.dumps(payload)
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
        token = f"header.{payload_b64}.signature"

        pb = PocketBase(base_url)
        pb.auth_store.save(token, {"id": "user123", "collectionId": "_superusers"})

        refresh_called = False

        def mock_refresh() -> dict[str, Any]:
            nonlocal refresh_called
            refresh_called = True
            return {"token": "new_token"}

        pb.set_auto_refresh(300, mock_refresh)  # 5 minute threshold

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/test/records?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 0,
                "totalPages": 0,
                "items": [],
            },
        )

        pb.collection("test").get_list()

        # Auto refresh should NOT be called since token is still valid
        assert refresh_called is False

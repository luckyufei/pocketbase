"""Tests for impersonate functionality."""

import pytest
from pytest_httpx import HTTPXMock


class TestImpersonate:
    """Test impersonate method."""

    def test_impersonate_returns_new_client(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that impersonate returns a new client instance."""
        from pocketbase.client import PocketBase

        # First, authenticate as superuser
        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/_superusers/auth-with-password",
            json={
                "token": "superuser_token",
                "record": {
                    "id": "superuser_id",
                    "collectionId": "_superusers",
                    "collectionName": "_superusers",
                    "created": "",
                    "updated": "",
                },
            },
        )

        # Mock the impersonate endpoint
        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/impersonate/user123",
            json={
                "token": "impersonated_token",
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
        pb.collection("_superusers").auth_with_password("admin@example.com", "password")

        # Impersonate a user
        impersonated_client = pb.collection("users").impersonate("user123", duration=3600)

        # Should return a new client
        assert impersonated_client is not pb
        assert isinstance(impersonated_client, PocketBase)

        # New client should have the impersonated token
        assert impersonated_client.auth_store.token == "impersonated_token"
        assert impersonated_client.auth_store.record is not None
        assert impersonated_client.auth_store.record.id == "user123"

        # Original client should still have superuser token
        assert pb.auth_store.token == "superuser_token"

    def test_impersonate_with_zero_duration(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test impersonate with duration=0 (use default)."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/impersonate/user456",
            json={
                "token": "impersonated_token",
                "record": {
                    "id": "user456",
                    "collectionId": "_pb_users_auth_",
                    "collectionName": "users",
                    "created": "",
                    "updated": "",
                },
            },
        )

        pb = PocketBase(base_url)
        pb.auth_store.save("superuser_token", {"id": "admin"})

        impersonated_client = pb.collection("users").impersonate("user456", duration=0)

        # Verify request body
        import json
        request = httpx_mock.get_request()
        assert request is not None
        body = json.loads(request.content)
        assert body["duration"] == 0

        assert impersonated_client.auth_store.token == "impersonated_token"

    def test_impersonate_preserves_base_url(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that impersonate preserves the base URL."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/impersonate/user789",
            json={
                "token": "token",
                "record": {"id": "user789"},
            },
        )

        pb = PocketBase(base_url)
        pb.auth_store.save("superuser_token", {"id": "admin"})

        impersonated_client = pb.collection("users").impersonate("user789", duration=3600)

        assert impersonated_client.base_url == pb.base_url

    def test_impersonate_preserves_lang(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that impersonate preserves the language setting."""
        from pocketbase.client import PocketBase

        # Mock the impersonate endpoint
        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/impersonate/user123",
            json={
                "token": "impersonated_token",
                "record": {"id": "user123"},
            },
        )

        # Create client with custom language
        pb = PocketBase(base_url, lang="zh-CN")
        pb.auth_store.save("superuser_token", {"id": "admin"})

        impersonated_client = pb.collection("users").impersonate("user123", duration=3600)

        assert impersonated_client.lang == "zh-CN"

    def test_impersonate_sends_auth_header(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that impersonate sends authorization header."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/impersonate/user999",
            json={
                "token": "impersonated_token",
                "record": {"id": "user999"},
            },
        )

        pb = PocketBase(base_url)
        pb.auth_store.save("my_superuser_token", {"id": "admin"})

        pb.collection("users").impersonate("user999", duration=3600)

        # Verify authorization header was sent
        request = httpx_mock.get_request()
        assert request is not None
        assert "my_superuser_token" in str(request.headers.get("Authorization", ""))

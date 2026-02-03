"""Tests for RecordService authentication methods."""

from typing import Any

import pytest
from pytest_httpx import HTTPXMock


class TestRecordServiceAuth:
    """Test suite for RecordService authentication methods."""

    def test_auth_with_password_success(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test successful password authentication."""
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
                    "created": "2024-01-01",
                    "updated": "2024-01-01",
                    "email": "test@example.com",
                },
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").auth_with_password("test@example.com", "password123")

        assert result["token"] == "test_token_123"
        assert pb.auth_store.token == "test_token_123"
        assert pb.auth_store.record is not None
        assert pb.auth_store.record.id == "user123"

    def test_auth_refresh(self, base_url: str, valid_token: str, httpx_mock: HTTPXMock) -> None:
        """Test token refresh."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/auth-refresh",
            json={
                "token": "new_token_456",
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
        pb.auth_store.save(valid_token, None)
        result = pb.collection("users").auth_refresh()

        assert result["token"] == "new_token_456"
        assert pb.auth_store.token == "new_token_456"

    def test_request_password_reset(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test password reset request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/request-password-reset",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").request_password_reset("test@example.com")

        assert result is True

    def test_confirm_password_reset(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test password reset confirmation."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/confirm-password-reset",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").confirm_password_reset(
            "reset_token",
            "newpassword",
            "newpassword",
        )

        assert result is True

    def test_request_verification(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test email verification request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/request-verification",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").request_verification("test@example.com")

        assert result is True

    def test_confirm_verification(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test email verification confirmation."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/confirm-verification",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").confirm_verification("verification_token")

        assert result is True

    def test_request_email_change(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test email change request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/request-email-change",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").request_email_change("new@example.com")

        assert result is True

    def test_confirm_email_change(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test email change confirmation."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/confirm-email-change",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").confirm_email_change("change_token", "password")

        assert result is True

    def test_list_auth_methods(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test listing auth methods."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/users/auth-methods",
            json={
                "usernamePassword": True,
                "emailPassword": True,
                "authProviders": [
                    {"name": "google", "state": "123", "codeVerifier": "456"},
                ],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").list_auth_methods()

        assert result["usernamePassword"] is True
        assert len(result["authProviders"]) == 1

    def test_request_otp(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test OTP request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/request-otp",
            json={"otpId": "otp123"},
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").request_otp("test@example.com")

        assert result["otpId"] == "otp123"

    def test_auth_with_otp(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test OTP authentication."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/auth-with-otp",
            json={
                "token": "otp_token_123",
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
        result = pb.collection("users").auth_with_otp("otp123", "123456")

        assert result["token"] == "otp_token_123"
        assert pb.auth_store.token == "otp_token_123"

    def test_auth_with_oauth2_code(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test OAuth2 code authentication."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/auth-with-oauth2",
            json={
                "token": "oauth_token_123",
                "record": {
                    "id": "user123",
                    "collectionId": "_pb_users_auth_",
                    "collectionName": "users",
                    "created": "",
                    "updated": "",
                },
                "meta": {"name": "John Doe"},
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("users").auth_with_oauth2_code(
            provider="google",
            code="auth_code",
            code_verifier="verifier",
            redirect_url="http://localhost:3000/callback",
        )

        assert result["token"] == "oauth_token_123"
        assert pb.auth_store.token == "oauth_token_123"

    def test_update_syncs_auth_store(self, base_url: str, httpx_mock: HTTPXMock, valid_token: str) -> None:
        """Test that update syncs with auth store when updating auth record."""
        from pocketbase.client import PocketBase
        from pocketbase.models.record import RecordModel

        httpx_mock.add_response(
            method="PATCH",
            url=f"{base_url}/api/collections/users/records/user123",
            json={
                "id": "user123",
                "collectionId": "_pb_users_auth_",
                "collectionName": "users",
                "created": "",
                "updated": "",
                "name": "Updated Name",
            },
        )

        pb = PocketBase(base_url)
        auth_record = RecordModel(id="user123", collection_id="_pb_users_auth_", collection_name="users")
        pb.auth_store.save(valid_token, auth_record)

        pb.collection("users").update("user123", {"name": "Updated Name"})

        # Auth store should be updated
        assert pb.auth_store.record is not None
        assert pb.auth_store.record.name == "Updated Name"  # type: ignore[attr-defined]

    def test_delete_clears_auth_store(self, base_url: str, httpx_mock: HTTPXMock, valid_token: str) -> None:
        """Test that delete clears auth store when deleting auth record."""
        from pocketbase.client import PocketBase
        from pocketbase.models.record import RecordModel

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/users/records/user123",
            status_code=204,
        )

        pb = PocketBase(base_url)
        auth_record = RecordModel(id="user123", collection_id="_pb_users_auth_", collection_name="users")
        pb.auth_store.save(valid_token, auth_record)

        pb.collection("users").delete("user123")

        # Auth store should be cleared
        assert pb.auth_store.token == ""
        assert pb.auth_store.record is None

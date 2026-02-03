"""Tests for SecretsService."""

import pytest
from pytest_httpx import HTTPXMock

from pocketbase.client import PocketBase


class TestSecretsServiceGetList:
    """Tests for SecretsService.get_list()."""

    def test_get_list_returns_secrets(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_list returns list of secrets with masked values."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/secrets",
            json={
                "items": [
                    {
                        "key": "DATABASE_URL",
                        "env": "production",
                        "description": "Main database connection"
                    },
                    {
                        "key": "API_KEY",
                        "env": "all",
                        "description": "External API key"
                    }
                ],
                "total": 2
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.get_list()
        
        assert result["total"] == 2
        assert len(result["items"]) == 2
        assert result["items"][0]["key"] == "DATABASE_URL"


class TestSecretsServiceGet:
    """Tests for SecretsService.get()."""

    def test_get_returns_secret_value(self, httpx_mock: HTTPXMock) -> None:
        """Test that get returns the decrypted secret value."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/secrets/API_KEY",
            json={
                "key": "API_KEY",
                "value": "secret_value_123"
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.get("API_KEY")
        
        assert result["key"] == "API_KEY"
        assert result["value"] == "secret_value_123"


class TestSecretsServiceCreate:
    """Tests for SecretsService.create()."""

    def test_create_secret(self, httpx_mock: HTTPXMock) -> None:
        """Test that create creates a new secret."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/secrets",
            json={
                "key": "NEW_SECRET",
                "env": "production",
                "message": "Secret created successfully"
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.create(
            key="NEW_SECRET",
            value="my_secret_value",
            env="production",
            description="A new secret"
        )
        
        assert result["key"] == "NEW_SECRET"

    def test_create_secret_minimal(self, httpx_mock: HTTPXMock) -> None:
        """Test creating a secret with only required fields."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/secrets",
            json={
                "key": "SIMPLE_KEY",
                "message": "Secret created successfully"
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.create(key="SIMPLE_KEY", value="value123")
        
        assert result["key"] == "SIMPLE_KEY"


class TestSecretsServiceUpdate:
    """Tests for SecretsService.update()."""

    def test_update_secret(self, httpx_mock: HTTPXMock) -> None:
        """Test that update updates an existing secret."""
        httpx_mock.add_response(
            method="PUT",
            url="http://localhost:8090/api/secrets/API_KEY",
            json={
                "key": "API_KEY",
                "message": "Secret updated successfully"
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.update(
            key="API_KEY",
            value="new_secret_value",
            description="Updated description"
        )
        
        assert result["key"] == "API_KEY"


class TestSecretsServiceDelete:
    """Tests for SecretsService.delete()."""

    def test_delete_secret(self, httpx_mock: HTTPXMock) -> None:
        """Test that delete removes a secret."""
        httpx_mock.add_response(
            method="DELETE",
            url="http://localhost:8090/api/secrets/OLD_SECRET",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.secrets.delete("OLD_SECRET")
        
        assert result is True

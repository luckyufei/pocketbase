"""Global pytest fixtures for PocketBase SDK tests."""

from typing import Any

import pytest


@pytest.fixture
def base_url() -> str:
    """Return the base URL for testing."""
    return "http://127.0.0.1:8090"


@pytest.fixture
def valid_token() -> str:
    """Return a valid JWT token for testing.
    
    This is a test token with payload:
    {
        "id": "test_user_id",
        "type": "authRecord",
        "collectionId": "_pb_users_auth_",
        "exp": 9999999999
    }
    """
    # Valid JWT token (header.payload.signature)
    # Payload: {"id":"test_user_id","type":"authRecord","collectionId":"_pb_users_auth_","exp":9999999999}
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3RfdXNlcl9pZCIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjo5OTk5OTk5OTk5fQ.test_signature"


@pytest.fixture
def expired_token() -> str:
    """Return an expired JWT token for testing.
    
    This is a test token with payload:
    {
        "id": "test_user_id",
        "type": "authRecord",
        "collectionId": "_pb_users_auth_",
        "exp": 1000000000
    }
    """
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3RfdXNlcl9pZCIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoxMDAwMDAwMDAwfQ.test_signature"


@pytest.fixture
def superuser_token() -> str:
    """Return a superuser JWT token for testing.
    
    This is a test token with payload:
    {
        "id": "superuser_id",
        "type": "superuser",
        "exp": 9999999999
    }
    """
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN1cGVydXNlcl9pZCIsInR5cGUiOiJzdXBlcnVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.test_signature"


@pytest.fixture
def sample_record_data() -> dict[str, Any]:
    """Return sample record data for testing."""
    return {
        "id": "record123",
        "collectionId": "collection456",
        "collectionName": "posts",
        "created": "2024-01-01 00:00:00.000Z",
        "updated": "2024-01-01 00:00:00.000Z",
        "title": "Test Post",
        "content": "Test content",
    }


@pytest.fixture
def sample_collection_data() -> dict[str, Any]:
    """Return sample collection data for testing."""
    return {
        "id": "collection456",
        "name": "posts",
        "type": "base",
        "schema": [
            {"name": "title", "type": "text"},
            {"name": "content", "type": "text"},
        ],
        "created": "2024-01-01 00:00:00.000Z",
        "updated": "2024-01-01 00:00:00.000Z",
    }

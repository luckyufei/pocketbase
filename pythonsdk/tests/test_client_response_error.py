"""Tests for ClientResponseError - TDD Red Phase 🔴"""

import json
from typing import Any

import pytest


class TestClientResponseError:
    """Test suite for ClientResponseError."""

    def test_create_error_basic(self) -> None:
        """Test creating a basic ClientResponseError."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError()

        assert error.url == ""
        assert error.status == 0
        assert error.response == {}
        assert error.is_abort is False
        assert error.original_error is None

    def test_create_error_with_all_fields(self) -> None:
        """Test creating ClientResponseError with all fields."""
        from pocketbase.client_response_error import ClientResponseError

        original = ValueError("original error")
        error = ClientResponseError(
            url="http://localhost:8090/api/collections/posts",
            status=404,
            response={"message": "Not found"},
            is_abort=False,
            original_error=original,
        )

        assert error.url == "http://localhost:8090/api/collections/posts"
        assert error.status == 404
        assert error.response == {"message": "Not found"}
        assert error.is_abort is False
        assert error.original_error is original

    def test_error_data_property(self) -> None:
        """Test that data property is alias for response."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(
            response={"message": "Test error", "code": 400}
        )

        assert error.data == error.response
        assert error.data == {"message": "Test error", "code": 400}

    def test_error_str_representation(self) -> None:
        """Test string representation of error."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(
            url="http://localhost:8090/api/test",
            status=400,
            response={"message": "Bad request"},
        )

        error_str = str(error)
        assert "400" in error_str
        assert "Bad request" in error_str

    def test_error_is_exception(self) -> None:
        """Test that ClientResponseError is an Exception."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError()

        assert isinstance(error, Exception)

    def test_error_can_be_raised(self) -> None:
        """Test that ClientResponseError can be raised."""
        from pocketbase.client_response_error import ClientResponseError

        with pytest.raises(ClientResponseError) as exc_info:
            raise ClientResponseError(
                url="http://localhost:8090/api/test",
                status=401,
                response={"message": "Unauthorized"},
            )

        assert exc_info.value.status == 401

    def test_error_to_dict(self) -> None:
        """Test converting error to dictionary."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(
            url="http://localhost:8090/api/test",
            status=500,
            response={"message": "Internal error"},
        )

        data = error.to_dict()

        assert data["url"] == "http://localhost:8090/api/test"
        assert data["status"] == 500
        assert data["response"] == {"message": "Internal error"}
        assert data["is_abort"] is False

    def test_error_with_validation_errors(self) -> None:
        """Test error with PocketBase validation errors format."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(
            url="http://localhost:8090/api/collections/posts/records",
            status=400,
            response={
                "code": 400,
                "message": "Failed to create record.",
                "data": {
                    "title": {"code": "validation_required", "message": "Missing required value."},
                    "content": {"code": "validation_min_text_constraint", "message": "Must be at least 10 characters."},
                },
            },
        )

        assert error.status == 400
        assert "title" in error.response.get("data", {})
        assert error.response["data"]["title"]["code"] == "validation_required"

    def test_error_abort_flag(self) -> None:
        """Test error with abort flag."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(is_abort=True)

        assert error.is_abort is True

    def test_error_from_http_response(self) -> None:
        """Test creating error from HTTP response data."""
        from pocketbase.client_response_error import ClientResponseError

        # Simulating httpx response
        http_data = {
            "code": 404,
            "message": "The requested resource wasn't found.",
            "data": {},
        }

        error = ClientResponseError(
            url="http://localhost:8090/api/collections/unknown/records/abc123",
            status=404,
            response=http_data,
        )

        assert error.status == 404
        assert error.response["message"] == "The requested resource wasn't found."

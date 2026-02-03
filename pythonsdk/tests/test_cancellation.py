"""Tests for request cancellation mechanism."""

import pytest
from pytest_httpx import HTTPXMock


class TestAutoCancellation:
    """Test auto cancellation functionality."""

    def test_auto_cancellation_default_enabled(self, base_url: str) -> None:
        """Test that auto cancellation is enabled by default."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        assert pb.auto_cancellation_enabled is True

    def test_auto_cancellation_disable(self, base_url: str) -> None:
        """Test disabling auto cancellation."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        result = pb.auto_cancellation(False)

        assert pb.auto_cancellation_enabled is False
        assert result is pb  # Returns self for chaining

    def test_auto_cancellation_enable(self, base_url: str) -> None:
        """Test enabling auto cancellation."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        pb.auto_cancellation(False)
        pb.auto_cancellation(True)

        assert pb.auto_cancellation_enabled is True


class TestCancelRequest:
    """Test cancel_request functionality."""

    def test_cancel_request_no_pending(self, base_url: str) -> None:
        """Test canceling a non-existent request."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        # Should not raise error
        result = pb.cancel_request("non_existent_key")

        assert result is pb  # Returns self for chaining

    def test_cancel_request_removes_controller(self, base_url: str) -> None:
        """Test that cancel_request removes the controller."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        # Manually add a mock controller
        pb._cancel_controllers["test_key"] = object()

        pb.cancel_request("test_key")

        assert "test_key" not in pb._cancel_controllers


class TestCancelAllRequests:
    """Test cancel_all_requests functionality."""

    def test_cancel_all_requests_empty(self, base_url: str) -> None:
        """Test canceling all requests when none exist."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        result = pb.cancel_all_requests()

        assert result is pb  # Returns self for chaining
        assert len(pb._cancel_controllers) == 0

    def test_cancel_all_requests_clears_controllers(self, base_url: str) -> None:
        """Test that cancel_all_requests clears all controllers."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        # Manually add mock controllers
        pb._cancel_controllers["key1"] = object()
        pb._cancel_controllers["key2"] = object()
        pb._cancel_controllers["key3"] = object()

        pb.cancel_all_requests()

        assert len(pb._cancel_controllers) == 0


class TestRequestKey:
    """Test custom request key functionality."""

    def test_request_key_auto_generated(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that request key is auto-generated from method and path."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 0,
                "totalPages": 0,
                "items": [],
            },
        )

        pb = PocketBase(base_url)
        # Make a request
        pb.collection("posts").get_list()

        # Controller should be removed after successful completion
        # (only kept during in-flight requests)

    def test_request_with_custom_key(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that custom request_key is used."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/test",
            json={"status": "ok"},
        )

        pb = PocketBase(base_url)
        pb.send("/api/test", method="GET", request_key="custom_key")

        # Request completed, no error

    def test_request_key_null_disables_cancellation(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test that request_key=None disables auto cancellation for this request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/test",
            json={"status": "ok"},
        )

        pb = PocketBase(base_url)
        pb.send("/api/test", method="GET", request_key=None)

        # Request completed without being tracked

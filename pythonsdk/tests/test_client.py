"""Tests for PocketBase Client - TDD Red Phase 🔴"""

from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from pytest_httpx import HTTPXMock


class TestPocketBaseClient:
    """Test suite for PocketBase client."""

    def test_client_init_default(self, base_url: str) -> None:
        """Test creating a client with defaults."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)

        assert pb.base_url == base_url
        assert pb.lang == "en-US"
        assert pb.auth_store is not None

    def test_client_init_with_custom_auth_store(self, base_url: str) -> None:
        """Test creating a client with custom auth store."""
        from pocketbase.client import PocketBase
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        pb = PocketBase(base_url, auth_store=store)

        assert pb.auth_store is store

    def test_client_init_with_custom_lang(self, base_url: str) -> None:
        """Test creating a client with custom language."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url, lang="zh-CN")

        assert pb.lang == "zh-CN"

    def test_build_url_simple(self, base_url: str) -> None:
        """Test building URL with simple path."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)

        url = pb.build_url("/api/collections")
        assert url == f"{base_url}/api/collections"

    def test_build_url_with_trailing_slash(self) -> None:
        """Test building URL handles trailing slash in base URL."""
        from pocketbase.client import PocketBase

        pb = PocketBase("http://localhost:8090/")

        url = pb.build_url("/api/collections")
        assert url == "http://localhost:8090/api/collections"

    def test_build_url_without_leading_slash(self, base_url: str) -> None:
        """Test building URL handles path without leading slash."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)

        url = pb.build_url("api/collections")
        assert url == f"{base_url}/api/collections"

    def test_send_get_request(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test sending GET request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={"code": 200, "message": "API is healthy"},
        )

        pb = PocketBase(base_url)
        response = pb.send("/api/health", method="GET")

        assert response == {"code": 200, "message": "API is healthy"}

    def test_send_post_request(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test sending POST request with body."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/posts/records",
            json={"id": "rec123", "title": "Test"},
        )

        pb = PocketBase(base_url)
        response = pb.send(
            "/api/collections/posts/records",
            method="POST",
            body={"title": "Test"},
        )

        assert response == {"id": "rec123", "title": "Test"}

    def test_send_patch_request(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test sending PATCH request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PATCH",
            url=f"{base_url}/api/collections/posts/records/rec123",
            json={"id": "rec123", "title": "Updated"},
        )

        pb = PocketBase(base_url)
        response = pb.send(
            "/api/collections/posts/records/rec123",
            method="PATCH",
            body={"title": "Updated"},
        )

        assert response == {"id": "rec123", "title": "Updated"}

    def test_send_delete_request(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test sending DELETE request."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/posts/records/rec123",
            status_code=204,
        )

        pb = PocketBase(base_url)
        response = pb.send(
            "/api/collections/posts/records/rec123",
            method="DELETE",
        )

        assert response == {}

    def test_send_with_authorization_header(
        self, base_url: str, valid_token: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test that Authorization header is sent when authenticated."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records",
            json={"items": []},
        )

        pb = PocketBase(base_url)
        pb.auth_store.save(valid_token, None)
        pb.send("/api/collections/posts/records", method="GET")

        request = httpx_mock.get_request()
        assert request is not None
        assert request.headers.get("Authorization") == valid_token

    def test_send_with_accept_language_header(
        self, base_url: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test that Accept-Language header is sent."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={"code": 200},
        )

        pb = PocketBase(base_url, lang="de-DE")
        pb.send("/api/health", method="GET")

        request = httpx_mock.get_request()
        assert request is not None
        assert request.headers.get("Accept-Language") == "de-DE"

    def test_send_handles_error_response(
        self, base_url: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test that error responses raise ClientResponseError."""
        from pocketbase.client import PocketBase
        from pocketbase.client_response_error import ClientResponseError

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/unknown/records",
            status_code=404,
            json={"code": 404, "message": "Not found"},
        )

        pb = PocketBase(base_url)

        with pytest.raises(ClientResponseError) as exc_info:
            pb.send("/api/collections/unknown/records", method="GET")

        assert exc_info.value.status == 404
        assert exc_info.value.response["message"] == "Not found"

    def test_send_with_query_params(
        self, base_url: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test sending request with query parameters."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records?page=1&perPage=20",
            json={"items": [], "page": 1},
        )

        pb = PocketBase(base_url)
        response = pb.send(
            "/api/collections/posts/records",
            method="GET",
            params={"page": 1, "perPage": 20},
        )

        assert response["page"] == 1

    def test_collection_method_returns_record_service(self, base_url: str) -> None:
        """Test that collection() returns a RecordService."""
        from pocketbase.client import PocketBase
        from pocketbase.services.record_service import RecordService

        pb = PocketBase(base_url)
        service = pb.collection("posts")

        assert isinstance(service, RecordService)
        assert service.collection_name == "posts"

    def test_collection_method_caches_services(self, base_url: str) -> None:
        """Test that collection() caches RecordService instances."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        service1 = pb.collection("posts")
        service2 = pb.collection("posts")

        assert service1 is service2

    def test_filter_method(self, base_url: str) -> None:
        """Test filter() helper method."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        result = pb.filter("status = {:status}", {"status": True})

        assert "status = true" in result.lower() or "status = 1" in result.lower() or "status = True" in result

    def test_before_send_hook(
        self, base_url: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test before_send hook is called."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={"code": 200},
        )

        pb = PocketBase(base_url)
        hook_called = {"value": False}

        def before_hook(url: str, options: dict[str, Any]) -> tuple[str, dict[str, Any]]:
            hook_called["value"] = True
            return url, options

        pb.before_send = before_hook
        pb.send("/api/health", method="GET")

        assert hook_called["value"] is True

    def test_after_send_hook(
        self, base_url: str, httpx_mock: HTTPXMock
    ) -> None:
        """Test after_send hook is called."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={"code": 200},
        )

        pb = PocketBase(base_url)
        hook_called = {"value": False}

        def after_hook(response: Any) -> Any:
            hook_called["value"] = True
            return response

        pb.after_send = after_hook
        pb.send("/api/health", method="GET")

        assert hook_called["value"] is True

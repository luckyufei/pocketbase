"""Tests for CRUD Service - TDD"""

from typing import Any

import pytest
from pytest_httpx import HTTPXMock


class TestCrudService:
    """Test suite for CrudService."""

    def test_get_list_basic(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test basic get_list functionality."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 2,
                "totalPages": 1,
                "items": [
                    {"id": "rec1", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "title": "Post 1"},
                    {"id": "rec2", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "title": "Post 2"},
                ],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("posts").get_list()

        assert result.page == 1
        assert result.total_items == 2
        assert len(result.items) == 2
        assert result.items[0].id == "rec1"

    def test_get_list_with_pagination(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with custom pagination."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records?page=2&perPage=10",
            json={
                "page": 2,
                "perPage": 10,
                "totalItems": 15,
                "totalPages": 2,
                "items": [
                    {"id": "rec11", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
                ],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("posts").get_list(page=2, per_page=10)

        assert result.page == 2
        assert result.per_page == 10

    def test_get_list_with_filter(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with filter option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"page": 1, "perPage": 30, "totalItems": 0, "totalPages": 0, "items": []},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_list(filter="status = true")

        request = httpx_mock.get_request()
        assert "filter=status" in str(request.url)

    def test_get_full_list(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_full_list fetches all pages."""
        from pocketbase.client import PocketBase

        # First page
        httpx_mock.add_response(
            method="GET",
            json={
                "page": 1,
                "perPage": 2,
                "totalItems": 3,
                "totalPages": 2,
                "items": [
                    {"id": "rec1", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
                    {"id": "rec2", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
                ],
            },
        )
        # Second page
        httpx_mock.add_response(
            method="GET",
            json={
                "page": 2,
                "perPage": 2,
                "totalItems": 3,
                "totalPages": 2,
                "items": [
                    {"id": "rec3", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
                ],
            },
        )

        pb = PocketBase(base_url)
        items = pb.collection("posts").get_full_list(batch_size=2)

        assert len(items) == 3

    def test_get_first_list_item(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_first_list_item returns first match."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={
                "page": 1,
                "perPage": 1,
                "totalItems": 1,
                "totalPages": 1,
                "items": [
                    {"id": "rec1", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "status": True},
                ],
            },
        )

        pb = PocketBase(base_url)
        item = pb.collection("posts").get_first_list_item("status = true")

        assert item.id == "rec1"

    def test_get_first_list_item_not_found(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_first_list_item raises when no match."""
        from pocketbase.client import PocketBase
        from pocketbase.client_response_error import ClientResponseError

        httpx_mock.add_response(
            method="GET",
            json={
                "page": 1,
                "perPage": 1,
                "totalItems": 0,
                "totalPages": 0,
                "items": [],
            },
        )

        pb = PocketBase(base_url)

        with pytest.raises(ClientResponseError) as exc_info:
            pb.collection("posts").get_first_list_item("status = false")

        assert exc_info.value.status == 404

    def test_get_one(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_one fetches single record."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/posts/records/rec123",
            json={"id": "rec123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "title": "Test"},
        )

        pb = PocketBase(base_url)
        item = pb.collection("posts").get_one("rec123")

        assert item.id == "rec123"

    def test_get_one_with_expand(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_one with expand option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"id": "rec123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_one("rec123", expand="author")

        request = httpx_mock.get_request()
        assert "expand=author" in str(request.url)

    def test_create(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test create record."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/posts/records",
            json={"id": "new123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "title": "New Post"},
        )

        pb = PocketBase(base_url)
        item = pb.collection("posts").create({"title": "New Post"})

        assert item.id == "new123"

    def test_update(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test update record."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PATCH",
            url=f"{base_url}/api/collections/posts/records/rec123",
            json={"id": "rec123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": "", "title": "Updated"},
        )

        pb = PocketBase(base_url)
        item = pb.collection("posts").update("rec123", {"title": "Updated"})

        assert item.id == "rec123"

    def test_delete(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test delete record."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/posts/records/rec123",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collection("posts").delete("rec123")

        assert result is True

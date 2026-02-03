"""Tests for CollectionService."""

from typing import Any

import pytest
from pytest_httpx import HTTPXMock


class TestCollectionServiceBasics:
    """Test CollectionService basic functionality."""

    def test_collection_service_base_path(self, base_url: str) -> None:
        """Test that CollectionService has correct base path."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        service = pb.collections

        assert service.base_path == "/api/collections"

    def test_collection_service_inheritance(self, base_url: str) -> None:
        """Test that CollectionService inherits from CrudService."""
        from pocketbase.client import PocketBase
        from pocketbase.services.crud_service import CrudService

        pb = PocketBase(base_url)
        service = pb.collections

        assert isinstance(service, CrudService)


class TestCollectionServiceCRUD:
    """Test CollectionService CRUD operations."""

    def test_get_list(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test getting a list of collections."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 2,
                "totalPages": 1,
                "items": [
                    {
                        "id": "col1",
                        "name": "users",
                        "type": "auth",
                        "schema": [],
                    },
                    {
                        "id": "col2",
                        "name": "posts",
                        "type": "base",
                        "schema": [],
                    },
                ],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collections.get_list()

        assert result.total_items == 2
        assert len(result.items) == 2
        # CollectionModel uses attribute access
        col1 = result.items[0]
        col2 = result.items[1]
        assert col1.name == "users"  # type: ignore[attr-defined]
        assert col2.name == "posts"  # type: ignore[attr-defined]

    def test_get_one(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test getting a single collection by ID."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/col1",
            json={
                "id": "col1",
                "name": "users",
                "type": "auth",
                "schema": [{"name": "email", "type": "email"}],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collections.get_one("col1")

        assert result.id == "col1"
        assert result.name == "users"
        assert result.type == "auth"

    def test_create(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test creating a new collection."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections",
            json={
                "id": "new_col",
                "name": "products",
                "type": "base",
                "schema": [],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collections.create({
            "name": "products",
            "type": "base",
            "schema": [],
        })

        assert result.id == "new_col"
        assert result.name == "products"

    def test_update(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test updating a collection."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PATCH",
            url=f"{base_url}/api/collections/col1",
            json={
                "id": "col1",
                "name": "users_updated",
                "type": "auth",
                "schema": [],
            },
        )

        pb = PocketBase(base_url)
        result = pb.collections.update("col1", {"name": "users_updated"})

        assert result.name == "users_updated"

    def test_delete(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test deleting a collection."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/col1",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collections.delete("col1")

        assert result is True


class TestCollectionServiceTruncate:
    """Test CollectionService truncate method."""

    def test_truncate_by_id(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test truncating a collection by ID."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/col1/truncate",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collections.truncate("col1")

        assert result is True

    def test_truncate_by_name(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test truncating a collection by name."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/posts/truncate",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collections.truncate("posts")

        assert result is True

    def test_truncate_with_special_chars(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test truncating a collection with special characters in name."""
        from pocketbase.client import PocketBase
        from urllib.parse import quote

        # Special character needs URL encoding
        encoded_name = quote("test=", safe="")
        httpx_mock.add_response(
            method="DELETE",
            url=f"{base_url}/api/collections/{encoded_name}/truncate",
            status_code=204,
        )

        pb = PocketBase(base_url)
        result = pb.collections.truncate("test=")

        assert result is True


class TestCollectionServiceImport:
    """Test CollectionService import method."""

    def test_import_collections(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test importing collections."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PUT",
            url=f"{base_url}/api/collections/import",
            status_code=204,
        )

        pb = PocketBase(base_url)
        collections = [
            {"id": "id1", "name": "col1", "type": "base"},
            {"id": "id2", "name": "col2", "type": "base"},
        ]
        result = pb.collections.import_collections(collections)

        assert result is True

        # Verify request body
        request = httpx_mock.get_request()
        assert request is not None
        import json
        body = json.loads(request.content)
        assert body["collections"] == collections
        assert body["deleteMissing"] is False

    def test_import_collections_delete_missing(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test importing collections with deleteMissing=True."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PUT",
            url=f"{base_url}/api/collections/import",
            status_code=204,
        )

        pb = PocketBase(base_url)
        collections = [{"id": "id1", "name": "col1", "type": "base"}]
        result = pb.collections.import_collections(collections, delete_missing=True)

        assert result is True

        # Verify request body
        request = httpx_mock.get_request()
        assert request is not None
        import json
        body = json.loads(request.content)
        assert body["deleteMissing"] is True


class TestCollectionServiceGetScaffolds:
    """Test CollectionService get_scaffolds method."""

    def test_get_scaffolds(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test getting collection scaffolds."""
        from pocketbase.client import PocketBase

        scaffolds_response = {
            "base": {
                "id": "",
                "name": "",
                "type": "base",
                "schema": [],
            },
            "auth": {
                "id": "",
                "name": "",
                "type": "auth",
                "schema": [],
            },
            "view": {
                "id": "",
                "name": "",
                "type": "view",
                "schema": [],
            },
        }

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/collections/meta/scaffolds",
            json=scaffolds_response,
        )

        pb = PocketBase(base_url)
        result = pb.collections.get_scaffolds()

        assert "base" in result
        assert "auth" in result
        assert "view" in result
        assert result["base"]["type"] == "base"
        assert result["auth"]["type"] == "auth"

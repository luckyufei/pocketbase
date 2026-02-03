"""Tests for BatchService."""

import pytest
from pytest_httpx import HTTPXMock

from pocketbase.client import PocketBase


class TestBatchServiceCreateBatch:
    """Tests for BatchService.create_batch()."""

    def test_create_batch_returns_batch_object(self) -> None:
        """Test that create_batch returns a BatchRequest object."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        
        assert batch is not None
        assert hasattr(batch, "collection")
        assert hasattr(batch, "send")


class TestSubBatchServiceOperations:
    """Tests for SubBatchService operations."""

    def test_collection_method_returns_sub_batch(self) -> None:
        """Test that collection returns a SubBatchService."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        sub = batch.collection("posts")
        
        assert sub is not None
        assert hasattr(sub, "create")
        assert hasattr(sub, "update")
        assert hasattr(sub, "delete")
        assert hasattr(sub, "upsert")

    def test_collection_method_caches_sub_batch(self) -> None:
        """Test that collection method caches SubBatchService instances."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        sub1 = batch.collection("posts")
        sub2 = batch.collection("posts")
        
        assert sub1 is sub2

    def test_create_registers_request(self) -> None:
        """Test that create registers a request in the batch."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").create({"title": "Hello"})
        
        # Check internal requests list
        assert len(batch._requests) == 1
        assert batch._requests[0]["method"] == "POST"
        assert "/api/collections/posts/records" in batch._requests[0]["url"]

    def test_update_registers_request(self) -> None:
        """Test that update registers a request in the batch."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").update("record123", {"title": "Updated"})
        
        assert len(batch._requests) == 1
        assert batch._requests[0]["method"] == "PATCH"
        assert "/api/collections/posts/records/record123" in batch._requests[0]["url"]

    def test_delete_registers_request(self) -> None:
        """Test that delete registers a request in the batch."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").delete("record123")
        
        assert len(batch._requests) == 1
        assert batch._requests[0]["method"] == "DELETE"
        assert "/api/collections/posts/records/record123" in batch._requests[0]["url"]

    def test_upsert_registers_request(self) -> None:
        """Test that upsert registers a request in the batch."""
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").upsert({"id": "rec123", "title": "Upserted"})
        
        assert len(batch._requests) == 1
        assert batch._requests[0]["method"] == "PUT"
        assert "/api/collections/posts/records" in batch._requests[0]["url"]


class TestBatchServiceSend:
    """Tests for BatchService.send()."""

    def test_send_empty_batch(self, httpx_mock: HTTPXMock) -> None:
        """Test sending an empty batch."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/batch",
            json=[]
        )
        
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        result = batch.send()
        
        assert result == []

    def test_send_batch_with_create_operation(self, httpx_mock: HTTPXMock) -> None:
        """Test sending a batch with create operation."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/batch",
            json=[
                {
                    "status": 200,
                    "body": {"id": "rec123", "title": "Hello"}
                }
            ]
        )
        
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").create({"title": "Hello"})
        result = batch.send()
        
        assert len(result) == 1
        assert result[0]["status"] == 200
        assert result[0]["body"]["id"] == "rec123"

    def test_send_batch_with_multiple_operations(self, httpx_mock: HTTPXMock) -> None:
        """Test sending a batch with multiple operations."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/batch",
            json=[
                {"status": 200, "body": {"id": "rec1", "title": "Post 1"}},
                {"status": 200, "body": {"id": "rec2", "title": "Post 2"}},
                {"status": 204, "body": None}
            ]
        )
        
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").create({"title": "Post 1"})
        batch.collection("posts").create({"title": "Post 2"})
        batch.collection("posts").delete("rec3")
        result = batch.send()
        
        assert len(result) == 3
        assert result[0]["status"] == 200
        assert result[1]["status"] == 200
        assert result[2]["status"] == 204

    def test_send_batch_with_query_params(self, httpx_mock: HTTPXMock) -> None:
        """Test that query params are appended to request URLs."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/batch",
            json=[{"status": 200, "body": {"id": "rec1"}}]
        )
        
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").create(
            {"title": "Hello"},
            options={"expand": "author", "fields": "id,title"}
        )
        result = batch.send()
        
        # Verify the request was registered with query params
        assert "expand" in batch._requests[0]["url"] or batch._requests[0].get("query")


class TestBatchServiceMultipleCollections:
    """Tests for batch operations across multiple collections."""

    def test_batch_multiple_collections(self, httpx_mock: HTTPXMock) -> None:
        """Test batch operations across multiple collections."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/batch",
            json=[
                {"status": 200, "body": {"id": "post1", "title": "Post"}},
                {"status": 200, "body": {"id": "comment1", "text": "Comment"}}
            ]
        )
        
        client = PocketBase("http://localhost:8090")
        batch = client.create_batch()
        batch.collection("posts").create({"title": "Post"})
        batch.collection("comments").create({"text": "Comment"})
        result = batch.send()
        
        assert len(result) == 2
        assert result[0]["body"]["title"] == "Post"
        assert result[1]["body"]["text"] == "Comment"

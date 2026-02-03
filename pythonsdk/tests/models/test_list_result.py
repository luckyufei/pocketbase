"""Tests for ListResult - TDD Red Phase 🔴"""

from typing import Any

import pytest


class TestListResult:
    """Test suite for ListResult generic model."""

    def test_create_list_result_basic(self) -> None:
        """Test creating a basic ListResult."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        result: ListResult[RecordModel] = ListResult(
            page=1,
            per_page=20,
            total_items=100,
            total_pages=5,
            items=[],
        )

        assert result.page == 1
        assert result.per_page == 20
        assert result.total_items == 100
        assert result.total_pages == 5
        assert result.items == []

    def test_list_result_with_records(self, sample_record_data: dict[str, Any]) -> None:
        """Test ListResult with record items."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        record = RecordModel.model_validate(sample_record_data)
        result: ListResult[RecordModel] = ListResult(
            page=1,
            per_page=20,
            total_items=1,
            total_pages=1,
            items=[record],
        )

        assert len(result.items) == 1
        assert result.items[0].id == "record123"
        assert result.items[0].collection_name == "posts"

    def test_list_result_from_api_response(self) -> None:
        """Test creating ListResult from API response format."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        api_response = {
            "page": 2,
            "perPage": 10,
            "totalItems": 25,
            "totalPages": 3,
            "items": [
                {
                    "id": "rec1",
                    "collectionId": "col1",
                    "collectionName": "posts",
                    "created": "2024-01-01 00:00:00.000Z",
                    "updated": "2024-01-01 00:00:00.000Z",
                    "title": "Post 1",
                },
                {
                    "id": "rec2",
                    "collectionId": "col1",
                    "collectionName": "posts",
                    "created": "2024-01-01 00:00:00.000Z",
                    "updated": "2024-01-01 00:00:00.000Z",
                    "title": "Post 2",
                },
            ],
        }

        result = ListResult[RecordModel].model_validate(api_response)

        assert result.page == 2
        assert result.per_page == 10
        assert result.total_items == 25
        assert result.total_pages == 3
        assert len(result.items) == 2
        assert result.items[0].id == "rec1"
        assert result.items[1].id == "rec2"

    def test_list_result_to_dict(self) -> None:
        """Test converting ListResult to dictionary."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        result: ListResult[RecordModel] = ListResult(
            page=1,
            per_page=20,
            total_items=0,
            total_pages=0,
            items=[],
        )

        data = result.model_dump()

        assert data["page"] == 1
        assert data["per_page"] == 20
        assert data["total_items"] == 0
        assert data["items"] == []

    def test_list_result_empty(self) -> None:
        """Test empty ListResult."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        result: ListResult[RecordModel] = ListResult(
            page=1,
            per_page=20,
            total_items=0,
            total_pages=0,
            items=[],
        )

        assert result.page == 1
        assert result.total_items == 0
        assert len(result.items) == 0

    def test_list_result_json_serialization(self) -> None:
        """Test JSON serialization of ListResult."""
        from pocketbase.models.list_result import ListResult
        from pocketbase.models.record import RecordModel

        result: ListResult[RecordModel] = ListResult(
            page=1,
            per_page=20,
            total_items=0,
            total_pages=0,
            items=[],
        )

        json_str = result.model_dump_json()
        assert '"page":1' in json_str or '"page": 1' in json_str

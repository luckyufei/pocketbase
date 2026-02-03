"""Tests for RecordModel - TDD Red Phase 🔴"""

from typing import Any

import pytest


class TestRecordModel:
    """Test suite for RecordModel."""

    def test_create_record_model_with_required_fields(self) -> None:
        """Test creating a RecordModel with required fields."""
        from pocketbase.models.record import RecordModel

        record = RecordModel(
            id="test123",
            collection_id="col456",
            collection_name="posts",
            created="2024-01-01 00:00:00.000Z",
            updated="2024-01-01 00:00:00.000Z",
        )

        assert record.id == "test123"
        assert record.collection_id == "col456"
        assert record.collection_name == "posts"
        assert record.created == "2024-01-01 00:00:00.000Z"
        assert record.updated == "2024-01-01 00:00:00.000Z"

    def test_create_record_model_with_defaults(self) -> None:
        """Test creating a RecordModel with default values."""
        from pocketbase.models.record import RecordModel

        record = RecordModel()

        assert record.id == ""
        assert record.collection_id == ""
        assert record.collection_name == ""
        assert record.created == ""
        assert record.updated == ""

    def test_record_model_allows_extra_fields(self) -> None:
        """Test that RecordModel allows extra fields."""
        from pocketbase.models.record import RecordModel

        record = RecordModel(
            id="test123",
            collection_id="col456",
            collection_name="posts",
            created="2024-01-01 00:00:00.000Z",
            updated="2024-01-01 00:00:00.000Z",
            title="Test Title",
            content="Test Content",
            custom_field=123,
        )

        assert record.id == "test123"
        assert record.title == "Test Title"  # type: ignore[attr-defined]
        assert record.content == "Test Content"  # type: ignore[attr-defined]
        assert record.custom_field == 123  # type: ignore[attr-defined]

    def test_record_model_from_dict(self, sample_record_data: dict[str, Any]) -> None:
        """Test creating RecordModel from dictionary."""
        from pocketbase.models.record import RecordModel

        record = RecordModel.model_validate(sample_record_data)

        assert record.id == "record123"
        assert record.collection_id == "collection456"
        assert record.collection_name == "posts"
        assert record.title == "Test Post"  # type: ignore[attr-defined]

    def test_record_model_to_dict(self) -> None:
        """Test converting RecordModel to dictionary."""
        from pocketbase.models.record import RecordModel

        record = RecordModel(
            id="test123",
            collection_id="col456",
            collection_name="posts",
            created="2024-01-01 00:00:00.000Z",
            updated="2024-01-01 00:00:00.000Z",
            title="Test Title",
        )

        data = record.model_dump()

        assert data["id"] == "test123"
        assert data["collection_id"] == "col456"
        assert data["title"] == "Test Title"

    def test_record_model_expand_field(self) -> None:
        """Test RecordModel with expand field for relations."""
        from pocketbase.models.record import RecordModel

        record = RecordModel(
            id="test123",
            collection_id="col456",
            collection_name="posts",
            created="2024-01-01 00:00:00.000Z",
            updated="2024-01-01 00:00:00.000Z",
            expand={
                "author": {
                    "id": "user123",
                    "name": "John Doe",
                }
            },
        )

        assert record.expand is not None  # type: ignore[attr-defined]
        assert record.expand["author"]["name"] == "John Doe"  # type: ignore[attr-defined]

    def test_record_model_json_serialization(self) -> None:
        """Test JSON serialization of RecordModel."""
        from pocketbase.models.record import RecordModel

        record = RecordModel(
            id="test123",
            collection_id="col456",
            collection_name="posts",
            created="2024-01-01 00:00:00.000Z",
            updated="2024-01-01 00:00:00.000Z",
        )

        json_str = record.model_dump_json()
        assert "test123" in json_str
        assert "col456" in json_str

"""Tests for CollectionModel - TDD Red Phase 🔴"""

from typing import Any

import pytest


class TestCollectionModel:
    """Test suite for CollectionModel."""

    def test_collection_model_from_dict_base(self) -> None:
        """Test creating CollectionModel from dict with base fields."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts",
            "type": "base",
            "system": False,
        }

        collection = CollectionModel.model_validate(data)

        assert collection.id == "col123"
        assert collection.name == "posts"
        assert collection.type == "base"
        assert collection.system is False

    def test_collection_model_auth_type(self) -> None:
        """Test CollectionModel with auth type."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col456",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "users",
            "type": "auth",
            "system": False,
        }

        collection = CollectionModel.model_validate(data)

        assert collection.type == "auth"

    def test_collection_model_view_type(self) -> None:
        """Test CollectionModel with view type."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col789",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts_view",
            "type": "view",
            "system": False,
        }

        collection = CollectionModel.model_validate(data)

        assert collection.type == "view"

    def test_collection_model_system_collection(self) -> None:
        """Test CollectionModel for system collection."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "_pb_users_auth_",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "_superusers",
            "type": "auth",
            "system": True,
        }

        collection = CollectionModel.model_validate(data)

        assert collection.system is True

    def test_collection_model_with_fields(self) -> None:
        """Test CollectionModel with schema fields."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts",
            "type": "base",
            "system": False,
            "fields": [
                {
                    "id": "field1",
                    "name": "title",
                    "type": "text",
                    "system": False,
                    "required": True,
                },
                {
                    "id": "field2",
                    "name": "content",
                    "type": "editor",
                    "system": False,
                    "required": False,
                },
            ],
        }

        collection = CollectionModel.model_validate(data)

        assert collection.fields is not None
        assert len(collection.fields) == 2
        assert collection.fields[0]["name"] == "title"
        assert collection.fields[1]["name"] == "content"

    def test_collection_model_with_indexes(self) -> None:
        """Test CollectionModel with indexes."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts",
            "type": "base",
            "system": False,
            "indexes": [
                "CREATE INDEX idx_title ON posts (title)",
            ],
        }

        collection = CollectionModel.model_validate(data)

        assert collection.indexes is not None
        assert len(collection.indexes) == 1

    def test_collection_model_with_list_rule(self) -> None:
        """Test CollectionModel with API rules."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts",
            "type": "base",
            "system": False,
            "listRule": "",
            "viewRule": "@request.auth.id != ''",
            "createRule": "@request.auth.id != ''",
            "updateRule": "@request.auth.id = author",
            "deleteRule": "@request.auth.id = author",
        }

        collection = CollectionModel.model_validate(data)

        assert collection.listRule == ""
        assert collection.viewRule == "@request.auth.id != ''"
        assert collection.createRule == "@request.auth.id != ''"
        assert collection.updateRule == "@request.auth.id = author"
        assert collection.deleteRule == "@request.auth.id = author"

    def test_collection_model_with_null_rules(self) -> None:
        """Test CollectionModel with null (admin-only) rules."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "secret_posts",
            "type": "base",
            "system": False,
            "listRule": None,
            "viewRule": None,
            "createRule": None,
            "updateRule": None,
            "deleteRule": None,
        }

        collection = CollectionModel.model_validate(data)

        # null rules mean admin-only access
        assert collection.listRule is None
        assert collection.viewRule is None

    def test_collection_model_model_dump(self) -> None:
        """Test CollectionModel serialization."""
        from pocketbase.models.collection import CollectionModel

        data = {
            "id": "col123",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-02T00:00:00.000Z",
            "name": "posts",
            "type": "base",
            "system": False,
        }

        collection = CollectionModel.model_validate(data)
        dumped = collection.model_dump()

        assert dumped["id"] == "col123"
        assert dumped["name"] == "posts"


class TestFieldSchema:
    """Test suite for FieldSchema model."""

    def test_field_schema_text(self) -> None:
        """Test FieldSchema for text field."""
        from pocketbase.models.collection import FieldSchema

        data = {
            "id": "field1",
            "name": "title",
            "type": "text",
            "system": False,
            "required": True,
        }

        field = FieldSchema.model_validate(data)

        assert field.id == "field1"
        assert field.name == "title"
        assert field.type == "text"
        assert field.required is True

    def test_field_schema_relation(self) -> None:
        """Test FieldSchema for relation field."""
        from pocketbase.models.collection import FieldSchema

        data = {
            "id": "field2",
            "name": "author",
            "type": "relation",
            "system": False,
            "required": False,
            "options": {
                "collectionId": "users123",
                "cascadeDelete": False,
                "maxSelect": 1,
            },
        }

        field = FieldSchema.model_validate(data)

        assert field.type == "relation"
        assert field.options is not None
        assert field.options.get("collectionId") == "users123"

    def test_field_schema_select(self) -> None:
        """Test FieldSchema for select field."""
        from pocketbase.models.collection import FieldSchema

        data = {
            "id": "field3",
            "name": "status",
            "type": "select",
            "system": False,
            "required": True,
            "options": {
                "maxSelect": 1,
                "values": ["draft", "published", "archived"],
            },
        }

        field = FieldSchema.model_validate(data)

        assert field.type == "select"
        assert field.options is not None
        assert "draft" in field.options.get("values", [])

    def test_field_schema_file(self) -> None:
        """Test FieldSchema for file field."""
        from pocketbase.models.collection import FieldSchema

        data = {
            "id": "field4",
            "name": "attachment",
            "type": "file",
            "system": False,
            "required": False,
            "options": {
                "maxSelect": 5,
                "maxSize": 5242880,
                "mimeTypes": ["image/png", "image/jpeg"],
            },
        }

        field = FieldSchema.model_validate(data)

        assert field.type == "file"
        assert field.options is not None
        assert field.options.get("maxSelect") == 5


class TestCollectionTypes:
    """Test collection type constants."""

    def test_collection_type_base(self) -> None:
        """Test base collection type."""
        from pocketbase.models.collection import COLLECTION_TYPE_BASE

        assert COLLECTION_TYPE_BASE == "base"

    def test_collection_type_auth(self) -> None:
        """Test auth collection type."""
        from pocketbase.models.collection import COLLECTION_TYPE_AUTH

        assert COLLECTION_TYPE_AUTH == "auth"

    def test_collection_type_view(self) -> None:
        """Test view collection type."""
        from pocketbase.models.collection import COLLECTION_TYPE_VIEW

        assert COLLECTION_TYPE_VIEW == "view"

"""Tests for FileAuthStore - TDD Red Phase 🔴"""

import json
import os
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest


class TestFileAuthStore:
    """Test suite for FileAuthStore - File-based persistent auth store."""

    def test_file_auth_store_is_subclass_of_base(self) -> None:
        """Test that FileAuthStore is a subclass of BaseAuthStore."""
        from pocketbase.stores.base_auth_store import BaseAuthStore
        from pocketbase.stores.file_auth_store import FileAuthStore

        assert issubclass(FileAuthStore, BaseAuthStore)

    def test_create_file_auth_store_with_path(self) -> None:
        """Test creating FileAuthStore with a file path."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)

            assert store is not None
            assert store.token == ""
            assert store.record is None

    def test_file_auth_store_save_creates_file(self, valid_token: str) -> None:
        """Test that saving creates the auth file."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)

            store.save(valid_token, None)

            assert os.path.exists(file_path)

    def test_file_auth_store_save_and_load(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test saving and loading auth state from file."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")

            # Save
            store1 = FileAuthStore(file_path)
            record = RecordModel.model_validate(sample_record_data)
            store1.save(valid_token, record)

            # Load in new instance
            store2 = FileAuthStore(file_path)

            assert store2.token == valid_token
            assert store2.record is not None
            assert store2.record.id == "record123"

    def test_file_auth_store_clear_removes_data(self, valid_token: str) -> None:
        """Test that clear removes auth data and updates file."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")

            store = FileAuthStore(file_path)
            store.save(valid_token, None)
            store.clear()

            assert store.token == ""
            assert store.record is None

            # Verify file is updated
            store2 = FileAuthStore(file_path)
            assert store2.token == ""

    def test_file_auth_store_auto_loads_on_init(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test that FileAuthStore automatically loads state on init."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")

            # First store saves data
            store1 = FileAuthStore(file_path)
            record = RecordModel.model_validate(sample_record_data)
            store1.save(valid_token, record)

            # New instance should auto-load
            store2 = FileAuthStore(file_path)

            assert store2.token == valid_token
            assert store2.record is not None

    def test_file_auth_store_handles_missing_file(self) -> None:
        """Test that FileAuthStore handles non-existent file gracefully."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "nonexistent.json")
            store = FileAuthStore(file_path)

            # Should not raise, just have empty state
            assert store.token == ""
            assert store.record is None

    def test_file_auth_store_handles_invalid_json(self) -> None:
        """Test that FileAuthStore handles invalid JSON gracefully."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "invalid.json")

            # Write invalid JSON
            with open(file_path, "w") as f:
                f.write("not valid json {{{")

            store = FileAuthStore(file_path)

            # Should not raise, just have empty state
            assert store.token == ""
            assert store.record is None

    def test_file_auth_store_handles_empty_file(self) -> None:
        """Test that FileAuthStore handles empty file gracefully."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "empty.json")

            # Create empty file
            Path(file_path).touch()

            store = FileAuthStore(file_path)

            # Should not raise, just have empty state
            assert store.token == ""
            assert store.record is None

    def test_file_auth_store_creates_parent_dirs(self, valid_token: str) -> None:
        """Test that FileAuthStore creates parent directories if needed."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "nested", "dir", "auth.json")
            store = FileAuthStore(file_path)

            store.save(valid_token, None)

            assert os.path.exists(file_path)

    def test_file_auth_store_is_valid(self, valid_token: str) -> None:
        """Test is_valid works correctly."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)
            store.save(valid_token, None)

            assert store.is_valid is True

    def test_file_auth_store_is_valid_expired(self, expired_token: str) -> None:
        """Test is_valid returns False for expired token."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)
            store.save(expired_token, None)

            assert store.is_valid is False

    def test_file_auth_store_is_superuser(self, superuser_token: str) -> None:
        """Test is_superuser works correctly."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)
            store.save(superuser_token, None)

            assert store.is_superuser is True

    def test_file_auth_store_on_change(self, valid_token: str) -> None:
        """Test on_change callback works."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            callback = MagicMock()
            store = FileAuthStore(file_path)
            store.on_change(callback)

            store.save(valid_token, None)

            callback.assert_called_once()

    def test_file_auth_store_unsubscribe(self, valid_token: str) -> None:
        """Test unsubscribe from change callback."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            callback = MagicMock()
            store = FileAuthStore(file_path)
            unsubscribe = store.on_change(callback)

            unsubscribe()
            store.save(valid_token, None)

            callback.assert_not_called()

    def test_file_auth_store_persistence_across_instances(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test that data persists across multiple FileAuthStore instances."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")

            # Instance 1: Save data
            store1 = FileAuthStore(file_path)
            record = RecordModel.model_validate(sample_record_data)
            store1.save(valid_token, record)
            del store1

            # Instance 2: Should have the data
            store2 = FileAuthStore(file_path)
            assert store2.token == valid_token
            assert store2.record is not None
            assert store2.record.id == "record123"


class TestFileAuthStoreFileFormat:
    """Test the file format used by FileAuthStore."""

    def test_file_format_is_json(self, valid_token: str) -> None:
        """Test that the auth file is valid JSON."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)
            store.save(valid_token, None)

            with open(file_path) as f:
                data = json.load(f)

            assert "token" in data
            assert data["token"] == valid_token

    def test_file_format_includes_record(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test that the auth file includes record data."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)
            record = RecordModel.model_validate(sample_record_data)
            store.save(valid_token, record)

            with open(file_path) as f:
                data = json.load(f)

            assert "record" in data
            assert data["record"]["id"] == "record123"


class TestFileAuthStoreEdgeCases:
    """Test edge cases for FileAuthStore."""

    def test_save_with_none_record(self, valid_token: str) -> None:
        """Test saving with None record."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)

            store.save(valid_token, None)

            store2 = FileAuthStore(file_path)
            assert store2.token == valid_token
            assert store2.record is None

    def test_save_empty_token(self) -> None:
        """Test saving empty token."""
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")
            store = FileAuthStore(file_path)

            store.save("", None)

            store2 = FileAuthStore(file_path)
            assert store2.token == ""

    def test_concurrent_access_safety(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test that concurrent access doesn't corrupt data."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.file_auth_store import FileAuthStore

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "auth.json")

            # Multiple stores accessing same file
            store1 = FileAuthStore(file_path)
            store2 = FileAuthStore(file_path)

            record = RecordModel.model_validate(sample_record_data)
            store1.save(valid_token, record)

            # store2 should be able to reload
            store3 = FileAuthStore(file_path)
            assert store3.token == valid_token

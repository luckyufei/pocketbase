"""Tests for MemoryAuthStore - TDD Red Phase 🔴"""

from typing import Any
from unittest.mock import MagicMock

import pytest


class TestMemoryAuthStore:
    """Test suite for MemoryAuthStore - In-memory auth state store."""

    def test_memory_auth_store_is_subclass_of_base(self) -> None:
        """Test that MemoryAuthStore is a subclass of BaseAuthStore."""
        from pocketbase.stores.base_auth_store import BaseAuthStore
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        assert issubclass(MemoryAuthStore, BaseAuthStore)

    def test_create_memory_auth_store_default(self) -> None:
        """Test creating a memory auth store with defaults."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()

        assert store.token == ""
        assert store.record is None

    def test_memory_auth_store_save_and_retrieve(self, valid_token: str) -> None:
        """Test saving and retrieving token in memory store."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        store.save(valid_token, None)

        assert store.token == valid_token

    def test_memory_auth_store_save_with_record(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test saving token with record in memory store."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        record = RecordModel.model_validate(sample_record_data)
        store.save(valid_token, record)

        assert store.token == valid_token
        assert store.record is not None
        assert store.record.id == "record123"

    def test_memory_auth_store_clear(self, valid_token: str) -> None:
        """Test clearing the memory auth store."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        store.save(valid_token, None)
        store.clear()

        assert store.token == ""
        assert store.record is None

    def test_memory_auth_store_is_valid(self, valid_token: str) -> None:
        """Test is_valid works correctly."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        store.save(valid_token, None)

        assert store.is_valid is True

    def test_memory_auth_store_is_valid_expired(self, expired_token: str) -> None:
        """Test is_valid returns False for expired token."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        store.save(expired_token, None)

        assert store.is_valid is False

    def test_memory_auth_store_is_superuser(self, superuser_token: str) -> None:
        """Test is_superuser works correctly."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        store.save(superuser_token, None)

        assert store.is_superuser is True

    def test_memory_auth_store_on_change(self, valid_token: str) -> None:
        """Test on_change callback works."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        callback = MagicMock()
        store = MemoryAuthStore()
        store.on_change(callback)

        store.save(valid_token, None)

        callback.assert_called_once()

    def test_memory_auth_store_unsubscribe(self, valid_token: str) -> None:
        """Test unsubscribe from change callback."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        callback = MagicMock()
        store = MemoryAuthStore()
        unsubscribe = store.on_change(callback)

        unsubscribe()
        store.save(valid_token, None)

        callback.assert_not_called()

    def test_memory_auth_store_export_to_cookie(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test export_to_cookie works."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store = MemoryAuthStore()
        record = RecordModel.model_validate(sample_record_data)
        store.save(valid_token, record)

        cookie = store.export_to_cookie()

        assert cookie is not None
        assert len(cookie) > 0

    def test_memory_auth_store_load_from_cookie(self, valid_token: str) -> None:
        """Test load_from_cookie works."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store1 = MemoryAuthStore()
        store1.save(valid_token, None)
        cookie = store1.export_to_cookie()

        store2 = MemoryAuthStore()
        store2.load_from_cookie(cookie)

        assert store2.token == valid_token

    def test_memory_auth_store_multiple_instances_independent(
        self, valid_token: str
    ) -> None:
        """Test multiple MemoryAuthStore instances are independent."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store1 = MemoryAuthStore()
        store2 = MemoryAuthStore()

        store1.save(valid_token, None)

        assert store1.token == valid_token
        assert store2.token == ""  # store2 should be empty

    def test_memory_auth_store_data_not_persisted(self, valid_token: str) -> None:
        """Test memory store data is not persisted between instances."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        store1 = MemoryAuthStore()
        store1.save(valid_token, None)

        # Creating a new instance should have empty data
        store2 = MemoryAuthStore()

        assert store2.token == ""
        assert store2.record is None


class TestMemoryAuthStoreAsDefault:
    """Test that MemoryAuthStore is suitable as the default auth store."""

    def test_can_be_used_as_client_default(self) -> None:
        """Test MemoryAuthStore can be used as the default client auth store."""
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        # Should be instantiable without any arguments
        store = MemoryAuthStore()

        assert store is not None
        assert store.token == ""
        assert store.record is None

    def test_memory_store_lifecycle(
        self, valid_token: str, sample_record_data: dict[str, Any]
    ) -> None:
        """Test full lifecycle: create -> save -> validate -> clear."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.memory_auth_store import MemoryAuthStore

        # Create
        store = MemoryAuthStore()
        assert not store.is_valid

        # Save
        record = RecordModel.model_validate(sample_record_data)
        store.save(valid_token, record)
        assert store.is_valid
        assert store.token == valid_token
        assert store.record is not None

        # Clear
        store.clear()
        assert not store.is_valid
        assert store.token == ""
        assert store.record is None

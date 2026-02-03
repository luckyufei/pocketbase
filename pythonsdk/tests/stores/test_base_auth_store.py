"""Tests for BaseAuthStore - TDD Red Phase 🔴"""

from typing import Any
from unittest.mock import MagicMock

import pytest


class TestBaseAuthStore:
    """Test suite for BaseAuthStore."""

    def test_create_auth_store_default(self) -> None:
        """Test creating an auth store with defaults."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()

        assert store.token == ""
        assert store.record is None

    def test_save_and_retrieve_token(self, valid_token: str) -> None:
        """Test saving and retrieving a token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(valid_token, None)

        assert store.token == valid_token

    def test_save_token_with_record(self, valid_token: str, sample_record_data: dict[str, Any]) -> None:
        """Test saving token with record data."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        record = RecordModel.model_validate(sample_record_data)
        store.save(valid_token, record)

        assert store.token == valid_token
        assert store.record is not None
        assert store.record.id == "record123"

    def test_clear_auth_store(self, valid_token: str) -> None:
        """Test clearing the auth store."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(valid_token, None)
        store.clear()

        assert store.token == ""
        assert store.record is None

    def test_is_valid_with_valid_token(self, valid_token: str) -> None:
        """Test is_valid returns True for valid non-expired token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(valid_token, None)

        assert store.is_valid is True

    def test_is_valid_with_expired_token(self, expired_token: str) -> None:
        """Test is_valid returns False for expired token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(expired_token, None)

        assert store.is_valid is False

    def test_is_valid_with_no_token(self) -> None:
        """Test is_valid returns False when no token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()

        assert store.is_valid is False

    def test_is_superuser_with_superuser_token(self, superuser_token: str) -> None:
        """Test is_superuser returns True for superuser token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(superuser_token, None)

        assert store.is_superuser is True

    def test_is_superuser_with_regular_token(self, valid_token: str) -> None:
        """Test is_superuser returns False for regular user token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.save(valid_token, None)

        assert store.is_superuser is False

    def test_is_superuser_with_no_token(self) -> None:
        """Test is_superuser returns False when no token."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()

        assert store.is_superuser is False

    def test_on_change_callback(self, valid_token: str) -> None:
        """Test that on_change callback is called when state changes."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        callback = MagicMock()
        store = BaseAuthStore()
        store.on_change(callback)

        store.save(valid_token, None)

        callback.assert_called_once()

    def test_on_change_multiple_callbacks(self, valid_token: str) -> None:
        """Test multiple on_change callbacks."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        callback1 = MagicMock()
        callback2 = MagicMock()
        store = BaseAuthStore()
        store.on_change(callback1)
        store.on_change(callback2)

        store.save(valid_token, None)

        callback1.assert_called_once()
        callback2.assert_called_once()

    def test_on_change_callback_on_clear(self, valid_token: str) -> None:
        """Test that on_change is called when clearing."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        callback = MagicMock()
        store = BaseAuthStore()
        store.save(valid_token, None)
        store.on_change(callback)

        store.clear()

        callback.assert_called_once()

    def test_on_change_returns_unsubscribe(self, valid_token: str) -> None:
        """Test that on_change returns an unsubscribe function."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        callback = MagicMock()
        store = BaseAuthStore()
        unsubscribe = store.on_change(callback)

        unsubscribe()
        store.save(valid_token, None)

        callback.assert_not_called()

    def test_export_to_cookie(self, valid_token: str, sample_record_data: dict[str, Any]) -> None:
        """Test exporting auth state to cookie string."""
        from pocketbase.models.record import RecordModel
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        record = RecordModel.model_validate(sample_record_data)
        store.save(valid_token, record)

        cookie = store.export_to_cookie()

        assert cookie is not None
        assert len(cookie) > 0

    def test_load_from_cookie(self, valid_token: str) -> None:
        """Test loading auth state from cookie string."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store1 = BaseAuthStore()
        store1.save(valid_token, None)
        cookie = store1.export_to_cookie()

        store2 = BaseAuthStore()
        store2.load_from_cookie(cookie)

        assert store2.token == valid_token

    def test_load_from_cookie_empty(self) -> None:
        """Test loading from empty cookie."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.load_from_cookie("")

        assert store.token == ""
        assert store.record is None

    def test_load_from_cookie_invalid(self) -> None:
        """Test loading from invalid cookie doesn't raise."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.load_from_cookie("invalid_cookie_data")

        # Should not raise, just have empty state
        assert store.token == ""

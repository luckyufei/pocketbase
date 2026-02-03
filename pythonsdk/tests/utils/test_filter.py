"""Tests for filter utility - TDD Red Phase 🔴"""

from datetime import datetime

import pytest


class TestFilterUtils:
    """Test suite for filter utility functions."""

    def test_build_filter_no_params(self) -> None:
        """Test filter with no parameters."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("status = true")
        assert result == "status = true"

    def test_build_filter_empty_params(self) -> None:
        """Test filter with empty params dict."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("status = true", {})
        assert result == "status = true"

    def test_build_filter_boolean_true(self) -> None:
        """Test filter with boolean true value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("status = {:status}", {"status": True})
        assert result == "status = true"

    def test_build_filter_boolean_false(self) -> None:
        """Test filter with boolean false value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("status = {:status}", {"status": False})
        assert result == "status = false"

    def test_build_filter_integer(self) -> None:
        """Test filter with integer value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("count > {:count}", {"count": 10})
        assert result == "count > 10"

    def test_build_filter_float(self) -> None:
        """Test filter with float value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("price < {:price}", {"price": 99.99})
        assert result == "price < 99.99"

    def test_build_filter_string(self) -> None:
        """Test filter with string value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("name = {:name}", {"name": "test"})
        assert result == "name = 'test'"

    def test_build_filter_string_with_quotes(self) -> None:
        """Test filter with string containing quotes."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("name = {:name}", {"name": "it's a test"})
        assert result == "name = 'it\\'s a test'"

    def test_build_filter_datetime(self) -> None:
        """Test filter with datetime value."""
        from pocketbase.utils.filter import build_filter

        dt = datetime(2024, 1, 15, 10, 30, 0)
        result = build_filter("created > {:date}", {"date": dt})
        assert "'2024-01-15 10:30:00" in result

    def test_build_filter_none(self) -> None:
        """Test filter with None value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("field = {:val}", {"val": None})
        assert result == "field = null"

    def test_build_filter_list(self) -> None:
        """Test filter with list value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("id IN {:ids}", {"ids": ["a", "b", "c"]})
        assert result == "id IN ['a', 'b', 'c']"

    def test_build_filter_tuple(self) -> None:
        """Test filter with tuple value."""
        from pocketbase.utils.filter import build_filter

        result = build_filter("id IN {:ids}", {"ids": (1, 2, 3)})
        assert result == "id IN [1, 2, 3]"

    def test_build_filter_multiple_params(self) -> None:
        """Test filter with multiple parameters."""
        from pocketbase.utils.filter import build_filter

        result = build_filter(
            "status = {:status} && count > {:count}",
            {"status": True, "count": 5},
        )
        assert result == "status = true && count > 5"

    def test_build_filter_object_fallback(self) -> None:
        """Test filter with object that needs fallback formatting."""
        from pocketbase.utils.filter import build_filter

        class CustomObj:
            def __str__(self) -> str:
                return "custom_value"

        result = build_filter("field = {:obj}", {"obj": CustomObj()})
        assert result == "field = 'custom_value'"

"""Tests for TraceService."""

import pytest
from unittest.mock import MagicMock, patch

from pocketbase import PocketBase


class TestTraceService:
    """Test cases for TraceService."""

    @pytest.fixture
    def client(self) -> PocketBase:
        """Create a PocketBase client instance."""
        return PocketBase("http://localhost:8090")

    @pytest.fixture
    def mock_send(self, client: PocketBase):
        """Mock the client send method."""
        with patch.object(client, "send") as mock:
            yield mock

    def test_service_accessible(self, client: PocketBase) -> None:
        """Test that trace service is accessible from client."""
        assert hasattr(client, "traces")
        assert client.traces is not None

    def test_list_spans(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test listing spans."""
        mock_send.return_value = {
            "items": [
                {
                    "traceId": "trace-123",
                    "spanId": "span-456",
                    "name": "GET /api/test",
                    "startTime": "2024-01-01T00:00:00Z",
                    "duration": 100,
                    "status": "ok",
                },
            ],
            "totalCount": 1,
            "page": 1,
            "perPage": 20,
        }

        result = client.traces.list_spans()

        assert len(result["items"]) == 1
        assert result["items"][0]["traceId"] == "trace-123"
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/_/trace/spans"

    def test_list_spans_with_filters(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test listing spans with filters."""
        mock_send.return_value = {
            "items": [],
            "totalCount": 0,
            "page": 1,
            "perPage": 20,
        }

        result = client.traces.list_spans(
            trace_id="trace-123",
            name="GET",
            min_duration=100,
            max_duration=1000,
            status=["ok", "error"],
            page=2,
            per_page=50,
        )

        mock_send.assert_called_once()
        params = mock_send.call_args[1]["params"]
        assert params["traceId"] == "trace-123"
        assert params["name"] == "GET"
        assert params["minDuration"] == 100
        assert params["maxDuration"] == 1000
        assert params["status"] == "ok,error"
        assert params["page"] == 2
        assert params["limit"] == 50

    def test_get_spans_by_trace_id(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting spans by trace ID."""
        mock_send.return_value = [
            {
                "traceId": "trace-123",
                "spanId": "span-1",
                "name": "parent",
                "startTime": "2024-01-01T00:00:00Z",
                "duration": 100,
            },
            {
                "traceId": "trace-123",
                "spanId": "span-2",
                "parentSpanId": "span-1",
                "name": "child",
                "startTime": "2024-01-01T00:00:00Z",
                "duration": 50,
            },
        ]

        result = client.traces.get_by_trace_id("trace-123")

        assert len(result) == 2
        assert result[0]["name"] == "parent"
        mock_send.assert_called_once()
        assert "/api/_/trace/spans/trace-123" in mock_send.call_args[0][0]

    def test_get_span(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting a single span."""
        mock_send.return_value = {
            "traceId": "trace-123",
            "spanId": "span-456",
            "name": "GET /api/test",
            "startTime": "2024-01-01T00:00:00Z",
            "duration": 100,
            "status": "ok",
            "attributes": {"http.method": "GET"},
        }

        result = client.traces.get_span("trace-123", "span-456")

        assert result["spanId"] == "span-456"
        mock_send.assert_called_once()
        assert "/api/_/trace/spans/trace-123/span-456" in mock_send.call_args[0][0]

    def test_delete_by_trace_id(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test deleting spans by trace ID."""
        mock_send.return_value = {}

        client.traces.delete_by_trace_id("trace-123")

        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "/api/_/trace/spans/trace-123" in call_args[0][0]
        assert call_args[1]["method"] == "DELETE"

    def test_list_dyed_users(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test listing dyed users."""
        mock_send.return_value = {
            "items": [
                {
                    "userId": "user-123",
                    "expiresAt": "2024-01-02T00:00:00Z",
                    "reason": "debugging",
                    "operator": "admin",
                },
            ],
        }

        result = client.traces.list_dyed_users()

        assert len(result["items"]) == 1
        assert result["items"][0]["userId"] == "user-123"
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/_/trace/dyed-users"

    def test_add_dyed_user(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test adding a dyed user."""
        mock_send.return_value = {
            "userId": "user-123",
            "expiresAt": "2024-01-02T00:00:00Z",
        }

        result = client.traces.add_dyed_user(
            user_id="user-123",
            ttl_seconds=3600,
            reason="debugging",
        )

        assert result["userId"] == "user-123"
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] == "/api/_/trace/dyed-users"
        assert call_args[1]["method"] == "POST"
        assert call_args[1]["body"]["userId"] == "user-123"
        assert call_args[1]["body"]["ttl"] == 3600

    def test_remove_dyed_user(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test removing a dyed user."""
        mock_send.return_value = {}

        client.traces.remove_dyed_user("user-123")

        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "/api/_/trace/dyed-users/user-123" in call_args[0][0]
        assert call_args[1]["method"] == "DELETE"

    def test_update_dyed_user_ttl(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test updating dyed user TTL."""
        mock_send.return_value = {
            "userId": "user-123",
            "expiresAt": "2024-01-03T00:00:00Z",
        }

        result = client.traces.update_dyed_user_ttl("user-123", ttl_seconds=7200)

        assert result["userId"] == "user-123"
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "/api/_/trace/dyed-users/user-123/ttl" in call_args[0][0]
        assert call_args[1]["method"] == "PUT"
        assert call_args[1]["body"]["ttl"] == 7200

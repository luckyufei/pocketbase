"""Tests for AnalyticsService."""

import pytest
from unittest.mock import MagicMock, patch

from pocketbase import PocketBase


class TestAnalyticsService:
    """Test cases for AnalyticsService."""

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
        """Test that analytics service is accessible from client."""
        assert hasattr(client, "analytics")
        assert client.analytics is not None

    def test_track_event(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test tracking a single event."""
        mock_send.return_value = {"accepted": 1, "total": 1}

        result = client.analytics.track_event(
            event="pageview",
            path="/home",
            referrer="https://google.com",
        )

        assert result["accepted"] == 1
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] == "/api/analytics/events"
        assert call_args[1]["method"] == "POST"
        body = call_args[1]["body"]
        assert len(body["events"]) == 1
        assert body["events"][0]["event"] == "pageview"
        assert body["events"][0]["path"] == "/home"

    def test_track_events_batch(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test tracking multiple events."""
        mock_send.return_value = {"accepted": 3, "total": 3}

        events = [
            {"event": "pageview", "path": "/home"},
            {"event": "pageview", "path": "/about"},
            {"event": "click", "path": "/contact", "data": {"button": "submit"}},
        ]
        result = client.analytics.track_events(events)

        assert result["accepted"] == 3
        mock_send.assert_called_once()
        body = mock_send.call_args[1]["body"]
        assert len(body["events"]) == 3

    def test_get_stats(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting analytics stats."""
        mock_send.return_value = {
            "summary": {
                "totalPV": 1000,
                "totalUV": 500,
                "bounceRate": 0,
                "avgDur": 0,
            },
            "daily": [
                {"date": "2024-01-01", "pv": 500, "uv": 250},
                {"date": "2024-01-02", "pv": 500, "uv": 250},
            ],
            "startDate": "2024-01-01",
            "endDate": "2024-01-07",
        }

        result = client.analytics.get_stats(range="7d")

        assert result["summary"]["totalPV"] == 1000
        assert len(result["daily"]) == 2
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/stats"
        assert mock_send.call_args[1]["params"]["range"] == "7d"

    def test_get_top_pages(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting top pages."""
        mock_send.return_value = {
            "pages": [
                {"path": "/home", "pv": 500, "visitors": 200},
                {"path": "/about", "pv": 300, "visitors": 150},
            ],
            "startDate": "2024-01-01",
            "endDate": "2024-01-07",
        }

        result = client.analytics.get_top_pages(range="7d", limit=10)

        assert len(result["pages"]) == 2
        assert result["pages"][0]["path"] == "/home"
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/top-pages"
        assert mock_send.call_args[1]["params"]["limit"] == 10

    def test_get_top_sources(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting top sources."""
        mock_send.return_value = {
            "sources": [
                {"source": "google.com", "visitors": 200},
                {"source": "twitter.com", "visitors": 100},
            ],
            "startDate": "2024-01-01",
            "endDate": "2024-01-07",
        }

        result = client.analytics.get_top_sources(range="7d", limit=10)

        assert len(result["sources"]) == 2
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/top-sources"

    def test_get_devices(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting device statistics."""
        mock_send.return_value = {
            "browsers": [
                {"name": "Chrome", "visitors": 400},
                {"name": "Firefox", "visitors": 100},
            ],
            "os": [
                {"name": "Windows", "visitors": 300},
                {"name": "macOS", "visitors": 200},
            ],
            "startDate": "2024-01-01",
            "endDate": "2024-01-07",
        }

        result = client.analytics.get_devices(range="7d")

        assert len(result["browsers"]) == 2
        assert len(result["os"]) == 2
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/devices"

    def test_get_config(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting analytics config."""
        mock_send.return_value = {
            "enabled": True,
            "retention": 90,
            "flushInterval": 30,
            "hasS3": False,
        }

        result = client.analytics.get_config()

        assert result["enabled"] is True
        assert result["retention"] == 90
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/config"

    def test_get_raw_logs(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test getting raw log dates."""
        mock_send.return_value = {
            "dates": ["2024-01-01", "2024-01-02"],
        }

        result = client.analytics.get_raw_logs()

        assert len(result["dates"]) == 2
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "/api/analytics/raw-logs"

    def test_get_raw_log_download_url(self, client: PocketBase) -> None:
        """Test building raw log download URL."""
        url = client.analytics.get_raw_log_download_url("2024-01-01")

        assert "2024-01-01" in url
        assert "/api/analytics/raw-logs/" in url

    def test_track_event_with_session_id(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test tracking event with session ID."""
        mock_send.return_value = {"accepted": 1, "total": 1}

        result = client.analytics.track_event(
            event="pageview",
            path="/home",
            session_id="session-123",
        )

        assert result["accepted"] == 1
        body = mock_send.call_args[1]["body"]
        assert body["events"][0]["sessionId"] == "session-123"

    def test_track_event_with_extra_fields(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test tracking event with extra custom fields."""
        mock_send.return_value = {"accepted": 1, "total": 1}

        result = client.analytics.track_event(
            event="purchase",
            path="/checkout",
            session_id="session-123",
            order_id="ORD-456",
            amount=99.99,
        )

        assert result["accepted"] == 1
        body = mock_send.call_args[1]["body"]
        event = body["events"][0]
        assert event["order_id"] == "ORD-456"
        assert event["amount"] == 99.99

    def test_is_enabled_returns_true(self, client: PocketBase, mock_send: MagicMock) -> None:
        """Test is_enabled returns True when analytics is enabled."""
        mock_send.return_value = {"accepted": 0, "total": 0}

        result = client.analytics.is_enabled()

        assert result is True

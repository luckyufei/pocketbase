"""AnalyticsService for PocketBase analytics API."""

from typing import Any

from pocketbase.services.base_service import BaseService


class AnalyticsService(BaseService):
    """Service for interacting with analytics endpoints.
    
    Provides methods for tracking analytics events and querying statistics.
    """

    def track_event(
        self,
        event: str,
        path: str,
        referrer: str | None = None,
        visitor_id: str | None = None,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Track a single analytics event.
        
        Args:
            event: Event type (e.g., "pageview", "click").
            path: Page path.
            referrer: Referrer URL.
            visitor_id: Unique visitor identifier.
            data: Additional event data.
            
        Returns:
            Response with accepted count.
        """
        event_data: dict[str, Any] = {
            "event": event,
            "path": path,
        }
        if referrer:
            event_data["referrer"] = referrer
        if visitor_id:
            event_data["visitorId"] = visitor_id
        if data:
            event_data["data"] = data

        return self.track_events([event_data])

    def track_events(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        """Track multiple analytics events.
        
        Args:
            events: List of event data dictionaries.
            
        Returns:
            Response with accepted and total counts.
        """
        return self.client.send(
            "/api/analytics/events",
            method="POST",
            body={"events": events},
        )

    def get_stats(
        self,
        range: str = "7d",  # noqa: A002
    ) -> dict[str, Any]:
        """Get analytics statistics.
        
        Args:
            range: Date range (e.g., "today", "7d", "30d", "90d").
            
        Returns:
            Statistics summary with daily data.
        """
        return self.client.send(
            "/api/analytics/stats",
            method="GET",
            params={"range": range},
        )

    def get_top_pages(
        self,
        range: str = "7d",  # noqa: A002
        limit: int = 10,
    ) -> dict[str, Any]:
        """Get top pages by page views.
        
        Args:
            range: Date range.
            limit: Maximum number of results.
            
        Returns:
            Top pages with PV and visitor counts.
        """
        return self.client.send(
            "/api/analytics/top-pages",
            method="GET",
            params={"range": range, "limit": limit},
        )

    def get_top_sources(
        self,
        range: str = "7d",  # noqa: A002
        limit: int = 10,
    ) -> dict[str, Any]:
        """Get top traffic sources.
        
        Args:
            range: Date range.
            limit: Maximum number of results.
            
        Returns:
            Top sources with visitor counts.
        """
        return self.client.send(
            "/api/analytics/top-sources",
            method="GET",
            params={"range": range, "limit": limit},
        )

    def get_devices(
        self,
        range: str = "7d",  # noqa: A002
    ) -> dict[str, Any]:
        """Get device statistics.
        
        Args:
            range: Date range.
            
        Returns:
            Browser and OS distribution.
        """
        return self.client.send(
            "/api/analytics/devices",
            method="GET",
            params={"range": range},
        )

    def get_config(self) -> dict[str, Any]:
        """Get analytics configuration.
        
        Returns:
            Analytics config (enabled, retention, etc.).
        """
        return self.client.send(
            "/api/analytics/config",
            method="GET",
        )

    def get_raw_logs(self) -> dict[str, Any]:
        """Get list of available raw log dates.
        
        Returns:
            List of available dates for download.
        """
        return self.client.send(
            "/api/analytics/raw-logs",
            method="GET",
        )

    def get_raw_log_download_url(self, date: str) -> str:
        """Get download URL for raw logs of a specific date.
        
        Args:
            date: Date in YYYY-MM-DD format.
            
        Returns:
            Full URL for downloading raw logs.
        """
        return self.client.build_url(f"/api/analytics/raw-logs/{date}")

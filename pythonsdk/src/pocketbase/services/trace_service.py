"""TraceService for PocketBase trace API."""

from typing import Any

from pocketbase.services.base_service import BaseService


class TraceService(BaseService):
    """Service for interacting with trace endpoints.
    
    Provides methods for querying trace spans and managing dyed users.
    """

    def list_spans(
        self,
        trace_id: str | None = None,
        parent_span_id: str | None = None,
        name: str | None = None,
        min_duration: int | None = None,
        max_duration: int | None = None,
        status: list[str] | None = None,
        start_time_from: str | None = None,
        start_time_to: str | None = None,
        page: int = 1,
        per_page: int = 20,
        order_by: str | None = None,
        order_desc: bool = True,
    ) -> dict[str, Any]:
        """List trace spans with filtering and pagination.
        
        Args:
            trace_id: Filter by trace ID.
            parent_span_id: Filter by parent span ID.
            name: Filter by span name.
            min_duration: Minimum duration in milliseconds.
            max_duration: Maximum duration in milliseconds.
            status: Filter by status(es).
            start_time_from: Start time from (RFC3339).
            start_time_to: Start time to (RFC3339).
            page: Page number.
            per_page: Items per page.
            order_by: Field to order by.
            order_desc: Order descending.
            
        Returns:
            Paginated list of spans.
        """
        params: dict[str, Any] = {
            "page": page,
            "limit": per_page,
        }
        
        if trace_id:
            params["traceId"] = trace_id
        if parent_span_id:
            params["parentSpanId"] = parent_span_id
        if name:
            params["name"] = name
        if min_duration is not None:
            params["minDuration"] = min_duration
        if max_duration is not None:
            params["maxDuration"] = max_duration
        if status:
            params["status"] = ",".join(status)
        if start_time_from:
            params["startTimeFrom"] = start_time_from
        if start_time_to:
            params["startTimeTo"] = start_time_to
        if order_by:
            params["orderBy"] = order_by
        if not order_desc:
            params["orderDir"] = "asc"

        return self.client.send(
            "/api/_/trace/spans",
            method="GET",
            params=params,
        )

    def get_by_trace_id(self, trace_id: str) -> list[dict[str, Any]]:
        """Get all spans for a trace ID.
        
        Args:
            trace_id: The trace ID.
            
        Returns:
            List of spans in the trace.
        """
        result = self.client.send(
            f"/api/_/trace/spans/{trace_id}",
            method="GET",
        )
        # API returns a list directly
        if isinstance(result, list):
            return result
        return result.get("items", [])

    def get_span(self, trace_id: str, span_id: str) -> dict[str, Any]:
        """Get a single span.
        
        Args:
            trace_id: The trace ID.
            span_id: The span ID.
            
        Returns:
            Span details.
        """
        return self.client.send(
            f"/api/_/trace/spans/{trace_id}/{span_id}",
            method="GET",
        )

    def delete_by_trace_id(self, trace_id: str) -> None:
        """Delete all spans for a trace ID.
        
        Args:
            trace_id: The trace ID to delete.
        """
        self.client.send(
            f"/api/_/trace/spans/{trace_id}",
            method="DELETE",
        )

    def list_dyed_users(self) -> dict[str, Any]:
        """List all dyed (traced) users.
        
        Returns:
            List of dyed users with their settings.
        """
        return self.client.send(
            "/api/_/trace/dyed-users",
            method="GET",
        )

    def add_dyed_user(
        self,
        user_id: str,
        ttl_seconds: int,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Add a user to the dyed users list.
        
        Args:
            user_id: The user ID to dye.
            ttl_seconds: Time to live in seconds.
            reason: Reason for dyeing.
            
        Returns:
            Created dyed user entry.
        """
        body: dict[str, Any] = {
            "userId": user_id,
            "ttl": ttl_seconds,
        }
        if reason:
            body["reason"] = reason

        return self.client.send(
            "/api/_/trace/dyed-users",
            method="POST",
            body=body,
        )

    def remove_dyed_user(self, user_id: str) -> None:
        """Remove a user from the dyed users list.
        
        Args:
            user_id: The user ID to remove.
        """
        self.client.send(
            f"/api/_/trace/dyed-users/{user_id}",
            method="DELETE",
        )

    def update_dyed_user_ttl(
        self,
        user_id: str,
        ttl_seconds: int,
    ) -> dict[str, Any]:
        """Update the TTL for a dyed user.
        
        Args:
            user_id: The user ID.
            ttl_seconds: New time to live in seconds.
            
        Returns:
            Updated dyed user entry.
        """
        return self.client.send(
            f"/api/_/trace/dyed-users/{user_id}/ttl",
            method="PUT",
            body={"ttl": ttl_seconds},
        )

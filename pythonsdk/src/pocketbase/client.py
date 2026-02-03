"""PocketBase Client - Main entry point for the SDK."""

from typing import TYPE_CHECKING, Any, Callable

import httpx

from pocketbase.client_response_error import ClientResponseError
from pocketbase.services.record_service import RecordService
from pocketbase.stores.base_auth_store import BaseAuthStore
from pocketbase.utils.filter import build_filter
from pocketbase.utils.jwt import is_token_expired

if TYPE_CHECKING:
    from pocketbase.services.analytics_service import AnalyticsService
    from pocketbase.services.backup_service import BackupService
    from pocketbase.services.batch_service import BatchService
    from pocketbase.services.collection_service import CollectionService
    from pocketbase.services.cron_service import CronService
    from pocketbase.services.file_service import FileService
    from pocketbase.services.health_service import HealthService
    from pocketbase.services.jobs_service import JobsService
    from pocketbase.services.log_service import LogService
    from pocketbase.services.realtime_service import RealtimeService
    from pocketbase.services.secrets_service import SecretsService
    from pocketbase.services.settings_service import SettingsService
    from pocketbase.services.trace_service import TraceService


class PocketBase:
    """PocketBase API client.
    
    Main entry point for interacting with a PocketBase server.
    
    Attributes:
        base_url: The base URL of the PocketBase server.
        lang: The language code for Accept-Language header.
        auth_store: The authentication state store.
    """

    def __init__(
        self,
        base_url: str,
        auth_store: BaseAuthStore | None = None,
        lang: str = "en-US",
    ) -> None:
        """Initialize the PocketBase client.
        
        Args:
            base_url: The base URL of the PocketBase server.
            auth_store: Custom authentication store (uses BaseAuthStore by default).
            lang: Language code for Accept-Language header.
        """
        # Remove trailing slash from base URL
        self._base_url = base_url.rstrip("/")
        self._lang = lang
        self._auth_store = auth_store or BaseAuthStore()
        
        # HTTP client
        self._http_client = httpx.Client(timeout=30.0)
        
        # Service cache
        self._record_services: dict[str, RecordService] = {}
        self._analytics_service: AnalyticsService | None = None
        self._backup_service: BackupService | None = None
        self._collection_service: CollectionService | None = None
        self._cron_service: CronService | None = None
        self._realtime_service: RealtimeService | None = None
        self._file_service: FileService | None = None
        self._health_service: HealthService | None = None
        self._jobs_service: JobsService | None = None
        self._log_service: LogService | None = None
        self._secrets_service: SecretsService | None = None
        self._settings_service: SettingsService | None = None
        self._trace_service: TraceService | None = None
        
        # Request cancellation
        self._cancel_controllers: dict[str, object] = {}
        self._enable_auto_cancellation: bool = True
        
        # Auto refresh
        self._auto_refresh_threshold: int | None = None
        self._auto_refresh_callback: Callable[[], dict[str, Any]] | None = None
        
        # Hooks
        self.before_send: Callable[[str, dict[str, Any]], tuple[str, dict[str, Any]]] | None = None
        self.after_send: Callable[[Any], Any] | None = None

    @property
    def base_url(self) -> str:
        """Get the base URL."""
        return self._base_url

    @property
    def lang(self) -> str:
        """Get the language code."""
        return self._lang

    @property
    def auth_store(self) -> BaseAuthStore:
        """Get the authentication store."""
        return self._auth_store

    @property
    def analytics(self) -> "AnalyticsService":
        """Get the AnalyticsService for analytics tracking and stats."""
        if self._analytics_service is None:
            from pocketbase.services.analytics_service import AnalyticsService
            self._analytics_service = AnalyticsService(self)
        return self._analytics_service

    @property
    def backups(self) -> "BackupService":
        """Get the BackupService for backup management."""
        if self._backup_service is None:
            from pocketbase.services.backup_service import BackupService
            self._backup_service = BackupService(self)
        return self._backup_service

    @property
    def collections(self) -> "CollectionService":
        """Get the CollectionService for managing collections."""
        if self._collection_service is None:
            from pocketbase.services.collection_service import CollectionService
            self._collection_service = CollectionService(self)
        return self._collection_service

    @property
    def crons(self) -> "CronService":
        """Get the CronService for cron job management."""
        if self._cron_service is None:
            from pocketbase.services.cron_service import CronService
            self._cron_service = CronService(self)
        return self._cron_service

    @property
    def realtime(self) -> "RealtimeService":
        """Get the RealtimeService for SSE subscriptions."""
        if self._realtime_service is None:
            from pocketbase.services.realtime_service import RealtimeService
            self._realtime_service = RealtimeService(self)
        return self._realtime_service

    @property
    def files(self) -> "FileService":
        """Get the FileService for file URL building and token management."""
        if self._file_service is None:
            from pocketbase.services.file_service import FileService
            self._file_service = FileService(self)
        return self._file_service

    @property
    def health(self) -> "HealthService":
        """Get the HealthService for API health checks."""
        if self._health_service is None:
            from pocketbase.services.health_service import HealthService
            self._health_service = HealthService(self)
        return self._health_service

    @property
    def jobs(self) -> "JobsService":
        """Get the JobsService for background job management."""
        if self._jobs_service is None:
            from pocketbase.services.jobs_service import JobsService
            self._jobs_service = JobsService(self)
        return self._jobs_service

    @property
    def logs(self) -> "LogService":
        """Get the LogService for log management."""
        if self._log_service is None:
            from pocketbase.services.log_service import LogService
            self._log_service = LogService(self)
        return self._log_service

    @property
    def secrets(self) -> "SecretsService":
        """Get the SecretsService for encrypted secrets management."""
        if self._secrets_service is None:
            from pocketbase.services.secrets_service import SecretsService
            self._secrets_service = SecretsService(self)
        return self._secrets_service

    @property
    def settings(self) -> "SettingsService":
        """Get the SettingsService for system settings management."""
        if self._settings_service is None:
            from pocketbase.services.settings_service import SettingsService
            self._settings_service = SettingsService(self)
        return self._settings_service

    @property
    def traces(self) -> "TraceService":
        """Get the TraceService for distributed tracing."""
        if self._trace_service is None:
            from pocketbase.services.trace_service import TraceService
            self._trace_service = TraceService(self)
        return self._trace_service

    @property
    def auto_cancellation_enabled(self) -> bool:
        """Check if auto cancellation is enabled."""
        return self._enable_auto_cancellation

    def auto_cancellation(self, enable: bool) -> "PocketBase":
        """Enable or disable auto cancellation for pending duplicate requests.
        
        Args:
            enable: Whether to enable auto cancellation.
            
        Returns:
            Self for method chaining.
        """
        self._enable_auto_cancellation = bool(enable)
        return self

    def cancel_request(self, request_key: str) -> "PocketBase":
        """Cancel a single request by its cancellation key.
        
        Args:
            request_key: The request key to cancel.
            
        Returns:
            Self for method chaining.
        """
        if request_key in self._cancel_controllers:
            del self._cancel_controllers[request_key]
        return self

    def cancel_all_requests(self) -> "PocketBase":
        """Cancel all pending requests.
        
        Returns:
            Self for method chaining.
        """
        self._cancel_controllers.clear()
        return self

    def set_auto_refresh(
        self,
        threshold: int,
        refresh_callback: Callable[[], dict[str, Any]],
    ) -> "PocketBase":
        """Set auto refresh for the auth token.
        
        When enabled, the client will automatically refresh the auth token
        before making requests if the token is about to expire.
        
        Args:
            threshold: Time in seconds before expiration to trigger refresh.
            refresh_callback: Function to call to refresh the token.
            
        Returns:
            Self for method chaining.
        """
        self._auto_refresh_threshold = threshold
        self._auto_refresh_callback = refresh_callback
        return self

    def reset_auto_refresh(self) -> "PocketBase":
        """Reset/disable auto refresh.
        
        Returns:
            Self for method chaining.
        """
        self._auto_refresh_threshold = None
        self._auto_refresh_callback = None
        return self

    def _check_auto_refresh(self) -> None:
        """Check and perform auto refresh if needed."""
        if (
            self._auto_refresh_threshold is not None
            and self._auto_refresh_callback is not None
            and self._auth_store.token
            and is_token_expired(self._auth_store.token, self._auto_refresh_threshold)
        ):
            try:
                self._auto_refresh_callback()
            except Exception:
                # If refresh fails, continue with the current token
                pass

    def build_url(self, path: str) -> str:
        """Build a full URL from a path.
        
        Args:
            path: The API path.
            
        Returns:
            The full URL.
        """
        # Ensure path starts with /
        if not path.startswith("/"):
            path = "/" + path
        return f"{self._base_url}{path}"

    def send(
        self,
        path: str,
        method: str = "GET",
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        request_key: str | None = "",
    ) -> dict[str, Any]:
        """Send an HTTP request to the PocketBase API.
        
        Args:
            path: The API path.
            method: HTTP method (GET, POST, PATCH, DELETE).
            params: Query parameters.
            body: Request body (JSON).
            headers: Additional headers.
            request_key: Custom request key for cancellation. If empty, auto-generated.
                        If None, disables auto cancellation for this request.
            
        Returns:
            The response body as a dictionary.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        url = self.build_url(path)
        
        # Auto refresh token if needed
        self._check_auto_refresh()
        
        # Build request options
        options: dict[str, Any] = {
            "method": method,
            "params": params,
            "body": body,
            "headers": headers or {},
        }
        
        # Add default headers
        options["headers"]["Accept-Language"] = self._lang
        
        # Add authorization header if authenticated
        if self._auth_store.token:
            options["headers"]["Authorization"] = self._auth_store.token
        
        # Call before_send hook
        if self.before_send:
            url, options = self.before_send(url, options)
        
        # Prepare request
        request_headers = options.get("headers", {})
        request_params = options.get("params")
        request_body = options.get("body")
        
        try:
            response = self._http_client.request(
                method=options.get("method", method),
                url=url,
                params=request_params,
                json=request_body,
                headers=request_headers,
            )
            
            # Check for errors
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {"message": response.text or "Request failed"}
                
                raise ClientResponseError(
                    url=str(response.url),
                    status=response.status_code,
                    response=error_data,
                )
            
            # Parse response
            if response.status_code == 204 or not response.content:
                result: dict[str, Any] = {}
            else:
                result = response.json()
            
            # Call after_send hook
            if self.after_send:
                result = self.after_send(result)
            
            return result
            
        except httpx.RequestError as e:
            raise ClientResponseError(
                url=url,
                status=0,
                response={"message": str(e)},
                original_error=e,
            )

    def collection(self, name: str) -> RecordService:
        """Get a RecordService for a collection.
        
        Args:
            name: The collection name.
            
        Returns:
            RecordService for the collection.
        """
        if name not in self._record_services:
            self._record_services[name] = RecordService(self, name)
        return self._record_services[name]

    def create_batch(self) -> "BatchService":
        """Create a new batch request builder.
        
        Returns:
            BatchService for building batch requests.
        """
        from pocketbase.services.batch_service import BatchService
        return BatchService(self)

    def filter(self, expression: str, params: dict[str, Any] | None = None) -> str:
        """Build a filter expression with parameter substitution.
        
        Args:
            expression: The filter expression with {:param} placeholders.
            params: Dictionary of parameter values.
            
        Returns:
            The filter expression with substituted values.
        """
        return build_filter(expression, params)

    def __del__(self) -> None:
        """Clean up resources."""
        if hasattr(self, "_http_client"):
            self._http_client.close()

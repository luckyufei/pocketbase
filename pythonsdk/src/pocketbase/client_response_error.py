"""ClientResponseError - PocketBase API error response."""

from typing import Any


class ClientResponseError(Exception):
    """PocketBase API error response.
    
    This exception is raised when a PocketBase API request fails.
    
    Attributes:
        url: The URL of the failed request.
        status: The HTTP status code of the response.
        response: The response body as a dictionary.
        is_abort: Whether the request was aborted/cancelled.
        original_error: The original exception that caused this error.
    """

    def __init__(
        self,
        url: str = "",
        status: int = 0,
        response: dict[str, Any] | None = None,
        is_abort: bool = False,
        original_error: Exception | None = None,
    ) -> None:
        """Initialize ClientResponseError.
        
        Args:
            url: The URL of the failed request.
            status: The HTTP status code of the response.
            response: The response body as a dictionary.
            is_abort: Whether the request was aborted/cancelled.
            original_error: The original exception that caused this error.
        """
        self.url = url
        self.status = status
        self.response = response or {}
        self.is_abort = is_abort
        self.original_error = original_error

        # Build error message
        message = self.response.get("message", "")
        if not message and status:
            message = f"Request failed with status {status}"

        super().__init__(message)

    @property
    def data(self) -> dict[str, Any]:
        """Alias for response (backward compatibility with JS SDK).
        
        Returns:
            The response dictionary.
        """
        return self.response

    def to_dict(self) -> dict[str, Any]:
        """Convert error to dictionary.
        
        Returns:
            Dictionary representation of the error.
        """
        return {
            "url": self.url,
            "status": self.status,
            "response": self.response,
            "is_abort": self.is_abort,
        }

    def __str__(self) -> str:
        """Return string representation of the error.
        
        Returns:
            Human-readable error string.
        """
        message = self.response.get("message", "Unknown error")
        return f"ClientResponseError {self.status}: {message}"

    def __repr__(self) -> str:
        """Return repr of the error.
        
        Returns:
            Developer-friendly representation.
        """
        return (
            f"ClientResponseError("
            f"url={self.url!r}, "
            f"status={self.status}, "
            f"response={self.response!r}, "
            f"is_abort={self.is_abort})"
        )

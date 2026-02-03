"""BaseAuthStore - Base authentication state store."""

import base64
import json
from typing import TYPE_CHECKING, Any, Callable

from pocketbase.utils.jwt import get_token_payload, is_token_expired

if TYPE_CHECKING:
    from pocketbase.models.record import RecordModel


class BaseAuthStore:
    """Base authentication state store.
    
    This class manages the authentication state (token and record)
    and provides methods for checking validity and superuser status.
    
    Attributes:
        token: The current authentication token.
        record: The current authenticated user record.
    """

    def __init__(self) -> None:
        """Initialize an empty auth store."""
        self._token: str = ""
        self._record: "RecordModel | None" = None
        self._callbacks: list[Callable[[], None]] = []

    @property
    def token(self) -> str:
        """Get the current authentication token."""
        return self._token

    @property
    def record(self) -> "RecordModel | None":
        """Get the current authenticated user record."""
        return self._record

    @property
    def is_valid(self) -> bool:
        """Check if the current token is valid (present and not expired).
        
        Returns:
            True if token exists and is not expired, False otherwise.
        """
        if not self._token:
            return False
        return not is_token_expired(self._token)

    @property
    def is_superuser(self) -> bool:
        """Check if the current token belongs to a superuser.
        
        Returns:
            True if token has superuser type, False otherwise.
        """
        if not self._token:
            return False
        
        payload = get_token_payload(self._token)
        return payload.get("type") == "superuser"

    def save(self, token: str, record: "RecordModel | None") -> None:
        """Save authentication data.
        
        Args:
            token: The authentication token.
            record: The authenticated user record.
        """
        self._token = token
        self._record = record
        self._trigger_change()

    def clear(self) -> None:
        """Clear all authentication data."""
        self._token = ""
        self._record = None
        self._trigger_change()

    def on_change(self, callback: Callable[[], None]) -> Callable[[], None]:
        """Register a callback to be called when auth state changes.
        
        Args:
            callback: Function to call when state changes.
            
        Returns:
            Unsubscribe function that removes the callback.
        """
        self._callbacks.append(callback)

        def unsubscribe() -> None:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

        return unsubscribe

    def _trigger_change(self) -> None:
        """Trigger all registered change callbacks."""
        for callback in self._callbacks:
            callback()

    def export_to_cookie(self, key: str = "pb_auth") -> str:
        """Export authentication state to a cookie-safe string.
        
        Args:
            key: The cookie key name (not used in base implementation).
            
        Returns:
            Base64-encoded JSON string of the auth state.
        """
        data: dict[str, Any] = {
            "token": self._token,
        }
        
        if self._record is not None:
            data["record"] = self._record.model_dump()

        json_str = json.dumps(data)
        return base64.b64encode(json_str.encode("utf-8")).decode("utf-8")

    def load_from_cookie(self, cookie: str, key: str = "pb_auth") -> None:
        """Load authentication state from a cookie string.
        
        Args:
            cookie: Base64-encoded JSON string of the auth state.
            key: The cookie key name (not used in base implementation).
        """
        if not cookie:
            return

        try:
            json_str = base64.b64decode(cookie.encode("utf-8")).decode("utf-8")
            data = json.loads(json_str)

            token = data.get("token", "")
            record_data = data.get("record")

            if record_data:
                from pocketbase.models.record import RecordModel
                record = RecordModel.model_validate(record_data)
            else:
                record = None

            self._token = token
            self._record = record
            # Don't trigger change on load
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            # Invalid cookie data, keep current state
            pass

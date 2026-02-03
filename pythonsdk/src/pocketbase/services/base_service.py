"""BaseService - Base class for all PocketBase services."""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class BaseService:
    """Base class for all PocketBase API services.
    
    Provides common functionality for interacting with the PocketBase API.
    
    Attributes:
        client: The PocketBase client instance.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the service.
        
        Args:
            client: The PocketBase client instance.
        """
        self._client = client

    @property
    def client(self) -> "PocketBase":
        """Get the PocketBase client."""
        return self._client

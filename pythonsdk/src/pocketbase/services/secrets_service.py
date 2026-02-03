"""SecretsService - Service for managing PocketBase secrets."""

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class SecretsService(BaseService):
    """Service for managing PocketBase secrets.
    
    Provides methods to list, get, create, update and delete encrypted secrets.
    Requires PB_MASTER_KEY environment variable to be set on the server.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the SecretsService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client)

    def get_list(self) -> dict[str, Any]:
        """Get list of all secrets (with masked values).
        
        Returns:
            Dict with items array and total count.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        return self._client.send("/api/secrets", method="GET")

    def get(self, key: str) -> dict[str, Any]:
        """Get a secret's decrypted value.
        
        Args:
            key: The secret key.
            
        Returns:
            Dict with key and decrypted value.
            
        Raises:
            ClientResponseError: If the request fails or secret not found.
        """
        return self._client.send(f"/api/secrets/{quote(key, safe='')}", method="GET")

    def create(
        self,
        key: str,
        value: str,
        env: str = "",
        description: str = ""
    ) -> dict[str, Any]:
        """Create a new secret.
        
        Args:
            key: The secret key.
            value: The secret value to encrypt and store.
            env: Optional environment name.
            description: Optional description.
            
        Returns:
            Dict with created secret info.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        body: dict[str, Any] = {
            "key": key,
            "value": value,
        }
        if env:
            body["env"] = env
        if description:
            body["description"] = description
        
        return self._client.send("/api/secrets", method="POST", body=body)

    def update(
        self,
        key: str,
        value: str,
        description: str = ""
    ) -> dict[str, Any]:
        """Update an existing secret.
        
        Args:
            key: The secret key to update.
            value: The new secret value.
            description: Optional new description.
            
        Returns:
            Dict with updated secret info.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        body: dict[str, Any] = {
            "value": value,
        }
        if description:
            body["description"] = description
        
        return self._client.send(
            f"/api/secrets/{quote(key, safe='')}",
            method="PUT",
            body=body
        )

    def delete(self, key: str) -> bool:
        """Delete a secret.
        
        Args:
            key: The secret key to delete.
            
        Returns:
            True if deletion was successful.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        self._client.send(f"/api/secrets/{quote(key, safe='')}", method="DELETE")
        return True

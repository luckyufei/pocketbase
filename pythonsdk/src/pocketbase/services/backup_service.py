"""BackupService - Service for managing PocketBase backups."""

import os
from typing import TYPE_CHECKING, Any
from urllib.parse import quote, urlencode

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class BackupService(BaseService):
    """Service for managing PocketBase backups.
    
    Provides methods to list, create, upload, delete, restore backups
    and get download URLs.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the BackupService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client)

    def get_full_list(self) -> list[dict[str, Any]]:
        """Get list of all available backups.
        
        Returns:
            List of backup file info dicts with keys: key, size, modified.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        result = self._client.send("/api/backups", method="GET")
        # The API returns a list directly
        if isinstance(result, list):
            return result
        return []

    def create(self, name: str = "") -> bool:
        """Create a new backup.
        
        Args:
            name: Optional backup file name (must end with .zip).
                  If not provided, auto-generated.
                  
        Returns:
            True if backup creation started successfully.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        body = {}
        if name:
            body["name"] = name
            
        self._client.send("/api/backups", method="POST", body=body)
        return True

    def upload(self, file_path: str) -> bool:
        """Upload a backup file.
        
        Args:
            file_path: Path to the zip file to upload.
            
        Returns:
            True if upload was successful.
            
        Raises:
            ClientResponseError: If the request fails.
            FileNotFoundError: If the file doesn't exist.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Backup file not found: {file_path}")
        
        # For file uploads, we need to use multipart form data
        # We'll use the raw httpx client for this
        import httpx
        
        file_name = os.path.basename(file_path)
        url = self._client.build_url("/api/backups/upload")
        
        headers: dict[str, str] = {
            "Accept-Language": self._client.lang,
        }
        if self._client.auth_store.token:
            headers["Authorization"] = self._client.auth_store.token
        
        with open(file_path, "rb") as f:
            files = {"file": (file_name, f, "application/zip")}
            response = self._client._http_client.post(
                url,
                files=files,
                headers=headers,
            )
        
        if response.status_code >= 400:
            from pocketbase.client_response_error import ClientResponseError
            try:
                error_data = response.json()
            except Exception:
                error_data = {"message": response.text or "Upload failed"}
            raise ClientResponseError(
                url=str(response.url),
                status=response.status_code,
                response=error_data,
            )
        
        return True

    def delete(self, key: str) -> bool:
        """Delete a backup file.
        
        Args:
            key: The backup file key/name.
            
        Returns:
            True if deletion was successful.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        self._client.send(f"/api/backups/{quote(key, safe='')}", method="DELETE")
        return True

    def restore(self, key: str) -> bool:
        """Restore from a backup.
        
        Note: This will restart the server after restoration.
        
        Args:
            key: The backup file key/name to restore from.
            
        Returns:
            True if restore was initiated successfully.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        self._client.send(
            f"/api/backups/{quote(key, safe='')}/restore",
            method="POST"
        )
        return True

    def get_download_url(self, key: str, token: str = "") -> str:
        """Build the download URL for a backup file.
        
        Args:
            key: The backup file key/name.
            token: Optional file token for authentication.
            
        Returns:
            The download URL.
        """
        url = self._client.build_url(f"/api/backups/{quote(key, safe='')}")
        
        if token:
            params = urlencode({"token": token})
            url = f"{url}?{params}"
        
        return url

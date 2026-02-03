"""FileAuthStore - File-based persistent authentication state store."""

import json
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pocketbase.stores.base_auth_store import BaseAuthStore

if TYPE_CHECKING:
    from pocketbase.models.record import RecordModel


class FileAuthStore(BaseAuthStore):
    """File-based persistent authentication state store.
    
    This store persists authentication data to a JSON file,
    allowing auth state to survive process restarts.
    
    This store is suitable for:
    - CLI tools that need persistent login
    - Desktop applications
    - Server applications with persistent auth
    
    Example:
        >>> from pocketbase import PocketBase
        >>> from pocketbase.stores.file_auth_store import FileAuthStore
        >>> 
        >>> # Create client with file-based auth store
        >>> auth_store = FileAuthStore("~/.myapp/auth.json")
        >>> pb = PocketBase("http://localhost:8090", auth_store=auth_store)
        >>> 
        >>> # Auth state will persist across restarts
        >>> pb.collection("users").auth_with_password("user@example.com", "password")
    
    Attributes:
        file_path: Path to the JSON file for storing auth state.
    """

    def __init__(self, file_path: str) -> None:
        """Initialize a file-based auth store.
        
        Args:
            file_path: Path to the JSON file for storing auth state.
                       Parent directories will be created if they don't exist.
        """
        super().__init__()
        self._file_path = os.path.expanduser(file_path)
        self._load_from_file()

    @property
    def file_path(self) -> str:
        """Get the file path used for storage."""
        return self._file_path

    def save(self, token: str, record: "RecordModel | None") -> None:
        """Save authentication data to file.
        
        Args:
            token: The authentication token.
            record: The authenticated user record.
        """
        self._token = token
        self._record = record
        self._save_to_file()
        self._trigger_change()

    def clear(self) -> None:
        """Clear all authentication data and update file."""
        self._token = ""
        self._record = None
        self._save_to_file()
        self._trigger_change()

    def _load_from_file(self) -> None:
        """Load authentication state from file."""
        if not os.path.exists(self._file_path):
            return

        try:
            with open(self._file_path, encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return
                
                data = json.loads(content)
                
                self._token = data.get("token", "")
                
                record_data = data.get("record")
                if record_data:
                    from pocketbase.models.record import RecordModel
                    self._record = RecordModel.model_validate(record_data)
                else:
                    self._record = None
                    
        except (json.JSONDecodeError, OSError, ValueError):
            # Invalid file, keep empty state
            self._token = ""
            self._record = None

    def _save_to_file(self) -> None:
        """Save authentication state to file."""
        # Create parent directories if needed
        parent_dir = os.path.dirname(self._file_path)
        if parent_dir:
            Path(parent_dir).mkdir(parents=True, exist_ok=True)

        data: dict[str, Any] = {
            "token": self._token,
        }
        
        if self._record is not None:
            data["record"] = self._record.model_dump()

        try:
            with open(self._file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except OSError:
            # If we can't write, just continue (in-memory state is still valid)
            pass

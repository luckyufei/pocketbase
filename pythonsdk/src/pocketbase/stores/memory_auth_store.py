"""MemoryAuthStore - In-memory authentication state store."""

from pocketbase.stores.base_auth_store import BaseAuthStore


class MemoryAuthStore(BaseAuthStore):
    """In-memory authentication state store.
    
    This is the default auth store that keeps authentication data
    in memory. Data is lost when the process exits.
    
    This store is suitable for:
    - Server-side applications where auth state is per-request
    - CLI tools that don't need persistent auth
    - Testing and development
    
    Example:
        >>> from pocketbase import PocketBase
        >>> from pocketbase.stores.memory_auth_store import MemoryAuthStore
        >>> 
        >>> # PocketBase uses MemoryAuthStore by default
        >>> pb = PocketBase("http://localhost:8090")
        >>> 
        >>> # Or explicitly create with custom auth store
        >>> pb = PocketBase("http://localhost:8090", auth_store=MemoryAuthStore())
    """

    def __init__(self) -> None:
        """Initialize an empty in-memory auth store."""
        super().__init__()

"""PocketBase Python SDK - Type-safe, Pythonic client for PocketBase."""

__version__ = "0.1.0"

# Lazy imports to avoid circular dependencies
__all__ = [
    "PocketBase",
    "AsyncPocketBase",
    "ClientResponseError",
]


def __getattr__(name: str):  # type: ignore[no-untyped-def]
    """Lazy import to avoid circular dependencies."""
    if name == "PocketBase":
        from pocketbase.client import PocketBase

        return PocketBase
    if name == "AsyncPocketBase":
        from pocketbase.async_client import AsyncPocketBase

        return AsyncPocketBase
    if name == "ClientResponseError":
        from pocketbase.client_response_error import ClientResponseError

        return ClientResponseError
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

"""Models package for PocketBase SDK."""

from pocketbase.models.auth import (
    AuthMethodsList,
    AuthProviderInfo,
    MFAConfig,
    OAuth2Config,
    OAuthMeta,
    OTPConfig,
    PasswordConfig,
    RecordAuthResponse,
)
from pocketbase.models.collection import (
    COLLECTION_TYPE_AUTH,
    COLLECTION_TYPE_BASE,
    COLLECTION_TYPE_VIEW,
    CollectionModel,
    FieldSchema,
)
from pocketbase.models.list_result import ListResult
from pocketbase.models.record import RecordModel

__all__ = [
    "AuthMethodsList",
    "AuthProviderInfo",
    "COLLECTION_TYPE_AUTH",
    "COLLECTION_TYPE_BASE",
    "COLLECTION_TYPE_VIEW",
    "CollectionModel",
    "FieldSchema",
    "ListResult",
    "MFAConfig",
    "OAuth2Config",
    "OAuthMeta",
    "OTPConfig",
    "PasswordConfig",
    "RecordAuthResponse",
    "RecordModel",
]

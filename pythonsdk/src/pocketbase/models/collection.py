"""CollectionModel - Model for PocketBase collections."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# Collection type constants
COLLECTION_TYPE_BASE = "base"
COLLECTION_TYPE_AUTH = "auth"
COLLECTION_TYPE_VIEW = "view"


class FieldSchema(BaseModel):
    """Schema definition for a collection field.
    
    Attributes:
        id: Unique identifier for the field.
        name: Field name.
        type: Field type (text, number, bool, date, select, relation, file, etc.).
        system: Whether this is a system field.
        required: Whether the field is required.
        options: Type-specific options (e.g., maxSelect, collectionId for relations).
    """
    
    model_config = ConfigDict(extra="allow")
    
    id: str = ""
    name: str = ""
    type: str = ""
    system: bool = False
    required: bool = False
    options: dict[str, Any] | None = None


class CollectionModel(BaseModel):
    """PocketBase Collection model.
    
    This model represents a collection in PocketBase.
    
    Attributes:
        id: The unique identifier of the collection.
        name: The name of the collection.
        type: The type of collection (base, auth, view).
        system: Whether this is a system collection.
        fields: List of field schemas.
        indexes: List of collection indexes.
        created: The creation timestamp.
        updated: The last update timestamp.
        listRule: API rule for list operations (None = admin only, "" = public).
        viewRule: API rule for view operations.
        createRule: API rule for create operations.
        updateRule: API rule for update operations.
        deleteRule: API rule for delete operations.
    
    Example:
        >>> collection = pb.collections.get_one("posts")
        >>> print(collection.name)
        >>> print(collection.type)
        >>> for field in collection.fields:
        ...     print(f"{field['name']}: {field['type']}")
    """

    model_config = ConfigDict(
        extra="allow",  # Allow extra fields
        populate_by_name=True,  # Allow field aliases
    )

    id: str = ""
    name: str = ""
    type: str = "base"
    system: bool = False
    fields: list[dict[str, Any]] = Field(default_factory=list)
    indexes: list[str] = Field(default_factory=list)
    created: str = ""
    updated: str = ""
    
    # API rules (None = admin only, "" = public, string = filter expression)
    listRule: str | None = None
    viewRule: str | None = None
    createRule: str | None = None
    updateRule: str | None = None
    deleteRule: str | None = None
    
    # Legacy alias support
    schema_fields: list[dict[str, Any]] = Field(default_factory=list, alias="schema")

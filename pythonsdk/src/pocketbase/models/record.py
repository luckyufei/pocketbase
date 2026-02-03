"""RecordModel - Base model for PocketBase records."""

from pydantic import BaseModel, ConfigDict, Field


class RecordModel(BaseModel):
    """PocketBase Record base model.
    
    This model represents a record in a PocketBase collection.
    It allows extra fields to accommodate custom collection schemas.
    
    Attributes:
        id: The unique identifier of the record.
        collection_id: The ID of the collection this record belongs to.
        collection_name: The name of the collection this record belongs to.
        created: The creation timestamp of the record.
        updated: The last update timestamp of the record.
    """

    model_config = ConfigDict(
        extra="allow",  # Allow extra fields for custom collection schemas
        populate_by_name=True,  # Allow field aliases
    )

    id: str = ""
    collection_id: str = Field(default="", alias="collectionId")
    collection_name: str = Field(default="", alias="collectionName")
    created: str = ""
    updated: str = ""

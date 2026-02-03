"""ListResult - Generic paginated list result model."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ListResult(BaseModel, Generic[T]):
    """Generic paginated list result from PocketBase API.
    
    This model represents a paginated list response from the PocketBase API.
    
    Attributes:
        page: Current page number (1-indexed).
        per_page: Number of items per page.
        total_items: Total number of items across all pages.
        total_pages: Total number of pages.
        items: List of items for the current page.
    """

    model_config = ConfigDict(
        populate_by_name=True,
    )

    page: int
    per_page: int = Field(alias="perPage")
    total_items: int = Field(alias="totalItems")
    total_pages: int = Field(alias="totalPages")
    items: list[T]

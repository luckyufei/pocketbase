"""CollectionService - Service for managing PocketBase collections."""

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from pocketbase.models.collection import CollectionModel
from pocketbase.services.crud_service import CrudService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class CollectionService(CrudService[CollectionModel]):
    """Service for managing PocketBase collections.
    
    Provides CRUD operations for collections, plus additional methods
    for importing, truncating, and getting scaffolds.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the CollectionService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client, "/api/collections")

    def _create_item(self, data: dict[str, Any]) -> CollectionModel:
        """Create a CollectionModel from response data.
        
        Args:
            data: The response data.
            
        Returns:
            A CollectionModel instance.
        """
        return CollectionModel.model_validate(data)

    def truncate(self, collection_id_or_name: str) -> bool:
        """Delete all records in a collection.
        
        Args:
            collection_id_or_name: The collection ID or name.
            
        Returns:
            True if successful.
        """
        encoded = quote(collection_id_or_name, safe="")
        self._client.send(
            f"{self._base_path}/{encoded}/truncate",
            method="DELETE",
        )
        return True

    def import_collections(
        self,
        collections: list[dict[str, Any]],
        delete_missing: bool = False,
    ) -> bool:
        """Import collections configuration.
        
        If delete_missing is True, all local collections and their fields
        that are not present in the imported configuration will be deleted
        (including their related records data).
        
        Args:
            collections: List of collection configurations to import.
            delete_missing: Whether to delete missing collections.
            
        Returns:
            True if successful.
        """
        self._client.send(
            f"{self._base_path}/import",
            method="PUT",
            body={
                "collections": collections,
                "deleteMissing": delete_missing,
            },
        )
        return True

    def get_scaffolds(self) -> dict[str, dict[str, Any]]:
        """Get scaffolded collection models.
        
        Returns type indexed map with scaffolded collection models
        populated with their default field values.
        
        Returns:
            Dictionary mapping collection type to scaffold data.
        """
        return self._client.send(
            f"{self._base_path}/meta/scaffolds",
            method="GET",
        )

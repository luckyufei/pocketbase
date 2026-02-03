"""CrudService - Base CRUD operations for PocketBase services."""

from typing import TYPE_CHECKING, Any, Generic, TypeVar

from pocketbase.models.list_result import ListResult
from pocketbase.models.record import RecordModel
from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase

T = TypeVar("T", bound=RecordModel)


class CrudService(BaseService, Generic[T]):
    """Base CRUD service for PocketBase collections.
    
    Provides standard CRUD operations for a collection.
    
    Attributes:
        base_path: The base API path for the collection.
    """

    def __init__(self, client: "PocketBase", base_path: str) -> None:
        """Initialize the CRUD service.
        
        Args:
            client: The PocketBase client instance.
            base_path: The base API path for the collection.
        """
        super().__init__(client)
        self._base_path = base_path

    @property
    def base_path(self) -> str:
        """Get the base API path."""
        return self._base_path

    def _create_item(self, data: dict[str, Any]) -> T:
        """Create an item instance from data.
        
        Override in subclasses to customize item creation.
        
        Args:
            data: The item data.
            
        Returns:
            The created item instance.
        """
        return RecordModel.model_validate(data)  # type: ignore[return-value]

    def get_list(
        self,
        page: int = 1,
        per_page: int = 30,
        **options: Any,
    ) -> ListResult[T]:
        """Get a paginated list of items.
        
        Args:
            page: Page number (1-indexed).
            per_page: Number of items per page.
            **options: Additional query options (filter, sort, expand, fields).
            
        Returns:
            Paginated list result.
        """
        params: dict[str, Any] = {
            "page": page,
            "perPage": per_page,
        }
        
        # Add optional parameters
        for key in ("filter", "sort", "expand", "fields", "skipTotal"):
            if key in options:
                params[key] = options[key]

        response = self._client.send(
            self._base_path,
            method="GET",
            params=params,
        )

        # Convert items to model instances
        items = [self._create_item(item) for item in response.get("items", [])]

        # Create ListResult without strict validation to allow subclass item types
        return ListResult[T].model_construct(
            page=response.get("page", page),
            per_page=response.get("perPage", per_page),
            total_items=response.get("totalItems", 0),
            total_pages=response.get("totalPages", 0),
            items=items,
        )

    def get_full_list(
        self,
        batch_size: int = 500,
        **options: Any,
    ) -> list[T]:
        """Get all items from the collection.
        
        Fetches all pages and returns a flat list.
        
        Args:
            batch_size: Number of items per batch.
            **options: Additional query options.
            
        Returns:
            List of all items.
        """
        items: list[T] = []
        page = 1

        while True:
            result = self.get_list(page=page, per_page=batch_size, **options)
            items.extend(result.items)

            if page >= result.total_pages or not result.items:
                break

            page += 1

        return items

    def get_first_list_item(
        self,
        filter_expr: str,
        **options: Any,
    ) -> T:
        """Get the first item matching a filter.
        
        Args:
            filter_expr: Filter expression.
            **options: Additional query options.
            
        Returns:
            The first matching item.
            
        Raises:
            ClientResponseError: If no item matches.
        """
        options["filter"] = filter_expr
        result = self.get_list(page=1, per_page=1, **options)

        if not result.items:
            from pocketbase.client_response_error import ClientResponseError
            raise ClientResponseError(
                url=self._client.build_url(self._base_path),
                status=404,
                response={"code": 404, "message": "The requested resource wasn't found."},
            )

        return result.items[0]

    def get_one(
        self,
        id: str,
        **options: Any,
    ) -> T:
        """Get a single item by ID.
        
        Args:
            id: The item ID.
            **options: Additional query options (expand, fields).
            
        Returns:
            The item.
        """
        params: dict[str, Any] = {}
        for key in ("expand", "fields"):
            if key in options:
                params[key] = options[key]

        response = self._client.send(
            f"{self._base_path}/{id}",
            method="GET",
            params=params if params else None,
        )

        return self._create_item(response)

    def create(
        self,
        body: dict[str, Any],
        **options: Any,
    ) -> T:
        """Create a new item.
        
        Args:
            body: The item data.
            **options: Additional options.
            
        Returns:
            The created item.
        """
        params: dict[str, Any] = {}
        for key in ("expand", "fields"):
            if key in options:
                params[key] = options[key]

        response = self._client.send(
            self._base_path,
            method="POST",
            body=body,
            params=params if params else None,
        )

        return self._create_item(response)

    def update(
        self,
        id: str,
        body: dict[str, Any],
        **options: Any,
    ) -> T:
        """Update an existing item.
        
        Args:
            id: The item ID.
            body: The update data.
            **options: Additional options.
            
        Returns:
            The updated item.
        """
        params: dict[str, Any] = {}
        for key in ("expand", "fields"):
            if key in options:
                params[key] = options[key]

        response = self._client.send(
            f"{self._base_path}/{id}",
            method="PATCH",
            body=body,
            params=params if params else None,
        )

        return self._create_item(response)

    def delete(
        self,
        id: str,
        **options: Any,
    ) -> bool:
        """Delete an item.
        
        Args:
            id: The item ID.
            **options: Additional options.
            
        Returns:
            True if deletion was successful.
        """
        self._client.send(
            f"{self._base_path}/{id}",
            method="DELETE",
        )
        return True

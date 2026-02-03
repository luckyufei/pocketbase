"""AsyncRecordService for async record operations."""

from typing import TYPE_CHECKING, Any, TypeVar

from pocketbase.models.list_result import ListResult
from pocketbase.models.record import RecordModel

if TYPE_CHECKING:
    from pocketbase.async_client import AsyncPocketBase

T = TypeVar("T", bound=RecordModel)


class AsyncRecordService:
    """Async service for interacting with collection records.
    
    Provides async CRUD operations for collection records.
    """

    def __init__(self, client: "AsyncPocketBase", collection_name: str) -> None:
        """Initialize the async record service.
        
        Args:
            client: The AsyncPocketBase client instance.
            collection_name: The name of the collection.
        """
        self.client = client
        self._collection_name = collection_name
        self._base_path = f"/api/collections/{collection_name}/records"

    @property
    def collection_name(self) -> str:
        """Get the collection name."""
        return self._collection_name

    async def get_list(
        self,
        page: int = 1,
        per_page: int = 30,
        filter: str | None = None,  # noqa: A002
        sort: str | None = None,
        expand: str | None = None,
        fields: str | None = None,
        skip_total: bool = False,
    ) -> ListResult[RecordModel]:
        """Get a paginated list of records.
        
        Args:
            page: Page number (1-indexed).
            per_page: Number of items per page.
            filter: Filter expression.
            sort: Sort expression.
            expand: Relations to expand.
            fields: Fields to return.
            skip_total: Skip total count for performance.
            
        Returns:
            Paginated list result.
        """
        params: dict[str, Any] = {
            "page": page,
            "perPage": per_page,
        }
        
        if filter:
            params["filter"] = filter
        if sort:
            params["sort"] = sort
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields
        if skip_total:
            params["skipTotal"] = "1"

        response = await self.client.send(self._base_path, params=params)
        
        items = [RecordModel(**item) for item in response.get("items", [])]
        return ListResult(
            page=response.get("page", page),
            per_page=response.get("perPage", per_page),
            total_items=response.get("totalItems", 0),
            total_pages=response.get("totalPages", 0),
            items=items,
        )

    async def get_full_list(
        self,
        batch: int = 500,
        filter: str | None = None,  # noqa: A002
        sort: str | None = None,
        expand: str | None = None,
        fields: str | None = None,
    ) -> list[RecordModel]:
        """Get all records by iterating through all pages.
        
        Args:
            batch: Batch size per request.
            filter: Filter expression.
            sort: Sort expression.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            List of all matching records.
        """
        result: list[RecordModel] = []
        page = 1
        
        while True:
            page_result = await self.get_list(
                page=page,
                per_page=batch,
                filter=filter,
                sort=sort,
                expand=expand,
                fields=fields,
            )
            result.extend(page_result.items)
            
            if page >= page_result.total_pages or not page_result.items:
                break
            page += 1
        
        return result

    async def get_first_list_item(
        self,
        filter: str,  # noqa: A002
        sort: str | None = None,
        expand: str | None = None,
        fields: str | None = None,
    ) -> RecordModel | None:
        """Get the first matching record.
        
        Args:
            filter: Filter expression.
            sort: Sort expression.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            The first matching record or None.
        """
        result = await self.get_list(
            page=1,
            per_page=1,
            filter=filter,
            sort=sort,
            expand=expand,
            fields=fields,
            skip_total=True,
        )
        return result.items[0] if result.items else None

    async def get_one(
        self,
        id: str,  # noqa: A002
        expand: str | None = None,
        fields: str | None = None,
    ) -> RecordModel:
        """Get a single record by ID.
        
        Args:
            id: Record ID.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            The record.
        """
        params: dict[str, Any] = {}
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields

        response = await self.client.send(f"{self._base_path}/{id}", params=params)
        return RecordModel(**response)

    async def create(
        self,
        body: dict[str, Any],
        expand: str | None = None,
        fields: str | None = None,
    ) -> RecordModel:
        """Create a new record.
        
        Args:
            body: Record data.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            The created record.
        """
        params: dict[str, Any] = {}
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields

        response = await self.client.send(
            self._base_path,
            method="POST",
            body=body,
            params=params or None,
        )
        return RecordModel(**response)

    async def update(
        self,
        id: str,  # noqa: A002
        body: dict[str, Any],
        expand: str | None = None,
        fields: str | None = None,
    ) -> RecordModel:
        """Update a record.
        
        Args:
            id: Record ID.
            body: Updated data.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            The updated record.
        """
        params: dict[str, Any] = {}
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields

        response = await self.client.send(
            f"{self._base_path}/{id}",
            method="PATCH",
            body=body,
            params=params or None,
        )
        
        # Update auth store if this is the authenticated user
        if (
            self.client.auth_store.record
            and self.client.auth_store.record.get("id") == id
            and self.client.auth_store.record.get("collectionName") == self._collection_name
        ):
            self.client.auth_store.save(
                self.client.auth_store.token or "",
                response,
            )
        
        return RecordModel(**response)

    async def delete(self, id: str) -> None:  # noqa: A002
        """Delete a record.
        
        Args:
            id: Record ID.
        """
        await self.client.send(f"{self._base_path}/{id}", method="DELETE")
        
        # Clear auth store if this is the authenticated user
        if (
            self.client.auth_store.record
            and self.client.auth_store.record.get("id") == id
            and self.client.auth_store.record.get("collectionName") == self._collection_name
        ):
            self.client.auth_store.clear()

    async def auth_with_password(
        self,
        identity: str,
        password: str,
        expand: str | None = None,
        fields: str | None = None,
    ) -> dict[str, Any]:
        """Authenticate with password.
        
        Args:
            identity: User identity (email or username).
            password: User password.
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            Auth response with token and record.
        """
        params: dict[str, Any] = {}
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields

        response = await self.client.send(
            f"/api/collections/{self._collection_name}/auth-with-password",
            method="POST",
            body={"identity": identity, "password": password},
            params=params or None,
        )
        
        self.client.auth_store.save(
            response.get("token", ""),
            response.get("record", {}),
        )
        
        return response

    async def auth_refresh(
        self,
        expand: str | None = None,
        fields: str | None = None,
    ) -> dict[str, Any]:
        """Refresh authentication token.
        
        Args:
            expand: Relations to expand.
            fields: Fields to return.
            
        Returns:
            Auth response with new token and record.
        """
        params: dict[str, Any] = {}
        if expand:
            params["expand"] = expand
        if fields:
            params["fields"] = fields

        response = await self.client.send(
            f"/api/collections/{self._collection_name}/auth-refresh",
            method="POST",
            params=params or None,
        )
        
        self.client.auth_store.save(
            response.get("token", ""),
            response.get("record", {}),
        )
        
        return response

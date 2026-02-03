"""BatchService - Service for batch operations in PocketBase."""

import json
from typing import TYPE_CHECKING, Any, Optional
from urllib.parse import quote, urlencode

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class SubBatchService:
    """Sub-service for building batch requests for a specific collection.
    
    Created via BatchService.collection() method.
    """

    def __init__(self, requests: list[dict[str, Any]], collection_name: str) -> None:
        """Initialize the SubBatchService.
        
        Args:
            requests: Reference to the parent batch's request list.
            collection_name: The collection name.
        """
        self._requests = requests
        self._collection_name = collection_name

    def create(
        self,
        body: dict[str, Any] | None = None,
        options: dict[str, Any] | None = None
    ) -> None:
        """Register a create request in the batch.
        
        Args:
            body: The record data to create.
            options: Optional query parameters (expand, fields, etc.)
        """
        request: dict[str, Any] = {
            "method": "POST",
            "url": f"/api/collections/{quote(self._collection_name, safe='')}/records",
            "body": body or {},
        }
        self._prepare_request(request, options)
        self._requests.append(request)

    def update(
        self,
        record_id: str,
        body: dict[str, Any] | None = None,
        options: dict[str, Any] | None = None
    ) -> None:
        """Register an update request in the batch.
        
        Args:
            record_id: The ID of the record to update.
            body: The record data to update.
            options: Optional query parameters (expand, fields, etc.)
        """
        request: dict[str, Any] = {
            "method": "PATCH",
            "url": f"/api/collections/{quote(self._collection_name, safe='')}/records/{quote(record_id, safe='')}",
            "body": body or {},
        }
        self._prepare_request(request, options)
        self._requests.append(request)

    def delete(
        self,
        record_id: str,
        options: dict[str, Any] | None = None
    ) -> None:
        """Register a delete request in the batch.
        
        Args:
            record_id: The ID of the record to delete.
            options: Optional query parameters.
        """
        request: dict[str, Any] = {
            "method": "DELETE",
            "url": f"/api/collections/{quote(self._collection_name, safe='')}/records/{quote(record_id, safe='')}",
        }
        self._prepare_request(request, options)
        self._requests.append(request)

    def upsert(
        self,
        body: dict[str, Any] | None = None,
        options: dict[str, Any] | None = None
    ) -> None:
        """Register an upsert request in the batch.
        
        If body contains a valid existing record id, update is performed,
        otherwise create.
        
        Args:
            body: The record data to upsert. Include 'id' field for update.
            options: Optional query parameters (expand, fields, etc.)
        """
        request: dict[str, Any] = {
            "method": "PUT",
            "url": f"/api/collections/{quote(self._collection_name, safe='')}/records",
            "body": body or {},
        }
        self._prepare_request(request, options)
        self._requests.append(request)

    def _prepare_request(
        self,
        request: dict[str, Any],
        options: dict[str, Any] | None
    ) -> None:
        """Prepare the request with query params and headers.
        
        Args:
            request: The request dict to modify.
            options: Optional parameters to include.
        """
        if not options:
            return
        
        # Extract headers
        if "headers" in options:
            request["headers"] = options["headers"]
        
        # Build query string from known options
        query_params: dict[str, Any] = {}
        for key in ["expand", "fields", "filter", "sort", "skipTotal"]:
            if key in options:
                query_params[key] = options[key]
        
        # Include any query dict
        if "query" in options:
            query_params.update(options["query"])
        
        if query_params:
            query_string = urlencode(query_params)
            if "?" in request["url"]:
                request["url"] += "&" + query_string
            else:
                request["url"] += "?" + query_string


class BatchService(BaseService):
    """Service for batch requests in PocketBase.
    
    Allows sending multiple create/update/delete operations in a single
    transactional request.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the BatchService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client)
        self._requests: list[dict[str, Any]] = []
        self._subs: dict[str, SubBatchService] = {}

    def collection(self, collection_name: str) -> SubBatchService:
        """Get a sub-batch service for a collection.
        
        Args:
            collection_name: The collection name or ID.
            
        Returns:
            SubBatchService for building batch requests.
        """
        if collection_name not in self._subs:
            self._subs[collection_name] = SubBatchService(
                self._requests, 
                collection_name
            )
        return self._subs[collection_name]

    def send(self, options: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Send all batch requests.
        
        Args:
            options: Optional additional request options.
            
        Returns:
            List of BatchRequestResult dicts with status and body.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        # Build form data for the batch request
        json_data: list[dict[str, Any]] = []
        
        for req in self._requests:
            item: dict[str, Any] = {
                "method": req["method"],
                "url": req["url"],
            }
            if "body" in req:
                item["body"] = req["body"]
            if "headers" in req:
                item["headers"] = req["headers"]
            json_data.append(item)
        
        # Note: For simplicity, we're sending as JSON
        # For file uploads, multipart/form-data would be needed
        body = {"requests": json_data}
        
        result = self._client.send("/api/batch", method="POST", body=body)
        
        if isinstance(result, list):
            return result
        return []

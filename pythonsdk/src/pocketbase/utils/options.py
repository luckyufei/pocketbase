"""Options TypedDict definitions for PocketBase SDK.

This module defines TypedDict types for API request options, providing
type hints for better IDE support and type checking.
"""

from typing import Any, TypedDict


class SendOptions(TypedDict, total=False):
    """Base options for HTTP requests.
    
    These options can be passed to any API method to customize
    the request.
    
    Attributes:
        headers: Additional HTTP headers to send with the request.
        params: Additional query parameters to append to the URL.
        body: Request body data (for POST/PUT/PATCH requests).
        expand: Comma-separated list of relations to expand.
        fields: Comma-separated list of fields to return.
        filter: Filter expression for the query.
        sort: Sort expression (e.g., "-created,title").
        requestKey: Unique key for request deduplication/cancellation.
    
    Example:
        >>> options: SendOptions = {
        ...     "headers": {"X-Custom": "value"},
        ...     "expand": "author,comments",
        ...     "fields": "id,title,created",
        ...     "filter": "status = 'active'",
        ...     "sort": "-created",
        ... }
        >>> pb.collection("posts").get_list(options=options)
    """
    
    headers: dict[str, str]
    params: dict[str, Any]
    body: dict[str, Any]
    expand: str
    fields: str
    filter: str
    sort: str
    requestKey: str


class RecordListOptions(TypedDict, total=False):
    """Options for record list operations.
    
    Extends SendOptions with pagination-specific options.
    
    Attributes:
        page: Page number (1-based).
        perPage: Number of items per page.
        skipTotal: If True, skip counting total records (faster queries).
        filter: Filter expression for the query.
        sort: Sort expression.
        expand: Relations to expand.
        fields: Fields to return.
        headers: Additional HTTP headers.
        params: Additional query parameters.
    
    Example:
        >>> options: RecordListOptions = {
        ...     "page": 1,
        ...     "perPage": 50,
        ...     "filter": "active = true",
        ...     "sort": "-created",
        ...     "skipTotal": False,
        ... }
        >>> result = pb.collection("posts").get_list(options=options)
    """
    
    page: int
    perPage: int
    skipTotal: bool
    filter: str
    sort: str
    expand: str
    fields: str
    headers: dict[str, str]
    params: dict[str, Any]


class RecordFullListOptions(TypedDict, total=False):
    """Options for fetching all records (full list).
    
    Extends SendOptions with batch-specific options for
    fetching all records across multiple pages.
    
    Attributes:
        batch: Number of records to fetch per request (default: 200).
        filter: Filter expression for the query.
        sort: Sort expression.
        expand: Relations to expand.
        fields: Fields to return.
        headers: Additional HTTP headers.
        params: Additional query parameters.
    
    Example:
        >>> options: RecordFullListOptions = {
        ...     "batch": 100,
        ...     "filter": "status != 'deleted'",
        ...     "sort": "title",
        ... }
        >>> all_posts = pb.collection("posts").get_full_list(options=options)
    """
    
    batch: int
    filter: str
    sort: str
    expand: str
    fields: str
    headers: dict[str, str]
    params: dict[str, Any]


class RecordAuthOptions(TypedDict, total=False):
    """Options for record authentication operations.
    
    Attributes:
        expand: Relations to expand on the auth record.
        fields: Fields to return for the auth record.
        headers: Additional HTTP headers.
        params: Additional query parameters.
        body: Additional body data to merge with auth request.
    """
    
    expand: str
    fields: str
    headers: dict[str, str]
    params: dict[str, Any]
    body: dict[str, Any]


class FileOptions(TypedDict, total=False):
    """Options for file operations.
    
    Attributes:
        thumb: Thumbnail transformation (e.g., "100x100", "0x100").
        download: If True, set Content-Disposition to attachment.
        headers: Additional HTTP headers.
    """
    
    thumb: str
    download: bool
    headers: dict[str, str]

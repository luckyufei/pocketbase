"""JobsService - Service for managing PocketBase background jobs."""

from typing import TYPE_CHECKING, Any
from urllib.parse import quote, urlencode

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class JobsService(BaseService):
    """Service for managing PocketBase background jobs.
    
    Provides methods to list, get, enqueue, requeue, delete jobs and get stats.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the JobsService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client)

    def get_list(
        self,
        limit: int = 30,
        offset: int = 0,
        topic: str = "",
        status: str = ""
    ) -> dict[str, Any]:
        """Get list of jobs with optional filtering.
        
        Args:
            limit: Maximum number of jobs to return.
            offset: Number of jobs to skip.
            topic: Filter by topic name.
            status: Filter by job status (pending, running, completed, failed).
            
        Returns:
            Dict with items and total count.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        params: dict[str, Any] = {
            "limit": limit,
            "offset": offset,
        }
        if topic:
            params["topic"] = topic
        if status:
            params["status"] = status
        
        return self._client.send("/api/jobs", method="GET", params=params)

    def get_one(self, job_id: str) -> dict[str, Any]:
        """Get a single job by ID.
        
        Args:
            job_id: The job ID.
            
        Returns:
            The job data.
            
        Raises:
            ClientResponseError: If the request fails or job not found.
        """
        return self._client.send(f"/api/jobs/{quote(job_id, safe='')}", method="GET")

    def enqueue(
        self,
        topic: str,
        payload: dict[str, Any] | None = None,
        run_at: str | None = None,
        max_retries: int | None = None
    ) -> dict[str, Any]:
        """Enqueue a new job.
        
        Args:
            topic: The job topic.
            payload: The job payload data.
            run_at: Optional ISO datetime string for delayed execution.
            max_retries: Maximum number of retries on failure.
            
        Returns:
            The created job data.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        body: dict[str, Any] = {
            "topic": topic,
            "payload": payload or {},
        }
        if run_at:
            body["run_at"] = run_at
        if max_retries is not None:
            body["max_retries"] = max_retries
        
        return self._client.send("/api/jobs/enqueue", method="POST", body=body)

    def requeue(self, job_id: str) -> dict[str, Any]:
        """Requeue a failed job.
        
        Args:
            job_id: The job ID to requeue.
            
        Returns:
            The requeued job data.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        return self._client.send(
            f"/api/jobs/{quote(job_id, safe='')}/requeue",
            method="POST"
        )

    def delete(self, job_id: str) -> bool:
        """Delete a job.
        
        Args:
            job_id: The job ID to delete.
            
        Returns:
            True if deletion was successful.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        self._client.send(f"/api/jobs/{quote(job_id, safe='')}", method="DELETE")
        return True

    def get_stats(self) -> dict[str, Any]:
        """Get job statistics.
        
        Returns:
            Dict with job counts by status.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        return self._client.send("/api/jobs/stats", method="GET")

"""CronService - Service for managing PocketBase cron jobs."""

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class CronService(BaseService):
    """Service for managing PocketBase cron jobs.
    
    Provides methods to list and run cron jobs.
    """

    def __init__(self, client: "PocketBase") -> None:
        """Initialize the CronService.
        
        Args:
            client: The PocketBase client instance.
        """
        super().__init__(client)

    def get_full_list(self) -> list[dict[str, Any]]:
        """Get list of all registered cron jobs.
        
        Returns:
            List of cron job dicts with keys: id, expression.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        result = self._client.send("/api/crons", method="GET")
        # The API returns a list directly
        if isinstance(result, list):
            return result
        return []

    def run(self, job_id: str) -> bool:
        """Manually run a cron job.
        
        Args:
            job_id: The ID of the cron job to run.
            
        Returns:
            True if the job was triggered successfully.
            
        Raises:
            ClientResponseError: If the request fails.
        """
        self._client.send(f"/api/crons/{quote(job_id, safe='')}", method="POST")
        return True

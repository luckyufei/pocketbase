"""Tests for JobsService."""

import pytest
from pytest_httpx import HTTPXMock

from pocketbase.client import PocketBase


class TestJobsServiceGetList:
    """Tests for JobsService.get_list()."""

    def test_get_list_returns_jobs(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_list returns list of jobs."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/jobs?limit=30&offset=0",
            json={
                "items": [
                    {
                        "id": "job1",
                        "topic": "send_email",
                        "status": "pending",
                        "payload": {"to": "user@example.com"}
                    },
                    {
                        "id": "job2",
                        "topic": "send_email",
                        "status": "completed",
                        "payload": {"to": "other@example.com"}
                    }
                ],
                "total": 2
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.get_list()
        
        assert result["total"] == 2
        assert len(result["items"]) == 2
        assert result["items"][0]["topic"] == "send_email"

    def test_get_list_with_filter(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_list filters by topic and status."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/jobs?limit=30&offset=0&topic=send_email&status=pending",
            json={"items": [], "total": 0}
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.get_list(topic="send_email", status="pending")
        
        assert result["total"] == 0


class TestJobsServiceGetOne:
    """Tests for JobsService.get_one()."""

    def test_get_one_returns_job(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_one returns a single job."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/jobs/job123",
            json={
                "id": "job123",
                "topic": "send_email",
                "status": "pending",
                "payload": {"to": "user@example.com"}
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.get_one("job123")
        
        assert result["id"] == "job123"
        assert result["topic"] == "send_email"


class TestJobsServiceEnqueue:
    """Tests for JobsService.enqueue()."""

    def test_enqueue_creates_job(self, httpx_mock: HTTPXMock) -> None:
        """Test that enqueue creates a new job."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/jobs/enqueue",
            json={
                "id": "job123",
                "topic": "send_email",
                "status": "pending",
                "payload": {"to": "user@example.com"}
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.enqueue("send_email", {"to": "user@example.com"})
        
        assert result["id"] == "job123"
        assert result["topic"] == "send_email"

    def test_enqueue_with_options(self, httpx_mock: HTTPXMock) -> None:
        """Test enqueue with run_at and max_retries options."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/jobs/enqueue",
            json={"id": "job123", "topic": "cleanup", "status": "pending"}
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.enqueue(
            "cleanup", 
            {}, 
            run_at="2024-01-01T00:00:00Z", 
            max_retries=3
        )
        
        assert result["id"] == "job123"


class TestJobsServiceRequeue:
    """Tests for JobsService.requeue()."""

    def test_requeue_job(self, httpx_mock: HTTPXMock) -> None:
        """Test that requeue requeues a failed job."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/jobs/job123/requeue",
            json={
                "id": "job123",
                "topic": "send_email",
                "status": "pending"
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.requeue("job123")
        
        assert result["id"] == "job123"
        assert result["status"] == "pending"


class TestJobsServiceDelete:
    """Tests for JobsService.delete()."""

    def test_delete_job(self, httpx_mock: HTTPXMock) -> None:
        """Test that delete removes a job."""
        httpx_mock.add_response(
            method="DELETE",
            url="http://localhost:8090/api/jobs/job123",
            json={"ok": True}
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.delete("job123")
        
        assert result is True


class TestJobsServiceGetStats:
    """Tests for JobsService.get_stats()."""

    def test_get_stats_returns_statistics(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_stats returns job statistics."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/jobs/stats",
            json={
                "pending": 10,
                "running": 2,
                "completed": 100,
                "failed": 5
            }
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.jobs.get_stats()
        
        assert result["pending"] == 10
        assert result["completed"] == 100

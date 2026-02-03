"""Tests for CronService."""

import pytest
from pytest_httpx import HTTPXMock

from pocketbase.client import PocketBase


class TestCronServiceGetFullList:
    """Tests for CronService.get_full_list()."""

    def test_get_full_list_returns_cron_jobs(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_full_list returns list of cron jobs."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/crons",
            json=[
                {
                    "id": "my_cron_job",
                    "expression": "0 0 * * *"
                },
                {
                    "id": "__pb_cleanup",
                    "expression": "*/5 * * * *"
                }
            ]
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.crons.get_full_list()
        
        assert len(result) == 2
        assert result[0]["id"] == "my_cron_job"
        assert result[0]["expression"] == "0 0 * * *"
        assert result[1]["id"] == "__pb_cleanup"

    def test_get_full_list_empty(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_full_list handles empty list."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/crons",
            json=[]
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.crons.get_full_list()
        
        assert result == []


class TestCronServiceRun:
    """Tests for CronService.run()."""

    def test_run_cron_job(self, httpx_mock: HTTPXMock) -> None:
        """Test running a cron job manually."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/crons/my_cron_job",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.crons.run("my_cron_job")
        
        assert result is True

    def test_run_cron_job_with_special_characters(self, httpx_mock: HTTPXMock) -> None:
        """Test running a cron job with special characters in ID."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/crons/__pb_cleanup",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.crons.run("__pb_cleanup")
        
        assert result is True

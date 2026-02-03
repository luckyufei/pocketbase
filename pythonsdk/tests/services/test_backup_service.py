"""Tests for BackupService."""

import pytest
from pytest_httpx import HTTPXMock

from pocketbase.client import PocketBase


class TestBackupServiceGetFullList:
    """Tests for BackupService.get_full_list()."""

    def test_get_full_list_returns_backups(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_full_list returns list of backup files."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/backups",
            json=[
                {
                    "key": "backup_2024010100000.zip",
                    "size": 1024000,
                    "modified": "2024-01-01 00:00:00.000Z"
                },
                {
                    "key": "backup_2024010200000.zip",
                    "size": 2048000,
                    "modified": "2024-01-02 00:00:00.000Z"
                }
            ]
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.get_full_list()
        
        assert len(result) == 2
        assert result[0]["key"] == "backup_2024010100000.zip"
        assert result[0]["size"] == 1024000
        assert result[1]["key"] == "backup_2024010200000.zip"

    def test_get_full_list_empty(self, httpx_mock: HTTPXMock) -> None:
        """Test that get_full_list handles empty list."""
        httpx_mock.add_response(
            method="GET",
            url="http://localhost:8090/api/backups",
            json=[]
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.get_full_list()
        
        assert result == []


class TestBackupServiceCreate:
    """Tests for BackupService.create()."""

    def test_create_backup_with_name(self, httpx_mock: HTTPXMock) -> None:
        """Test creating a backup with custom name."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/backups",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.create(name="my_backup.zip")
        
        # Returns True on success (204 No Content)
        assert result is True

    def test_create_backup_without_name(self, httpx_mock: HTTPXMock) -> None:
        """Test creating a backup with auto-generated name."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/backups",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.create()
        
        assert result is True


class TestBackupServiceUpload:
    """Tests for BackupService.upload()."""

    def test_upload_backup_file(self, httpx_mock: HTTPXMock, tmp_path) -> None:
        """Test uploading a backup file."""
        # Create a temp zip file
        zip_file = tmp_path / "test_backup.zip"
        zip_file.write_bytes(b"PK\x03\x04" + b"\x00" * 100)  # Minimal ZIP header
        
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/backups/upload",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.upload(str(zip_file))
        
        assert result is True


class TestBackupServiceDelete:
    """Tests for BackupService.delete()."""

    def test_delete_backup(self, httpx_mock: HTTPXMock) -> None:
        """Test deleting a backup."""
        httpx_mock.add_response(
            method="DELETE",
            url="http://localhost:8090/api/backups/backup_2024010100000.zip",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.delete("backup_2024010100000.zip")
        
        assert result is True


class TestBackupServiceRestore:
    """Tests for BackupService.restore()."""

    def test_restore_backup(self, httpx_mock: HTTPXMock) -> None:
        """Test restoring a backup."""
        httpx_mock.add_response(
            method="POST",
            url="http://localhost:8090/api/backups/backup_2024010100000.zip/restore",
            status_code=204
        )
        
        client = PocketBase("http://localhost:8090")
        result = client.backups.restore("backup_2024010100000.zip")
        
        assert result is True


class TestBackupServiceGetDownloadUrl:
    """Tests for BackupService.get_download_url()."""

    def test_get_download_url_basic(self) -> None:
        """Test building download URL without token."""
        client = PocketBase("http://localhost:8090")
        url = client.backups.get_download_url("backup_2024010100000.zip")
        
        assert url == "http://localhost:8090/api/backups/backup_2024010100000.zip"

    def test_get_download_url_with_token(self) -> None:
        """Test building download URL with token."""
        client = PocketBase("http://localhost:8090")
        url = client.backups.get_download_url(
            "backup_2024010100000.zip",
            token="test_token_123"
        )
        
        assert "http://localhost:8090/api/backups/backup_2024010100000.zip" in url
        assert "token=test_token_123" in url

    def test_get_download_url_encodes_key(self) -> None:
        """Test that special characters in key are URL encoded."""
        client = PocketBase("http://localhost:8090")
        url = client.backups.get_download_url("backup with spaces.zip")
        
        # Should URL encode the key
        assert "backup%20with%20spaces.zip" in url or "backup+with+spaces.zip" in url

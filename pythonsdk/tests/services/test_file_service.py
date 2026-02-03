"""Tests for FileService - 文件服务测试

TDD 红灯阶段: T-6.1.1 ~ T-6.1.4
"""

import pytest

from pocketbase import PocketBase
from pocketbase.services.file_service import FileService


class TestFileServiceInit:
    """FileService 初始化测试"""

    def test_file_service_exists_on_client(self, base_url: str) -> None:
        """测试 Client 上存在 files 服务"""
        pb = PocketBase(base_url)
        assert hasattr(pb, "files")
        assert isinstance(pb.files, FileService)


class TestFileServiceGetURL:
    """get_url 测试 - T-6.1.1, T-6.1.2"""

    def test_get_url_basic(self, base_url: str) -> None:
        """测试基本 URL 构建"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "image.png")

        expected = f"{base_url}/api/files/collection456/record123/image.png"
        assert url == expected

    def test_get_url_with_collection_name(self, base_url: str) -> None:
        """测试使用 collectionName"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionName": "posts",
        }

        url = pb.files.get_url(record, "document.pdf")

        expected = f"{base_url}/api/files/posts/record123/document.pdf"
        assert url == expected

    def test_get_url_with_query_params(self, base_url: str) -> None:
        """测试带查询参数"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "image.png", thumb="100x100")

        assert "thumb=100x100" in url

    def test_get_url_with_download_param(self, base_url: str) -> None:
        """测试 download 参数"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "file.zip", download=True)

        assert "download=1" in url or "download=true" in url.lower()

    def test_get_url_download_false_omitted(self, base_url: str) -> None:
        """测试 download=False 被忽略"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "file.zip", download=False)

        assert "download" not in url

    def test_get_url_empty_filename_returns_empty(self, base_url: str) -> None:
        """测试空文件名返回空字符串"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "")

        assert url == ""

    def test_get_url_missing_record_id_returns_empty(self, base_url: str) -> None:
        """测试缺少 record id 返回空字符串"""
        pb = PocketBase(base_url)

        record = {
            "collectionId": "collection456",
        }

        url = pb.files.get_url(record, "image.png")

        assert url == ""

    def test_get_url_missing_collection_returns_empty(self, base_url: str) -> None:
        """测试缺少 collection 返回空字符串"""
        pb = PocketBase(base_url)

        record = {
            "id": "record123",
        }

        url = pb.files.get_url(record, "image.png")

        assert url == ""

    def test_get_url_encodes_special_characters(self, base_url: str) -> None:
        """测试特殊字符编码"""
        pb = PocketBase(base_url)

        record = {
            "id": "record/123",
            "collectionId": "collection 456",
        }

        url = pb.files.get_url(record, "my file.png")

        assert "record%2F123" in url
        assert "collection%20456" in url
        assert "my%20file.png" in url


class TestFileServiceGetToken:
    """get_token 测试 - T-6.1.3, T-6.1.4"""

    def test_get_token_success(self, base_url: str, httpx_mock) -> None:
        """测试成功获取 token"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/files/token",
            json={"token": "file-token-123"},
        )

        token = pb.files.get_token()

        assert token == "file-token-123"

    def test_get_token_empty_response(self, base_url: str, httpx_mock) -> None:
        """测试空响应返回空字符串"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/files/token",
            json={},
        )

        token = pb.files.get_token()

        assert token == ""

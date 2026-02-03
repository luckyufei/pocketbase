"""Tests for LogService - 日志服务测试

TDD 红灯阶段: T-6.3.1 ~ T-6.3.6
"""

import pytest

from pocketbase import PocketBase
from pocketbase.services.log_service import LogService


class TestLogServiceInit:
    """LogService 初始化测试"""

    def test_log_service_exists_on_client(self, base_url: str) -> None:
        """测试 Client 上存在 logs 服务"""
        pb = PocketBase(base_url)
        assert hasattr(pb, "logs")
        assert isinstance(pb.logs, LogService)


class TestLogServiceGetList:
    """get_list 测试 - T-6.3.1, T-6.3.2"""

    def test_get_list_success(self, base_url: str, httpx_mock) -> None:
        """测试获取日志列表"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/logs?page=1&perPage=30",
            json={
                "page": 1,
                "perPage": 30,
                "totalItems": 2,
                "totalPages": 1,
                "items": [
                    {"id": "log1", "level": "info", "message": "Test log 1"},
                    {"id": "log2", "level": "error", "message": "Test log 2"},
                ],
            },
        )

        result = pb.logs.get_list()

        assert result["totalItems"] == 2
        assert len(result["items"]) == 2

    def test_get_list_with_pagination(self, base_url: str, httpx_mock) -> None:
        """测试带分页参数"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/logs?page=2&perPage=10",
            json={"page": 2, "perPage": 10, "totalItems": 25, "totalPages": 3, "items": []},
        )

        result = pb.logs.get_list(page=2, per_page=10)

        assert result["page"] == 2


class TestLogServiceGetOne:
    """get_one 测试 - T-6.3.3, T-6.3.4"""

    def test_get_one_success(self, base_url: str, httpx_mock) -> None:
        """测试获取单条日志"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/logs/log123",
            json={"id": "log123", "level": "info", "message": "Test log"},
        )

        result = pb.logs.get_one("log123")

        assert result["id"] == "log123"


class TestLogServiceGetStats:
    """get_stats 测试 - T-6.3.5, T-6.3.6"""

    def test_get_stats_success(self, base_url: str, httpx_mock) -> None:
        """测试获取日志统计"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/logs/stats",
            json=[
                {"date": "2024-01-01", "total": 100},
                {"date": "2024-01-02", "total": 150},
            ],
        )

        result = pb.logs.get_stats()

        assert len(result) == 2

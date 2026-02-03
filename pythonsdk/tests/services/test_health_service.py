"""Tests for HealthService - 健康检查服务测试

TDD 红灯阶段: T-6.4.1, T-6.4.2
"""

import pytest

from pocketbase import PocketBase
from pocketbase.services.health_service import HealthService


class TestHealthServiceInit:
    """HealthService 初始化测试"""

    def test_health_service_exists_on_client(self, base_url: str) -> None:
        """测试 Client 上存在 health 服务"""
        pb = PocketBase(base_url)
        assert hasattr(pb, "health")
        assert isinstance(pb.health, HealthService)


class TestHealthServiceCheck:
    """check 测试 - T-6.4.1, T-6.4.2"""

    def test_check_success(self, base_url: str, httpx_mock) -> None:
        """测试健康检查成功"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={"code": 200, "message": "API is healthy."},
        )

        result = pb.health.check()

        assert result["code"] == 200
        assert "healthy" in result["message"].lower()

    def test_check_returns_response(self, base_url: str, httpx_mock) -> None:
        """测试返回完整响应"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            json={
                "code": 200,
                "message": "API is healthy.",
                "data": {"canBackup": True},
            },
        )

        result = pb.health.check()

        assert "code" in result
        assert "message" in result
        assert "data" in result

"""Tests for SettingsService - 设置服务测试

TDD 红灯阶段: T-6.2.1 ~ T-6.2.10
"""

import pytest

from pocketbase import PocketBase
from pocketbase.services.settings_service import SettingsService


class TestSettingsServiceInit:
    """SettingsService 初始化测试"""

    def test_settings_service_exists_on_client(self, base_url: str) -> None:
        """测试 Client 上存在 settings 服务"""
        pb = PocketBase(base_url)
        assert hasattr(pb, "settings")
        assert isinstance(pb.settings, SettingsService)


class TestSettingsServiceGetAll:
    """get_all 测试 - T-6.2.1, T-6.2.2"""

    def test_get_all_success(self, base_url: str, httpx_mock) -> None:
        """测试获取所有设置"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/settings",
            json={
                "meta": {"appName": "Test App"},
                "logs": {"maxDays": 7},
                "smtp": {"enabled": True},
            },
        )

        result = pb.settings.get_all()

        assert "meta" in result
        assert "logs" in result


class TestSettingsServiceUpdate:
    """update 测试 - T-6.2.3, T-6.2.4"""

    def test_update_success(self, base_url: str, httpx_mock) -> None:
        """测试更新设置"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="PATCH",
            url=f"{base_url}/api/settings",
            json={"meta": {"appName": "Updated App"}},
        )

        result = pb.settings.update({"meta": {"appName": "Updated App"}})

        assert result["meta"]["appName"] == "Updated App"


class TestSettingsServiceTestS3:
    """test_s3 测试 - T-6.2.5, T-6.2.6"""

    def test_test_s3_success(self, base_url: str, httpx_mock) -> None:
        """测试 S3 连接测试"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/settings/test/s3",
            json={},
        )

        result = pb.settings.test_s3("backups")

        assert result is True


class TestSettingsServiceTestEmail:
    """test_email 测试 - T-6.2.7, T-6.2.8"""

    def test_test_email_success(self, base_url: str, httpx_mock) -> None:
        """测试邮件发送测试"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/settings/test/email",
            json={},
        )

        result = pb.settings.test_email("test@example.com", "Test email")

        assert result is True


class TestSettingsServiceGenerateAppleClientSecret:
    """generate_apple_client_secret 测试 - T-6.2.9, T-6.2.10"""

    def test_generate_apple_client_secret_success(self, base_url: str, httpx_mock) -> None:
        """测试生成 Apple 客户端密钥"""
        pb = PocketBase(base_url)

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/settings/apple/generate-client-secret",
            json={"secret": "apple-secret-123"},
        )

        result = pb.settings.generate_apple_client_secret(
            client_id="com.example.app",
            team_id="TEAM123",
            key_id="KEY123",
            private_key="-----BEGIN PRIVATE KEY-----\n...",
            duration=3600,
        )

        assert result["secret"] == "apple-secret-123"

"""SettingsService - 设置服务

提供系统设置管理功能。
"""

from typing import TYPE_CHECKING, Any

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class SettingsService(BaseService):
    """设置服务"""

    def __init__(self, client: "PocketBase") -> None:
        super().__init__(client)

    def get_all(self, **options: Any) -> dict[str, Any]:
        """获取所有设置

        Args:
            **options: 附加选项

        Returns:
            所有系统设置
        """
        return self._client.send("/api/settings", method="GET")

    def update(self, body: dict[str, Any], **options: Any) -> dict[str, Any]:
        """更新设置

        Args:
            body: 要更新的设置
            **options: 附加选项

        Returns:
            更新后的设置
        """
        return self._client.send("/api/settings", method="PATCH", body=body)

    def test_s3(self, filesystem: str = "storage", **options: Any) -> bool:
        """测试 S3 存储连接

        Args:
            filesystem: 文件系统类型，"storage" 或 "backups"
            **options: 附加选项

        Returns:
            测试成功返回 True
        """
        self._client.send(
            "/api/settings/test/s3",
            method="POST",
            body={"filesystem": filesystem},
        )
        return True

    def test_email(
        self,
        email: str,
        template: str,
        **options: Any,
    ) -> bool:
        """测试邮件发送

        Args:
            email: 测试邮件接收地址
            template: 邮件模板名称
            **options: 附加选项

        Returns:
            测试成功返回 True
        """
        self._client.send(
            "/api/settings/test/email",
            method="POST",
            body={"email": email, "template": template},
        )
        return True

    def generate_apple_client_secret(
        self,
        client_id: str,
        team_id: str,
        key_id: str,
        private_key: str,
        duration: int,
        **options: Any,
    ) -> dict[str, Any]:
        """生成 Apple OAuth2 客户端密钥

        Args:
            client_id: Apple 客户端 ID
            team_id: Apple 团队 ID
            key_id: Apple 密钥 ID
            private_key: Apple 私钥
            duration: 密钥有效期（秒）
            **options: 附加选项

        Returns:
            包含生成的密钥的响应
        """
        return self._client.send(
            "/api/settings/apple/generate-client-secret",
            method="POST",
            body={
                "clientId": client_id,
                "teamId": team_id,
                "keyId": key_id,
                "privateKey": private_key,
                "duration": duration,
            },
        )

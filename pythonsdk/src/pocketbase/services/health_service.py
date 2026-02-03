"""HealthService - 健康检查服务

提供 API 健康状态检查功能。
"""

from typing import TYPE_CHECKING, Any

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class HealthService(BaseService):
    """健康检查服务"""

    def __init__(self, client: "PocketBase") -> None:
        super().__init__(client)

    def check(self, **options: Any) -> dict[str, Any]:
        """检查 API 健康状态

        Args:
            **options: 附加选项

        Returns:
            健康状态信息，包含 code, message, data 等字段

        Example:
            >>> result = pb.health.check()
            >>> print(result)
            {"code": 200, "message": "API is healthy.", "data": {"canBackup": True}}
        """
        return self._client.send("/api/health", method="GET")

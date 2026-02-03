"""LogService - 日志服务

提供日志查询功能。
"""

from typing import TYPE_CHECKING, Any

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class LogService(BaseService):
    """日志服务"""

    def __init__(self, client: "PocketBase") -> None:
        super().__init__(client)

    def get_list(
        self,
        page: int = 1,
        per_page: int = 30,
        **options: Any,
    ) -> dict[str, Any]:
        """获取日志列表

        Args:
            page: 页码，默认 1
            per_page: 每页数量，默认 30
            **options: 附加选项

        Returns:
            分页的日志列表
        """
        return self._client.send(
            "/api/logs",
            method="GET",
            params={"page": page, "perPage": per_page},
        )

    def get_one(self, log_id: str, **options: Any) -> dict[str, Any]:
        """获取单条日志

        Args:
            log_id: 日志 ID
            **options: 附加选项

        Returns:
            日志详情
        """
        return self._client.send(f"/api/logs/{log_id}", method="GET")

    def get_stats(self, **options: Any) -> list[dict[str, Any]]:
        """获取日志统计

        Args:
            **options: 附加选项

        Returns:
            日志统计数据
        """
        return self._client.send("/api/logs/stats", method="GET")  # type: ignore

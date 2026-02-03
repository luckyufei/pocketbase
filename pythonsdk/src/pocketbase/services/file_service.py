"""FileService - 文件服务

提供文件 URL 构建和文件访问 token 获取功能。
"""

from typing import TYPE_CHECKING, Any
from urllib.parse import quote, urlencode

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


class FileService(BaseService):
    """文件服务

    用于构建文件 URL 和获取私有文件访问 token。
    """

    def __init__(self, client: "PocketBase") -> None:
        super().__init__(client)

    def get_url(
        self,
        record: dict[str, Any],
        filename: str,
        **query_params: Any,
    ) -> str:
        """构建文件的完整 URL

        Args:
            record: 包含 id 和 collectionId/collectionName 的记录对象
            filename: 文件名
            **query_params: 查询参数，如 thumb, download 等

        Returns:
            文件的完整 URL，如果参数无效则返回空字符串

        Example:
            >>> record = {"id": "abc123", "collectionId": "posts"}
            >>> url = pb.files.get_url(record, "image.png", thumb="100x100")
            >>> print(url)
            "http://127.0.0.1:8090/api/files/posts/abc123/image.png?thumb=100x100"
        """
        # 验证必需参数
        if not filename:
            return ""

        record_id = record.get("id")
        collection = record.get("collectionId") or record.get("collectionName")

        if not record_id or not collection:
            return ""

        # 构建路径部分，对特殊字符进行编码
        parts = [
            "api",
            "files",
            quote(str(collection), safe=""),
            quote(str(record_id), safe=""),
            quote(filename, safe=""),
        ]

        result = self._client.build_url("/".join(parts))

        # 处理查询参数
        if query_params:
            # 移除 download=False
            if query_params.get("download") is False:
                del query_params["download"]

            # 转换 download=True 为 download=1 (与 API 保持一致)
            if query_params.get("download") is True:
                query_params["download"] = "1"

            if query_params:
                params_str = urlencode(query_params)
                result += ("&" if "?" in result else "?") + params_str

        return result

    def get_token(self, **options: Any) -> str:
        """获取私有文件访问 token

        用于访问受保护的文件，需要认证。

        Args:
            **options: 附加选项

        Returns:
            文件访问 token

        Example:
            >>> token = pb.files.get_token()
            >>> url = pb.files.get_url(record, "private.pdf") + f"?token={token}"
        """
        response = self._client.send("/api/files/token", method="POST")
        return response.get("token", "")

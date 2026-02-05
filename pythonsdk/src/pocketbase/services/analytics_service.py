"""AnalyticsService for PocketBase analytics API.

提供用户行为分析功能，包括：
- 事件追踪（track_event, track_events）
- 统计查询（get_stats, get_top_pages, get_top_sources, get_devices）
- 原始日志（get_raw_logs, get_raw_log_download_url）
- 配置查询（get_config）

示例用法：
```python
from pocketbase import PocketBase

pb = PocketBase("http://127.0.0.1:8090")

# 追踪事件
pb.analytics.track_event(
    event="page_view",
    path="/home",
    session_id="user-session-123",
)

# 批量追踪
pb.analytics.track_events([
    {"event": "page_view", "path": "/home", "sessionId": "sess-1"},
    {"event": "click", "path": "/buy", "sessionId": "sess-1"},
])

# 获取统计数据（需要 Superuser 认证）
pb.collection("_superusers").auth_with_password("admin@example.com", "password")
stats = pb.analytics.get_stats(range="7d")
print(f"Total PV: {stats['summary']['totalPV']}")
print(f"Total UV: {stats['summary']['totalUV']}")

# 获取热门页面
pages = pb.analytics.get_top_pages(range="7d", limit=10)
for page in pages["pages"]:
    print(f"{page['path']}: {page['pv']} PV, {page['visitors']} UV")
```
"""

from typing import Any, TypedDict


from pocketbase.services.base_service import BaseService


class StatsSummary(TypedDict):
    """统计汇总数据。"""
    totalPV: int
    totalUV: int
    bounceRate: float
    avgDur: float


class DailyStats(TypedDict):
    """每日统计数据。"""
    date: str
    pv: int
    uv: int


class StatsResponse(TypedDict):
    """统计数据响应。"""
    summary: StatsSummary
    daily: list[DailyStats]
    startDate: str
    endDate: str


class PageStats(TypedDict):
    """页面统计数据。"""
    path: str
    pv: int
    visitors: int


class TopPagesResponse(TypedDict):
    """热门页面响应。"""
    pages: list[PageStats]
    startDate: str
    endDate: str


class SourceStats(TypedDict):
    """来源统计数据。"""
    source: str
    visitors: int


class TopSourcesResponse(TypedDict):
    """流量来源响应。"""
    sources: list[SourceStats]
    startDate: str
    endDate: str


class DeviceStats(TypedDict):
    """设备统计数据。"""
    name: str
    visitors: int


class DevicesResponse(TypedDict):
    """设备统计响应。"""
    browsers: list[DeviceStats]
    os: list[DeviceStats]
    startDate: str
    endDate: str


class RawLogsResponse(TypedDict):
    """原始日志响应。"""
    dates: list[str]


class ServerConfig(TypedDict):
    """服务端配置响应。"""
    enabled: bool
    retention: int
    flushInterval: int
    hasS3: bool


class EventsResponse(TypedDict):
    """事件提交响应。"""
    accepted: int
    total: int


class AnalyticsService(BaseService):
    """Service for interacting with analytics endpoints.
    
    提供事件追踪和统计查询功能。
    
    事件追踪方法（无需认证）：
    - track_event: 追踪单个事件
    - track_events: 批量追踪事件
    
    统计查询方法（需要 Superuser 认证）：
    - get_stats: 获取统计概览
    - get_top_pages: 获取热门页面
    - get_top_sources: 获取流量来源
    - get_devices: 获取设备统计
    - get_raw_logs: 获取原始日志列表
    - get_config: 获取服务端配置
    """

    def track_event(
        self,
        event: str,
        path: str,
        session_id: str | None = None,
        referrer: str | None = None,
        title: str | None = None,
        perf_ms: int | None = None,
        timestamp: int | None = None,
        **extra: Any,
    ) -> EventsResponse:
        """追踪单个分析事件。
        
        Args:
            event: 事件类型（如 "page_view", "click", "purchase"）
            path: 页面路径
            session_id: 会话 ID（用于 UV 去重），强烈建议提供
            referrer: 来源页面 URL
            title: 页面标题
            perf_ms: 页面加载耗时（毫秒）
            timestamp: 事件时间戳（毫秒），默认使用当前时间
            **extra: 其他自定义属性
            
        Returns:
            EventsResponse: 包含 accepted 和 total 字段
            
        示例:
            >>> pb.analytics.track_event(
            ...     event="purchase",
            ...     path="/checkout/success",
            ...     session_id="user-123",
            ...     order_id="ORD-456",
            ...     amount=99.99,
            ... )
            {'accepted': 1, 'total': 1}
        """
        event_data: dict[str, Any] = {
            "event": event,
            "path": path,
        }
        
        if session_id:
            event_data["sessionId"] = session_id
        if referrer:
            event_data["referrer"] = referrer
        if title:
            event_data["title"] = title
        if perf_ms is not None:
            event_data["perfMs"] = perf_ms
        if timestamp is not None:
            event_data["timestamp"] = timestamp
        
        # 添加额外的自定义属性
        event_data.update(extra)

        return self.track_events([event_data])

    def track_events(self, events: list[dict[str, Any]]) -> EventsResponse:
        """批量追踪分析事件。
        
        Args:
            events: 事件数据列表，每个事件应包含：
                - event: 事件类型（必填）
                - path: 页面路径（必填）
                - sessionId: 会话 ID（强烈建议）
                - referrer: 来源页面
                - title: 页面标题
                - perfMs: 页面加载耗时
                - timestamp: 事件时间戳（毫秒）
                - 其他自定义字段
            
        Returns:
            EventsResponse: 包含 accepted（成功接收数）和 total（总数）
            
        示例:
            >>> pb.analytics.track_events([
            ...     {"event": "page_view", "path": "/home", "sessionId": "sess-1"},
            ...     {"event": "click", "path": "/buy", "sessionId": "sess-1"},
            ... ])
            {'accepted': 2, 'total': 2}
        """
        return self.client.send(
            "/api/analytics/events",
            method="POST",
            body={"events": events},
        )

    def get_stats(
        self,
        range: str = "7d",  # noqa: A002
    ) -> StatsResponse:
        """获取统计数据概览。
        
        需要 Superuser 认证。
        
        Args:
            range: 日期范围，支持：
                - "today": 今天
                - "7d": 最近 7 天（默认）
                - "30d": 最近 30 天
                - "90d": 最近 90 天
            
        Returns:
            StatsResponse: 包含 summary（汇总）和 daily（每日数据）
            
        示例:
            >>> stats = pb.analytics.get_stats("7d")
            >>> print(f"Total PV: {stats['summary']['totalPV']}")
            >>> print(f"Total UV: {stats['summary']['totalUV']}")
            >>> for day in stats['daily']:
            ...     print(f"{day['date']}: {day['pv']} PV")
        """
        return self.client.send(
            "/api/analytics/stats",
            method="GET",
            params={"range": range},
        )

    def get_top_pages(
        self,
        range: str = "7d",  # noqa: A002
        limit: int = 10,
    ) -> TopPagesResponse:
        """获取热门页面排行。
        
        需要 Superuser 认证。
        
        Args:
            range: 日期范围（today, 7d, 30d, 90d）
            limit: 返回条数（默认 10，最大 100）
            
        Returns:
            TopPagesResponse: 包含 pages 列表，每个页面有 path, pv, visitors
            
        示例:
            >>> pages = pb.analytics.get_top_pages("7d", limit=5)
            >>> for page in pages["pages"]:
            ...     print(f"{page['path']}: {page['pv']} PV, {page['visitors']} UV")
        """
        return self.client.send(
            "/api/analytics/top-pages",
            method="GET",
            params={"range": range, "limit": limit},
        )

    def get_top_sources(
        self,
        range: str = "7d",  # noqa: A002
        limit: int = 10,
    ) -> TopSourcesResponse:
        """获取流量来源排行。
        
        需要 Superuser 认证。
        
        Args:
            range: 日期范围（today, 7d, 30d, 90d）
            limit: 返回条数（默认 10，最大 100）
            
        Returns:
            TopSourcesResponse: 包含 sources 列表，每个来源有 source 和 visitors
            
        示例:
            >>> sources = pb.analytics.get_top_sources("30d")
            >>> for src in sources["sources"]:
            ...     print(f"{src['source']}: {src['visitors']} visitors")
        """
        return self.client.send(
            "/api/analytics/top-sources",
            method="GET",
            params={"range": range, "limit": limit},
        )

    def get_devices(
        self,
        range: str = "7d",  # noqa: A002
    ) -> DevicesResponse:
        """获取设备/浏览器统计。
        
        需要 Superuser 认证。
        
        Args:
            range: 日期范围（today, 7d, 30d, 90d）
            
        Returns:
            DevicesResponse: 包含 browsers 和 os 列表
            
        示例:
            >>> devices = pb.analytics.get_devices("7d")
            >>> print("浏览器分布:")
            >>> for browser in devices["browsers"]:
            ...     print(f"  {browser['name']}: {browser['visitors']}")
            >>> print("操作系统分布:")
            >>> for os in devices["os"]:
            ...     print(f"  {os['name']}: {os['visitors']}")
        """
        return self.client.send(
            "/api/analytics/devices",
            method="GET",
            params={"range": range},
        )

    def get_config(self) -> ServerConfig:
        """获取服务端 Analytics 配置。
        
        需要 Superuser 认证。
        
        Returns:
            ServerConfig: 包含 enabled, retention, flushInterval, hasS3
            
        示例:
            >>> config = pb.analytics.get_config()
            >>> print(f"Analytics enabled: {config['enabled']}")
            >>> print(f"Data retention: {config['retention']} days")
        """
        return self.client.send(
            "/api/analytics/config",
            method="GET",
        )

    def get_raw_logs(self) -> RawLogsResponse:
        """获取可下载的原始日志日期列表。
        
        需要 Superuser 认证。
        
        Returns:
            RawLogsResponse: 包含 dates 列表（YYYY-MM-DD 格式）
            
        示例:
            >>> logs = pb.analytics.get_raw_logs()
            >>> for date in logs["dates"]:
            ...     print(f"Available: {date}")
        """
        return self.client.send(
            "/api/analytics/raw-logs",
            method="GET",
        )

    def get_raw_log_download_url(self, date: str) -> str:
        """获取指定日期原始日志的下载 URL。
        
        Args:
            date: 日期（格式：YYYY-MM-DD）
            
        Returns:
            完整的下载 URL
            
        示例:
            >>> url = pb.analytics.get_raw_log_download_url("2024-01-15")
            >>> print(url)  # http://127.0.0.1:8090/api/analytics/raw-logs/2024-01-15
        """
        return self.client.build_url(f"/api/analytics/raw-logs/{date}")

    def is_enabled(self) -> bool:
        """检查服务端 Analytics 是否启用。
        
        通过发送空事件请求来检测。
        
        Returns:
            bool: True 如果启用，False 如果禁用
            
        示例:
            >>> if pb.analytics.is_enabled():
            ...     pb.analytics.track_event("page_view", "/home", "sess-1")
        """
        try:
            # 发送空事件请求
            result = self.client.send(
                "/api/analytics/events",
                method="POST",
                body={"events": []},
            )
            # 如果返回错误但不是 404，说明 Analytics 启用了
            return True
        except Exception as e:
            # 检查是否是 404 错误
            if hasattr(e, "status") and e.status == 404:  # type: ignore
                return False
            # 400 错误（No events provided）说明 Analytics 启用了
            if hasattr(e, "status") and e.status == 400:  # type: ignore
                return True
            # 其他错误，假设未启用
            return False

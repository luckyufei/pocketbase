"""RealtimeService - SSE 实时订阅服务

提供 PocketBase 实时订阅功能，基于 Server-Sent Events (SSE)。
"""

import json
import threading
import time
from typing import TYPE_CHECKING, Any, Callable, Optional
from urllib.parse import quote, urlencode

from pocketbase.services.base_service import BaseService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase


# 订阅回调类型
SubscriptionCallback = Callable[[dict[str, Any]], None]

# 取消订阅函数类型
UnsubscribeFunc = Callable[[], None]


class RealtimeService(BaseService):
    """SSE 实时订阅服务"""

    def __init__(self, client: "PocketBase") -> None:
        super().__init__(client)

        # 客户端 ID (由服务器分配)
        self.client_id: str = ""

        # 订阅列表 {topic_key: [callback1, callback2, ...]}
        self._subscriptions: dict[str, list[SubscriptionCallback]] = {}

        # 上次发送的订阅列表
        self._last_sent_subscriptions: list[str] = []

        # SSE 连接对象
        self._sse_client: Any = None
        self._sse_thread: Optional[threading.Thread] = None
        self._sse_connected: bool = False

        # 连接超时
        self.max_connect_timeout: float = 15.0

        # 重连配置
        self._reconnect_attempts: int = 0
        self.max_reconnect_attempts: float = float("inf")
        self._predefined_reconnect_intervals: list[float] = [
            0.2, 0.3, 0.5, 1.0, 1.2, 1.5, 2.0
        ]

        # 待处理的连接 Promise
        self._pending_connects: list[dict[str, Callable]] = []

        # 断开连接回调
        self.on_disconnect: Optional[Callable[[list[str]], None]] = None

        # 停止标志
        self._stop_event = threading.Event()

    @property
    def is_connected(self) -> bool:
        """返回是否已建立实时连接"""
        return bool(self._sse_connected and self.client_id and not self._pending_connects)

    def subscribe(
        self,
        topic: str,
        callback: SubscriptionCallback,
        options: Optional[dict[str, Any]] = None,
    ) -> UnsubscribeFunc:
        """订阅主题

        Args:
            topic: 订阅主题 (如 "posts", "users/123")
            callback: 收到消息时的回调函数
            options: 可选的查询参数和请求头

        Returns:
            取消订阅函数

        Raises:
            ValueError: topic 为空时
        """
        if not topic:
            raise ValueError("topic must be set")

        key = topic

        # 序列化并附加选项
        if options:
            options_copy = dict(options)
            serialized = "options=" + quote(
                json.dumps({
                    "query": options_copy.get("query"),
                    "headers": options_copy.get("headers"),
                }),
                safe="",
            )
            key += ("&" if "?" in key else "?") + serialized

        # 存储监听器
        if key not in self._subscriptions:
            self._subscriptions[key] = []
        self._subscriptions[key].append(callback)

        if not self.is_connected:
            # 初始化 SSE 连接
            self._connect()
        elif len(self._subscriptions[key]) == 1:
            # 如果是该 key 的第一个订阅，发送更新
            self._submit_subscriptions()

        # 返回取消订阅函数
        def unsubscribe() -> None:
            self._unsubscribe_by_topic_and_listener(topic, callback)

        return unsubscribe

    def unsubscribe(self, topic: Optional[str] = None) -> None:
        """取消订阅

        Args:
            topic: 要取消的主题。如果为 None，取消所有订阅。
        """
        need_to_submit = False

        if topic is None:
            # 移除所有订阅
            self._subscriptions = {}
        else:
            # 移除与该 topic 相关的所有监听器
            subs = self._get_subscriptions_by_topic(topic)
            for key in subs:
                if not self._has_subscription_listeners(key):
                    continue

                del self._subscriptions[key]
                need_to_submit = True

        if not self._has_subscription_listeners():
            # 无其他活跃订阅 -> 关闭 SSE 连接
            self._disconnect()
        elif need_to_submit:
            self._submit_subscriptions()

    def unsubscribe_by_prefix(self, key_prefix: str) -> None:
        """按前缀取消订阅

        Args:
            key_prefix: 主题前缀
        """
        has_at_least_one = False
        keys_to_remove = []

        for key in self._subscriptions:
            # "?" 用作前缀的结束分隔符
            if not (key + "?").startswith(key_prefix):
                continue

            has_at_least_one = True
            keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._subscriptions[key]

        if not has_at_least_one:
            return

        if self._has_subscription_listeners():
            self._submit_subscriptions()
        else:
            self._disconnect()

    def _unsubscribe_by_topic_and_listener(
        self,
        topic: str,
        listener: SubscriptionCallback,
    ) -> None:
        """按主题和监听器取消订阅"""
        need_to_submit = False
        subs = self._get_subscriptions_by_topic(topic)

        for key in subs:
            if key not in self._subscriptions or not self._subscriptions[key]:
                continue

            # 移除匹配的监听器
            exists = False
            new_listeners = []
            for l in self._subscriptions[key]:
                if l is listener:
                    exists = True
                else:
                    new_listeners.append(l)

            if not exists:
                continue

            self._subscriptions[key] = new_listeners

            # 如果没有监听器了，删除 key
            if not self._subscriptions[key]:
                del self._subscriptions[key]

            if not need_to_submit and not self._has_subscription_listeners(key):
                need_to_submit = True

        if not self._has_subscription_listeners():
            self._disconnect()
        elif need_to_submit:
            self._submit_subscriptions()

    def _has_subscription_listeners(self, key_to_check: Optional[str] = None) -> bool:
        """检查是否有订阅监听器"""
        if key_to_check:
            return bool(self._subscriptions.get(key_to_check))

        for key in self._subscriptions:
            if self._subscriptions[key]:
                return True

        return False

    def _get_subscriptions_by_topic(self, topic: str) -> dict[str, list[SubscriptionCallback]]:
        """获取与 topic 匹配的订阅"""
        result: dict[str, list[SubscriptionCallback]] = {}

        # "?" 用作 topic 的结束分隔符
        topic = topic if "?" in topic else topic + "?"

        for key in self._subscriptions:
            if (key + "?").startswith(topic):
                result[key] = self._subscriptions[key]

        return result

    def _get_non_empty_subscription_keys(self) -> list[str]:
        """获取非空订阅的 keys"""
        return [key for key in self._subscriptions if self._subscriptions[key]]

    def _connect(self) -> None:
        """建立 SSE 连接"""
        if self._reconnect_attempts > 0:
            # 重连中，立即返回避免阻塞
            return

        # TODO: 实现真正的 SSE 连接
        # 这里先实现基本框架，后续集成 httpx-sse
        try:
            client_id = self._create_sse_connection()
            self.client_id = client_id
            self._sse_connected = True
        except Exception as e:
            self._handle_connection_error(e)
            raise

    def _create_sse_connection(self) -> str:
        """创建 SSE 连接 (实际实现需要 httpx-sse)

        Returns:
            client_id 由服务器返回
        """
        # 这个方法会在实际使用时被真正实现
        # 目前作为占位符，用于测试
        raise NotImplementedError("SSE connection not implemented yet")

    def _disconnect(self, from_reconnect: bool = False) -> None:
        """断开 SSE 连接

        Args:
            from_reconnect: 是否来自重连
        """
        if self.client_id and self.on_disconnect:
            self.on_disconnect(list(self._subscriptions.keys()))

        # 取消待处理请求
        self._client.cancel_request(self._get_subscriptions_cancel_key())

        # 关闭 SSE
        self._stop_event.set()
        if self._sse_thread and self._sse_thread.is_alive():
            self._sse_thread.join(timeout=1.0)

        self._sse_client = None
        self._sse_thread = None
        self._sse_connected = False
        self.client_id = ""

        if not from_reconnect:
            self._reconnect_attempts = 0
            # 解决所有待处理的连接 Promise
            for p in self._pending_connects:
                if "resolve" in p:
                    p["resolve"]()
            self._pending_connects = []

    def _submit_subscriptions(self) -> None:
        """提交订阅到服务器"""
        if not self.client_id:
            return

        self._last_sent_subscriptions = self._get_non_empty_subscription_keys()

        try:
            self._client.send(
                "/api/realtime",
                method="POST",
                body={
                    "clientId": self.client_id,
                    "subscriptions": self._last_sent_subscriptions,
                },
                request_key=self._get_subscriptions_cancel_key(),
            )
        except Exception as e:
            # 忽略取消的请求
            if hasattr(e, "is_abort") and e.is_abort:  # type: ignore
                return
            raise

    def _get_subscriptions_cancel_key(self) -> str:
        """获取订阅请求的取消 key"""
        return f"realtime_{self.client_id}"

    def _handle_connection_error(self, error: Exception) -> None:
        """处理连接错误"""
        # 增加重连次数
        if self._reconnect_attempts <= self.max_reconnect_attempts:
            self._reconnect_attempts += 1

    def _handle_pb_connect(self, client_id: str) -> None:
        """处理 PB_CONNECT 事件

        Args:
            client_id: 服务器分配的客户端 ID
        """
        self.client_id = client_id
        self._sse_connected = True
        self._reconnect_attempts = 0

    def _dispatch_event(self, event_type: str, data: dict[str, Any]) -> None:
        """分发事件给订阅者

        Args:
            event_type: 事件类型
            data: 事件数据
        """
        subs = self._get_subscriptions_by_topic(event_type)
        for key in subs:
            for callback in subs[key]:
                try:
                    callback(data)
                except Exception:
                    pass  # 忽略回调错误

    def _parse_message(self, raw_data: Optional[str]) -> dict[str, Any]:
        """解析 SSE 消息

        Args:
            raw_data: 原始消息数据

        Returns:
            解析后的字典
        """
        if not raw_data:
            return {}

        try:
            return json.loads(raw_data)
        except (json.JSONDecodeError, TypeError):
            return {}

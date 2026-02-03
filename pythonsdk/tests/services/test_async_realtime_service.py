"""Tests for AsyncRealtimeService - 异步 SSE 实时订阅服务测试

TDD 红灯阶段: T-7.2.5, T-7.2.6
"""

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from pocketbase import AsyncPocketBase


class TestAsyncRealtimeServiceInit:
    """AsyncRealtimeService 初始化测试"""

    @pytest.mark.asyncio
    async def test_async_realtime_service_exists_on_client(self, base_url: str) -> None:
        """测试 AsyncPocketBase 上存在 realtime 服务"""
        async with AsyncPocketBase(base_url) as pb:
            from pocketbase.services.async_realtime_service import AsyncRealtimeService
            assert hasattr(pb, "realtime")
            assert isinstance(pb.realtime, AsyncRealtimeService)

    @pytest.mark.asyncio
    async def test_initial_state(self, base_url: str) -> None:
        """测试初始状态"""
        async with AsyncPocketBase(base_url) as pb:
            assert pb.realtime.client_id == ""
            assert pb.realtime.is_connected is False
            assert pb.realtime._subscriptions == {}

    @pytest.mark.asyncio
    async def test_async_realtime_service_is_cached(self, base_url: str) -> None:
        """测试 realtime 服务缓存"""
        async with AsyncPocketBase(base_url) as pb:
            realtime1 = pb.realtime
            realtime2 = pb.realtime
            assert realtime1 is realtime2


class TestAsyncRealtimeServiceConnect:
    """异步 SSE 连接测试"""

    @pytest.mark.asyncio
    async def test_connect_establishes_connection(self, base_url: str) -> None:
        """测试异步连接建立"""
        async with AsyncPocketBase(base_url) as pb:
            with patch.object(pb.realtime, "_create_sse_connection", new_callable=AsyncMock) as mock_connect:
                mock_connect.return_value = "test-client-id"
                await pb.realtime._connect()

                assert pb.realtime.client_id == "test-client-id"
                mock_connect.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_timeout(self, base_url: str) -> None:
        """测试连接超时"""
        async with AsyncPocketBase(base_url) as pb:
            with patch.object(pb.realtime, "_create_sse_connection", new_callable=AsyncMock) as mock_connect:
                mock_connect.side_effect = TimeoutError("Connection timeout")

                with pytest.raises(TimeoutError):
                    await pb.realtime._connect()

    @pytest.mark.asyncio
    async def test_connect_max_timeout_configurable(self, base_url: str) -> None:
        """测试最大连接超时可配置"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.max_connect_timeout = 5.0
            assert pb.realtime.max_connect_timeout == 5.0

    @pytest.mark.asyncio
    async def test_connect_skipped_during_reconnect(self, base_url: str) -> None:
        """测试重连时跳过连接"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._reconnect_attempts = 1  # 正在重连

            with patch.object(pb.realtime, "_create_sse_connection", new_callable=AsyncMock) as mock_connect:
                await pb.realtime._connect()
                mock_connect.assert_not_awaited()


class TestAsyncRealtimeServiceMessageParsing:
    """消息解析测试"""

    @pytest.mark.asyncio
    async def test_parse_valid_json_message(self, base_url: str) -> None:
        """测试解析有效 JSON 消息"""
        async with AsyncPocketBase(base_url) as pb:
            raw_data = json.dumps({"action": "create", "record": {"id": "123", "name": "test"}})
            result = pb.realtime._parse_message(raw_data)

            assert result == {"action": "create", "record": {"id": "123", "name": "test"}}

    @pytest.mark.asyncio
    async def test_parse_invalid_json_returns_empty_dict(self, base_url: str) -> None:
        """测试解析无效 JSON 返回空字典"""
        async with AsyncPocketBase(base_url) as pb:
            result = pb.realtime._parse_message("invalid json {")
            assert result == {}

    @pytest.mark.asyncio
    async def test_parse_empty_message_returns_empty_dict(self, base_url: str) -> None:
        """测试解析空消息返回空字典"""
        async with AsyncPocketBase(base_url) as pb:
            result = pb.realtime._parse_message("")
            assert result == {}

    @pytest.mark.asyncio
    async def test_parse_none_returns_empty_dict(self, base_url: str) -> None:
        """测试解析 None 返回空字典"""
        async with AsyncPocketBase(base_url) as pb:
            result = pb.realtime._parse_message(None)  # type: ignore
            assert result == {}


class TestAsyncRealtimeServiceReconnect:
    """异步断线重连测试"""

    @pytest.mark.asyncio
    async def test_reconnect_attempts_incremented(self, base_url: str) -> None:
        """测试连接错误时重连计数增加"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._handle_connection_error(ConnectionError("Connection lost"))
            assert pb.realtime._reconnect_attempts >= 1

    @pytest.mark.asyncio
    async def test_reconnect_intervals(self, base_url: str) -> None:
        """测试重连间隔"""
        async with AsyncPocketBase(base_url) as pb:
            expected_intervals = [0.2, 0.3, 0.5, 1.0, 1.2, 1.5, 2.0]
            assert pb.realtime._predefined_reconnect_intervals == expected_intervals

    @pytest.mark.asyncio
    async def test_max_reconnect_attempts(self, base_url: str) -> None:
        """测试最大重连次数"""
        async with AsyncPocketBase(base_url) as pb:
            assert pb.realtime.max_reconnect_attempts == float("inf")

            pb.realtime.max_reconnect_attempts = 5
            assert pb.realtime.max_reconnect_attempts == 5


class TestAsyncRealtimeServiceSubscribe:
    """异步订阅测试"""

    @pytest.mark.asyncio
    async def test_subscribe_creates_subscription(self, base_url: str) -> None:
        """测试异步订阅创建"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    unsubscribe = await pb.realtime.subscribe("posts", callback)

                    assert "posts" in pb.realtime._subscriptions
                    assert callable(unsubscribe)

    @pytest.mark.asyncio
    async def test_subscribe_empty_topic_raises_error(self, base_url: str) -> None:
        """测试空 topic 抛出错误"""
        async with AsyncPocketBase(base_url) as pb:
            with pytest.raises(ValueError, match="topic must be set"):
                await pb.realtime.subscribe("", lambda x: None)

    @pytest.mark.asyncio
    async def test_subscribe_multiple_callbacks_same_topic(self, base_url: str) -> None:
        """测试同一 topic 多个回调"""
        async with AsyncPocketBase(base_url) as pb:
            callback1 = MagicMock()
            callback2 = MagicMock()

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", callback1)
                    await pb.realtime.subscribe("posts", callback2)

                    assert len(pb.realtime._subscriptions["posts"]) == 2

    @pytest.mark.asyncio
    async def test_subscribe_with_options(self, base_url: str) -> None:
        """测试带选项的订阅"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            options = {"query": {"filter": "status='active'"}, "headers": {"X-Custom": "value"}}

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", callback, options=options)

                    keys = list(pb.realtime._subscriptions.keys())
                    assert any("options=" in key for key in keys)

    @pytest.mark.asyncio
    async def test_subscribe_initializes_connection_if_not_connected(self, base_url: str) -> None:
        """测试未连接时初始化连接"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            connect_called = False

            async def mock_connect():
                nonlocal connect_called
                connect_called = True
                pb.realtime.client_id = "test-client"

            with patch.object(pb.realtime, "_connect", side_effect=mock_connect):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", callback)

                    assert connect_called

    @pytest.mark.asyncio
    async def test_subscribe_submits_if_already_connected(self, base_url: str) -> None:
        """测试已连接时提交订阅"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            pb.realtime.client_id = "test-client"
            pb.realtime._sse_connected = True

            submit_called = False

            async def mock_submit():
                nonlocal submit_called
                submit_called = True

            with patch.object(pb.realtime, "_submit_subscriptions", side_effect=mock_submit):
                await pb.realtime.subscribe("posts", callback)

                assert submit_called

    @pytest.mark.asyncio
    async def test_unsubscribe_function_removes_callback(self, base_url: str) -> None:
        """测试 unsubscribe 函数移除回调"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    unsubscribe = await pb.realtime.subscribe("posts", callback)
                    assert "posts" in pb.realtime._subscriptions

                    await unsubscribe()
                    assert "posts" not in pb.realtime._subscriptions or len(pb.realtime._subscriptions.get("posts", [])) == 0


class TestAsyncRealtimeServiceUnsubscribe:
    """异步取消订阅测试"""

    @pytest.mark.asyncio
    async def test_unsubscribe_removes_all_listeners_for_topic(self, base_url: str) -> None:
        """测试取消订阅移除 topic 的所有监听器"""
        async with AsyncPocketBase(base_url) as pb:
            callback1 = MagicMock()
            callback2 = MagicMock()

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", callback1)
                    await pb.realtime.subscribe("posts", callback2)

                    await pb.realtime.unsubscribe("posts")

                    assert "posts" not in pb.realtime._subscriptions

    @pytest.mark.asyncio
    async def test_unsubscribe_all_clears_subscriptions(self, base_url: str) -> None:
        """测试取消所有订阅"""
        async with AsyncPocketBase(base_url) as pb:
            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", lambda x: None)
                    await pb.realtime.subscribe("users", lambda x: None)

                    await pb.realtime.unsubscribe()

                    assert pb.realtime._subscriptions == {}

    @pytest.mark.asyncio
    async def test_unsubscribe_disconnects_when_no_subscriptions_left(self, base_url: str) -> None:
        """测试无订阅时断开连接"""
        async with AsyncPocketBase(base_url) as pb:
            disconnect_called = False

            async def mock_disconnect():
                nonlocal disconnect_called
                disconnect_called = True

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    with patch.object(pb.realtime, "_disconnect", side_effect=mock_disconnect):
                        await pb.realtime.subscribe("posts", lambda x: None)
                        await pb.realtime.unsubscribe("posts")

                        assert disconnect_called


class TestAsyncRealtimeServiceUnsubscribeByPrefix:
    """按前缀取消订阅测试"""

    @pytest.mark.asyncio
    async def test_unsubscribe_by_prefix(self, base_url: str) -> None:
        """测试按前缀取消订阅"""
        async with AsyncPocketBase(base_url) as pb:
            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", lambda x: None)
                    await pb.realtime.subscribe("posts/123", lambda x: None)
                    await pb.realtime.subscribe("users", lambda x: None)

                    await pb.realtime.unsubscribe_by_prefix("posts")

                    assert "posts" not in pb.realtime._subscriptions
                    assert "posts/123" not in pb.realtime._subscriptions
                    assert "users" in pb.realtime._subscriptions

    @pytest.mark.asyncio
    async def test_unsubscribe_by_prefix_no_match(self, base_url: str) -> None:
        """测试按前缀取消订阅无匹配"""
        async with AsyncPocketBase(base_url) as pb:
            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", lambda x: None)

                    await pb.realtime.unsubscribe_by_prefix("users")

                    assert "posts" in pb.realtime._subscriptions


class TestAsyncRealtimeServicePBConnect:
    """PB_CONNECT 事件测试"""

    @pytest.mark.asyncio
    async def test_pb_connect_event_sets_client_id(self, base_url: str) -> None:
        """测试 PB_CONNECT 事件设置 client_id"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._handle_pb_connect("test-client-id-123")

            assert pb.realtime.client_id == "test-client-id-123"
            assert pb.realtime._sse_connected is True
            assert pb.realtime._reconnect_attempts == 0

    @pytest.mark.asyncio
    async def test_pb_connect_callback_invoked(self, base_url: str) -> None:
        """测试 PB_CONNECT 回调被调用"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("PB_CONNECT", callback)

                    pb.realtime._handle_pb_connect("test-client-id")
                    await pb.realtime._dispatch_event("PB_CONNECT", {"client_id": "test-client-id"})

                    callback.assert_called_once()


class TestAsyncRealtimeServiceIsConnected:
    """is_connected 属性测试"""

    @pytest.mark.asyncio
    async def test_is_connected_false_when_no_client_id(self, base_url: str) -> None:
        """测试无 client_id 时返回 False"""
        async with AsyncPocketBase(base_url) as pb:
            assert pb.realtime.is_connected is False

    @pytest.mark.asyncio
    async def test_is_connected_true_when_connected(self, base_url: str) -> None:
        """测试已连接时返回 True"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = "test-client-id"
            pb.realtime._sse_connected = True

            assert pb.realtime.is_connected is True

    @pytest.mark.asyncio
    async def test_is_connected_false_during_pending_connect(self, base_url: str) -> None:
        """测试连接中返回 False"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = "test-client-id"
            pb.realtime._pending_connects.append(MagicMock())

            assert pb.realtime.is_connected is False

    @pytest.mark.asyncio
    async def test_is_connected_false_when_sse_not_connected(self, base_url: str) -> None:
        """测试 SSE 未连接时返回 False"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = "test-client-id"
            pb.realtime._sse_connected = False

            assert pb.realtime.is_connected is False


class TestAsyncRealtimeServiceOnDisconnect:
    """on_disconnect 钩子测试"""

    @pytest.mark.asyncio
    async def test_on_disconnect_callback_invoked(self, base_url: str) -> None:
        """测试 on_disconnect 回调被调用"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            pb.realtime.on_disconnect = callback

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", lambda x: None)
                    pb.realtime.client_id = "test-client-id"

                    await pb.realtime._disconnect()

                    callback.assert_called_once()

    @pytest.mark.asyncio
    async def test_on_disconnect_receives_active_subscriptions(self, base_url: str) -> None:
        """测试 on_disconnect 接收活跃订阅列表"""
        async with AsyncPocketBase(base_url) as pb:
            received_subs: list[str] = []

            def callback(active_subs: list[str]) -> None:
                received_subs.extend(active_subs)

            pb.realtime.on_disconnect = callback

            with patch.object(pb.realtime, "_connect", new_callable=AsyncMock):
                with patch.object(pb.realtime, "_submit_subscriptions", new_callable=AsyncMock):
                    await pb.realtime.subscribe("posts", lambda x: None)
                    await pb.realtime.subscribe("users", lambda x: None)
                    pb.realtime.client_id = "test-client-id"

                    await pb.realtime._disconnect()

                    assert "posts" in received_subs
                    assert "users" in received_subs

    @pytest.mark.asyncio
    async def test_on_disconnect_not_called_without_client_id(self, base_url: str) -> None:
        """测试无 client_id 时不调用 on_disconnect"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            pb.realtime.on_disconnect = callback
            pb.realtime.client_id = ""

            await pb.realtime._disconnect()

            callback.assert_not_called()


class TestAsyncRealtimeServiceSubmitSubscriptions:
    """异步提交订阅测试"""

    @pytest.mark.asyncio
    async def test_submit_subscriptions_sends_request(self, base_url: str, httpx_mock) -> None:
        """测试提交订阅发送请求"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = "test-client-id"
            pb.realtime._subscriptions = {"posts": [MagicMock()], "users": [MagicMock()]}

            httpx_mock.add_response(
                method="POST",
                url=f"{base_url}/api/realtime",
                json={},
            )

            await pb.realtime._submit_subscriptions()

            requests = httpx_mock.get_requests()
            assert len(requests) == 1
            assert requests[0].method == "POST"

            body = json.loads(requests[0].content)
            assert body["clientId"] == "test-client-id"
            assert set(body["subscriptions"]) == {"posts", "users"}

    @pytest.mark.asyncio
    async def test_submit_subscriptions_noop_without_client_id(self, base_url: str, httpx_mock) -> None:
        """测试无 client_id 时不发送请求"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = ""
            pb.realtime._subscriptions = {"posts": [MagicMock()]}

            await pb.realtime._submit_subscriptions()

            requests = httpx_mock.get_requests()
            assert len(requests) == 0


class TestAsyncRealtimeServiceDispatchEvent:
    """异步事件分发测试"""

    @pytest.mark.asyncio
    async def test_dispatch_event_calls_callbacks(self, base_url: str) -> None:
        """测试事件分发调用回调"""
        async with AsyncPocketBase(base_url) as pb:
            callback = MagicMock()
            pb.realtime._subscriptions = {"posts": [callback]}

            await pb.realtime._dispatch_event("posts", {"action": "create"})

            callback.assert_called_once_with({"action": "create"})

    @pytest.mark.asyncio
    async def test_dispatch_event_calls_async_callbacks(self, base_url: str) -> None:
        """测试事件分发调用异步回调"""
        async with AsyncPocketBase(base_url) as pb:
            received_data: list[dict[str, Any]] = []

            async def async_callback(data: dict[str, Any]) -> None:
                received_data.append(data)

            pb.realtime._subscriptions = {"posts": [async_callback]}

            await pb.realtime._dispatch_event("posts", {"action": "update"})

            assert len(received_data) == 1
            assert received_data[0] == {"action": "update"}

    @pytest.mark.asyncio
    async def test_dispatch_event_ignores_callback_errors(self, base_url: str) -> None:
        """测试事件分发忽略回调错误"""
        async with AsyncPocketBase(base_url) as pb:
            def error_callback(data: dict[str, Any]) -> None:
                raise RuntimeError("Callback error")

            success_callback = MagicMock()
            pb.realtime._subscriptions = {"posts": [error_callback, success_callback]}

            # 不应抛出异常
            await pb.realtime._dispatch_event("posts", {"action": "create"})

            success_callback.assert_called_once()


class TestAsyncRealtimeServiceHelperMethods:
    """辅助方法测试"""

    @pytest.mark.asyncio
    async def test_get_subscriptions_cancel_key(self, base_url: str) -> None:
        """测试获取取消 key"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime.client_id = "client-123"

            key = pb.realtime._get_subscriptions_cancel_key()

            assert key == "realtime_client-123"

    @pytest.mark.asyncio
    async def test_get_non_empty_subscription_keys(self, base_url: str) -> None:
        """测试获取非空订阅 keys"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._subscriptions = {
                "posts": [MagicMock()],
                "users": [],
                "comments": [MagicMock(), MagicMock()],
            }

            keys = pb.realtime._get_non_empty_subscription_keys()

            assert set(keys) == {"posts", "comments"}

    @pytest.mark.asyncio
    async def test_has_subscription_listeners_with_key(self, base_url: str) -> None:
        """测试检查特定 key 是否有监听器"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._subscriptions = {"posts": [MagicMock()], "users": []}

            assert pb.realtime._has_subscription_listeners("posts") is True
            assert pb.realtime._has_subscription_listeners("users") is False
            assert pb.realtime._has_subscription_listeners("comments") is False

    @pytest.mark.asyncio
    async def test_has_subscription_listeners_any(self, base_url: str) -> None:
        """测试检查是否有任意监听器"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._subscriptions = {}
            assert pb.realtime._has_subscription_listeners() is False

            pb.realtime._subscriptions = {"posts": []}
            assert pb.realtime._has_subscription_listeners() is False

            pb.realtime._subscriptions = {"posts": [MagicMock()]}
            assert pb.realtime._has_subscription_listeners() is True

    @pytest.mark.asyncio
    async def test_get_subscriptions_by_topic(self, base_url: str) -> None:
        """测试按 topic 获取订阅"""
        async with AsyncPocketBase(base_url) as pb:
            pb.realtime._subscriptions = {
                "posts": [MagicMock()],
                "posts?filter=active": [MagicMock()],
                "users": [MagicMock()],
            }

            result = pb.realtime._get_subscriptions_by_topic("posts")

            assert "posts" in result
            assert "posts?filter=active" in result
            assert "users" not in result

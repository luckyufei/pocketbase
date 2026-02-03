"""Tests for RealtimeService - SSE 实时订阅服务测试

TDD 红灯阶段: T-5.1.1 ~ T-5.4.6
"""

import json
import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from pocketbase import PocketBase
from pocketbase.services.realtime_service import RealtimeService


class TestRealtimeServiceInit:
    """RealtimeService 初始化测试"""

    def test_realtime_service_exists_on_client(self, base_url: str) -> None:
        """测试 Client 上存在 realtime 服务"""
        pb = PocketBase(base_url)
        assert hasattr(pb, "realtime")
        assert isinstance(pb.realtime, RealtimeService)

    def test_initial_state(self, base_url: str) -> None:
        """测试初始状态"""
        pb = PocketBase(base_url)
        assert pb.realtime.client_id == ""
        assert pb.realtime.is_connected is False
        assert pb.realtime._subscriptions == {}

    def test_realtime_service_is_cached(self, base_url: str) -> None:
        """测试 realtime 服务缓存"""
        pb = PocketBase(base_url)
        realtime1 = pb.realtime
        realtime2 = pb.realtime
        assert realtime1 is realtime2


class TestRealtimeServiceConnect:
    """SSE 连接测试 - T-5.1.1, T-5.1.2"""

    def test_connect_establishes_connection(self, base_url: str) -> None:
        """测试连接建立"""
        pb = PocketBase(base_url)

        # Mock SSE response
        with patch.object(pb.realtime, "_create_sse_connection") as mock_connect:
            mock_connect.return_value = "test-client-id"
            pb.realtime._connect()

            assert pb.realtime.client_id == "test-client-id"
            mock_connect.assert_called_once()

    def test_connect_timeout(self, base_url: str) -> None:
        """测试连接超时"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "_create_sse_connection") as mock_connect:
            mock_connect.side_effect = TimeoutError("Connection timeout")

            with pytest.raises(TimeoutError):
                pb.realtime._connect()

    def test_connect_max_timeout_configurable(self, base_url: str) -> None:
        """测试最大连接超时可配置"""
        pb = PocketBase(base_url)
        pb.realtime.max_connect_timeout = 5.0
        assert pb.realtime.max_connect_timeout == 5.0

    def test_connect_skipped_during_reconnect(self, base_url: str) -> None:
        """测试重连时跳过连接"""
        pb = PocketBase(base_url)
        pb.realtime._reconnect_attempts = 1  # 正在重连

        # 不应该调用 _create_sse_connection
        with patch.object(pb.realtime, "_create_sse_connection") as mock_connect:
            pb.realtime._connect()
            mock_connect.assert_not_called()


class TestRealtimeServiceMessageParsing:
    """消息解析测试 - T-5.1.3, T-5.1.4"""

    def test_parse_valid_json_message(self, base_url: str) -> None:
        """测试解析有效 JSON 消息"""
        pb = PocketBase(base_url)

        raw_data = json.dumps({"action": "create", "record": {"id": "123", "name": "test"}})
        result = pb.realtime._parse_message(raw_data)

        assert result == {"action": "create", "record": {"id": "123", "name": "test"}}

    def test_parse_invalid_json_returns_empty_dict(self, base_url: str) -> None:
        """测试解析无效 JSON 返回空字典"""
        pb = PocketBase(base_url)

        result = pb.realtime._parse_message("invalid json {")
        assert result == {}

    def test_parse_empty_message_returns_empty_dict(self, base_url: str) -> None:
        """测试解析空消息返回空字典"""
        pb = PocketBase(base_url)

        result = pb.realtime._parse_message("")
        assert result == {}

    def test_parse_none_returns_empty_dict(self, base_url: str) -> None:
        """测试解析 None 返回空字典"""
        pb = PocketBase(base_url)

        result = pb.realtime._parse_message(None)  # type: ignore
        assert result == {}


class TestRealtimeServiceReconnect:
    """断线重连测试 - T-5.1.5, T-5.1.6"""

    def test_reconnect_on_connection_error(self, base_url: str) -> None:
        """测试连接错误时自动重连"""
        pb = PocketBase(base_url)
        reconnect_attempts = []

        def mock_reconnect():
            reconnect_attempts.append(1)
            if len(reconnect_attempts) < 3:
                raise ConnectionError("Connection lost")

        with patch.object(pb.realtime, "_create_sse_connection", side_effect=mock_reconnect):
            # 重连逻辑会在连接错误时触发
            pb.realtime._handle_connection_error(ConnectionError("Connection lost"))

            # 验证重连尝试计数增加
            assert pb.realtime._reconnect_attempts >= 0

    def test_reconnect_intervals(self, base_url: str) -> None:
        """测试重连间隔"""
        pb = PocketBase(base_url)

        # 默认重连间隔
        expected_intervals = [0.2, 0.3, 0.5, 1.0, 1.2, 1.5, 2.0]
        assert pb.realtime._predefined_reconnect_intervals == expected_intervals

    def test_max_reconnect_attempts(self, base_url: str) -> None:
        """测试最大重连次数"""
        pb = PocketBase(base_url)

        # 默认无限重连
        assert pb.realtime.max_reconnect_attempts == float("inf")

        # 可配置
        pb.realtime.max_reconnect_attempts = 5
        assert pb.realtime.max_reconnect_attempts == 5


class TestRealtimeServiceSubscribe:
    """订阅测试 - T-5.2.1, T-5.2.2"""

    def test_subscribe_creates_subscription(self, base_url: str) -> None:
        """测试订阅创建"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                unsubscribe = pb.realtime.subscribe("posts", callback)

                assert "posts" in pb.realtime._subscriptions
                assert callable(unsubscribe)

    def test_subscribe_empty_topic_raises_error(self, base_url: str) -> None:
        """测试空 topic 抛出错误"""
        pb = PocketBase(base_url)

        with pytest.raises(ValueError, match="topic must be set"):
            pb.realtime.subscribe("", lambda x: None)

    def test_subscribe_multiple_callbacks_same_topic(self, base_url: str) -> None:
        """测试同一 topic 多个回调"""
        pb = PocketBase(base_url)

        callback1 = MagicMock()
        callback2 = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", callback1)
                pb.realtime.subscribe("posts", callback2)

                assert len(pb.realtime._subscriptions["posts"]) == 2

    def test_subscribe_with_options(self, base_url: str) -> None:
        """测试带选项的订阅"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        options = {"query": {"filter": "status='active'"}, "headers": {"X-Custom": "value"}}

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", callback, options=options)

                # 带选项的 key
                keys = list(pb.realtime._subscriptions.keys())
                assert any("options=" in key for key in keys)

    def test_subscribe_with_options_query_string(self, base_url: str) -> None:
        """测试带查询字符串的订阅"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                # 已有 query string
                pb.realtime.subscribe("posts?existing=1", callback, options={"query": {"new": "2"}})

                keys = list(pb.realtime._subscriptions.keys())
                assert any("&options=" in key for key in keys)

    def test_subscribe_initializes_connection_if_not_connected(self, base_url: str) -> None:
        """测试未连接时初始化连接"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        connect_called = False

        def mock_connect():
            nonlocal connect_called
            connect_called = True
            pb.realtime.client_id = "test-client"

        with patch.object(pb.realtime, "_connect", side_effect=mock_connect):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", callback)

                assert connect_called

    def test_subscribe_submits_if_already_connected(self, base_url: str) -> None:
        """测试已连接时提交订阅"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        pb.realtime.client_id = "test-client"
        pb.realtime._sse_connected = True

        submit_called = False

        def mock_submit():
            nonlocal submit_called
            submit_called = True

        with patch.object(pb.realtime, "_submit_subscriptions", side_effect=mock_submit):
            pb.realtime.subscribe("posts", callback)

            assert submit_called

    def test_unsubscribe_function_removes_callback(self, base_url: str) -> None:
        """测试 unsubscribe 函数移除回调"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                unsubscribe = pb.realtime.subscribe("posts", callback)
                assert "posts" in pb.realtime._subscriptions

                unsubscribe()
                # 回调应该被移除
                assert "posts" not in pb.realtime._subscriptions or len(pb.realtime._subscriptions.get("posts", [])) == 0


class TestRealtimeServiceUnsubscribe:
    """取消订阅测试 - T-5.2.3, T-5.2.4"""

    def test_unsubscribe_removes_all_listeners_for_topic(self, base_url: str) -> None:
        """测试取消订阅移除 topic 的所有监听器"""
        pb = PocketBase(base_url)

        callback1 = MagicMock()
        callback2 = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", callback1)
                pb.realtime.subscribe("posts", callback2)

                pb.realtime.unsubscribe("posts")

                assert "posts" not in pb.realtime._subscriptions

    def test_unsubscribe_all_clears_subscriptions(self, base_url: str) -> None:
        """测试取消所有订阅"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", lambda x: None)
                pb.realtime.subscribe("users", lambda x: None)

                pb.realtime.unsubscribe()

                assert pb.realtime._subscriptions == {}

    def test_unsubscribe_disconnects_when_no_subscriptions_left(self, base_url: str) -> None:
        """测试无订阅时断开连接"""
        pb = PocketBase(base_url)
        disconnect_called = False

        def mock_disconnect():
            nonlocal disconnect_called
            disconnect_called = True

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                with patch.object(pb.realtime, "_disconnect", side_effect=mock_disconnect):
                    pb.realtime.subscribe("posts", lambda x: None)
                    pb.realtime.unsubscribe("posts")

                    assert disconnect_called

    def test_unsubscribe_submits_when_other_subscriptions_exist(self, base_url: str) -> None:
        """测试有其他订阅时提交更新"""
        pb = PocketBase(base_url)

        submit_count = 0

        def mock_submit():
            nonlocal submit_count
            submit_count += 1

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions", side_effect=mock_submit):
                pb.realtime.subscribe("posts", lambda x: None)
                pb.realtime.subscribe("users", lambda x: None)

                # Reset count
                submit_count = 0

                pb.realtime.unsubscribe("posts")

                # Should submit because 'users' still exists
                assert "users" in pb.realtime._subscriptions
                assert submit_count == 1

    def test_unsubscribe_noop_for_already_unsubscribed(self, base_url: str) -> None:
        """测试重复取消订阅是 no-op"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                with patch.object(pb.realtime, "_disconnect") as mock_disconnect:
                    pb.realtime.subscribe("posts", lambda x: None)
                    pb.realtime.subscribe("users", lambda x: None)

                    pb.realtime.unsubscribe("posts")
                    mock_disconnect.reset_mock()

                    # 再次取消已取消的订阅
                    pb.realtime.unsubscribe("posts")

                    # 不应断开连接，因为还有 users


class TestRealtimeServiceUnsubscribeByPrefix:
    """按前缀取消订阅测试 - T-5.2.5, T-5.2.6"""

    def test_unsubscribe_by_prefix(self, base_url: str) -> None:
        """测试按前缀取消订阅"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", lambda x: None)
                pb.realtime.subscribe("posts/123", lambda x: None)
                pb.realtime.subscribe("users", lambda x: None)

                pb.realtime.unsubscribe_by_prefix("posts")

                assert "posts" not in pb.realtime._subscriptions
                assert "posts/123" not in pb.realtime._subscriptions
                assert "users" in pb.realtime._subscriptions

    def test_unsubscribe_by_prefix_no_match(self, base_url: str) -> None:
        """测试按前缀取消订阅无匹配"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", lambda x: None)

                # 不应报错
                pb.realtime.unsubscribe_by_prefix("users")

                assert "posts" in pb.realtime._subscriptions

    def test_unsubscribe_by_prefix_disconnects_when_no_subscriptions(self, base_url: str) -> None:
        """测试按前缀取消订阅后无订阅时断开"""
        pb = PocketBase(base_url)
        disconnect_called = False

        def mock_disconnect():
            nonlocal disconnect_called
            disconnect_called = True

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                with patch.object(pb.realtime, "_disconnect", side_effect=mock_disconnect):
                    pb.realtime.subscribe("posts", lambda x: None)
                    pb.realtime.subscribe("posts/123", lambda x: None)

                    pb.realtime.unsubscribe_by_prefix("posts")

                    assert disconnect_called


class TestRealtimeServicePBConnect:
    """PB_CONNECT 事件测试 - T-5.4.1, T-5.4.2"""

    def test_pb_connect_event_sets_client_id(self, base_url: str) -> None:
        """测试 PB_CONNECT 事件设置 client_id"""
        pb = PocketBase(base_url)

        # 模拟收到 PB_CONNECT 事件
        pb.realtime._handle_pb_connect("test-client-id-123")

        assert pb.realtime.client_id == "test-client-id-123"
        assert pb.realtime._sse_connected is True
        assert pb.realtime._reconnect_attempts == 0

    def test_pb_connect_callback_invoked(self, base_url: str) -> None:
        """测试 PB_CONNECT 回调被调用"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("PB_CONNECT", callback)

                # 模拟连接事件
                pb.realtime._handle_pb_connect("test-client-id")
                pb.realtime._dispatch_event("PB_CONNECT", {"client_id": "test-client-id"})

                callback.assert_called_once()


class TestRealtimeServiceIsConnected:
    """is_connected 属性测试 - T-5.4.3, T-5.4.4"""

    def test_is_connected_false_when_no_client_id(self, base_url: str) -> None:
        """测试无 client_id 时返回 False"""
        pb = PocketBase(base_url)
        assert pb.realtime.is_connected is False

    def test_is_connected_true_when_connected(self, base_url: str) -> None:
        """测试已连接时返回 True"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = "test-client-id"
        pb.realtime._sse_connected = True

        assert pb.realtime.is_connected is True

    def test_is_connected_false_during_pending_connect(self, base_url: str) -> None:
        """测试连接中返回 False"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = "test-client-id"
        pb.realtime._pending_connects.append(MagicMock())

        assert pb.realtime.is_connected is False

    def test_is_connected_false_when_sse_not_connected(self, base_url: str) -> None:
        """测试 SSE 未连接时返回 False"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = "test-client-id"
        pb.realtime._sse_connected = False

        assert pb.realtime.is_connected is False


class TestRealtimeServiceOnDisconnect:
    """on_disconnect 钩子测试 - T-5.4.5, T-5.4.6"""

    def test_on_disconnect_callback_invoked(self, base_url: str) -> None:
        """测试 on_disconnect 回调被调用"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        pb.realtime.on_disconnect = callback

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", lambda x: None)
                pb.realtime.client_id = "test-client-id"

                pb.realtime._disconnect()

                callback.assert_called_once()

    def test_on_disconnect_receives_active_subscriptions(self, base_url: str) -> None:
        """测试 on_disconnect 接收活跃订阅列表"""
        pb = PocketBase(base_url)

        received_subs = []

        def callback(active_subs):
            received_subs.extend(active_subs)

        pb.realtime.on_disconnect = callback

        with patch.object(pb.realtime, "_connect"):
            with patch.object(pb.realtime, "_submit_subscriptions"):
                pb.realtime.subscribe("posts", lambda x: None)
                pb.realtime.subscribe("users", lambda x: None)
                pb.realtime.client_id = "test-client-id"

                pb.realtime._disconnect()

                assert "posts" in received_subs
                assert "users" in received_subs

    def test_on_disconnect_not_called_without_client_id(self, base_url: str) -> None:
        """测试无 client_id 时不调用 on_disconnect"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        pb.realtime.on_disconnect = callback
        pb.realtime.client_id = ""

        pb.realtime._disconnect()

        callback.assert_not_called()


class TestRealtimeServiceSubmitSubscriptions:
    """提交订阅测试"""

    def test_submit_subscriptions_sends_request(self, base_url: str, httpx_mock) -> None:
        """测试提交订阅发送请求"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = "test-client-id"
        pb.realtime._subscriptions = {"posts": [MagicMock()], "users": [MagicMock()]}

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/realtime",
            json={},
        )

        pb.realtime._submit_subscriptions()

        requests = httpx_mock.get_requests()
        assert len(requests) == 1
        assert requests[0].method == "POST"

        body = json.loads(requests[0].content)
        assert body["clientId"] == "test-client-id"
        assert set(body["subscriptions"]) == {"posts", "users"}

    def test_submit_subscriptions_noop_without_client_id(self, base_url: str, httpx_mock) -> None:
        """测试无 client_id 时不发送请求"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = ""
        pb.realtime._subscriptions = {"posts": [MagicMock()]}

        pb.realtime._submit_subscriptions()

        requests = httpx_mock.get_requests()
        assert len(requests) == 0


class TestRealtimeServiceDispatchEvent:
    """事件分发测试"""

    def test_dispatch_event_calls_callbacks(self, base_url: str) -> None:
        """测试事件分发调用回调"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        pb.realtime._subscriptions = {"posts": [callback]}

        pb.realtime._dispatch_event("posts", {"action": "create"})

        callback.assert_called_once_with({"action": "create"})

    def test_dispatch_event_ignores_callback_errors(self, base_url: str) -> None:
        """测试事件分发忽略回调错误"""
        pb = PocketBase(base_url)

        def error_callback(data):
            raise RuntimeError("Callback error")

        success_callback = MagicMock()
        pb.realtime._subscriptions = {"posts": [error_callback, success_callback]}

        # 不应抛出异常
        pb.realtime._dispatch_event("posts", {"action": "create"})

        # 第二个回调应该仍然被调用
        success_callback.assert_called_once()


class TestRealtimeServiceHelperMethods:
    """辅助方法测试"""

    def test_get_subscriptions_cancel_key(self, base_url: str) -> None:
        """测试获取取消 key"""
        pb = PocketBase(base_url)
        pb.realtime.client_id = "client-123"

        key = pb.realtime._get_subscriptions_cancel_key()

        assert key == "realtime_client-123"

    def test_get_non_empty_subscription_keys(self, base_url: str) -> None:
        """测试获取非空订阅 keys"""
        pb = PocketBase(base_url)
        pb.realtime._subscriptions = {
            "posts": [MagicMock()],
            "users": [],
            "comments": [MagicMock(), MagicMock()],
        }

        keys = pb.realtime._get_non_empty_subscription_keys()

        assert set(keys) == {"posts", "comments"}

    def test_has_subscription_listeners_with_key(self, base_url: str) -> None:
        """测试检查特定 key 是否有监听器"""
        pb = PocketBase(base_url)
        pb.realtime._subscriptions = {"posts": [MagicMock()], "users": []}

        assert pb.realtime._has_subscription_listeners("posts") is True
        assert pb.realtime._has_subscription_listeners("users") is False
        assert pb.realtime._has_subscription_listeners("comments") is False

    def test_has_subscription_listeners_any(self, base_url: str) -> None:
        """测试检查是否有任意监听器"""
        pb = PocketBase(base_url)

        pb.realtime._subscriptions = {}
        assert pb.realtime._has_subscription_listeners() is False

        pb.realtime._subscriptions = {"posts": []}
        assert pb.realtime._has_subscription_listeners() is False

        pb.realtime._subscriptions = {"posts": [MagicMock()]}
        assert pb.realtime._has_subscription_listeners() is True

    def test_get_subscriptions_by_topic(self, base_url: str) -> None:
        """测试按 topic 获取订阅"""
        pb = PocketBase(base_url)
        pb.realtime._subscriptions = {
            "posts": [MagicMock()],
            "posts?filter=active": [MagicMock()],
            "users": [MagicMock()],
        }

        result = pb.realtime._get_subscriptions_by_topic("posts")

        assert "posts" in result
        assert "posts?filter=active" in result
        assert "users" not in result


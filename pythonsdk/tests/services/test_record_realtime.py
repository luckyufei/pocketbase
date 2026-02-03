"""Tests for RecordService realtime subscriptions

TDD 红灯阶段: T-5.3.1 ~ T-5.3.4
"""

from unittest.mock import MagicMock, patch

import pytest

from pocketbase import PocketBase


class TestRecordServiceSubscribe:
    """RecordService subscribe 测试 - T-5.3.1, T-5.3.2"""

    def test_subscribe_to_collection(self, base_url: str) -> None:
        """测试订阅整个 collection"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "subscribe") as mock_subscribe:
            mock_subscribe.return_value = lambda: None

            unsubscribe = pb.collection("posts").subscribe("*", callback)

            # 验证调用了 realtime.subscribe
            mock_subscribe.assert_called_once()
            call_args = mock_subscribe.call_args
            assert call_args[0][0] == "posts"  # topic
            assert callable(unsubscribe)

    def test_subscribe_to_single_record(self, base_url: str) -> None:
        """测试订阅单条记录"""
        pb = PocketBase(base_url)

        callback = MagicMock()

        with patch.object(pb.realtime, "subscribe") as mock_subscribe:
            mock_subscribe.return_value = lambda: None

            unsubscribe = pb.collection("posts").subscribe("record-123", callback)

            mock_subscribe.assert_called_once()
            call_args = mock_subscribe.call_args
            assert call_args[0][0] == "posts/record-123"

    def test_subscribe_with_options(self, base_url: str) -> None:
        """测试带选项的订阅"""
        pb = PocketBase(base_url)

        callback = MagicMock()
        options = {"query": {"filter": "status='active'"}}

        with patch.object(pb.realtime, "subscribe") as mock_subscribe:
            mock_subscribe.return_value = lambda: None

            pb.collection("posts").subscribe("*", callback, options=options)

            call_args = mock_subscribe.call_args
            assert call_args[1].get("options") == options


class TestRecordServiceUnsubscribe:
    """RecordService unsubscribe 测试 - T-5.3.3, T-5.3.4"""

    def test_unsubscribe_from_topic(self, base_url: str) -> None:
        """测试取消订阅特定 topic"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "unsubscribe") as mock_unsubscribe:
            pb.collection("posts").unsubscribe("*")

            mock_unsubscribe.assert_called_once_with("posts")

    def test_unsubscribe_from_record(self, base_url: str) -> None:
        """测试取消订阅特定记录"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "unsubscribe") as mock_unsubscribe:
            pb.collection("posts").unsubscribe("record-123")

            mock_unsubscribe.assert_called_once_with("posts/record-123")

    def test_unsubscribe_all(self, base_url: str) -> None:
        """测试取消所有订阅"""
        pb = PocketBase(base_url)

        with patch.object(pb.realtime, "unsubscribe_by_prefix") as mock_unsubscribe:
            pb.collection("posts").unsubscribe()

            mock_unsubscribe.assert_called_once_with("posts")

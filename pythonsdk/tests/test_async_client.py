"""Tests for AsyncPocketBase client."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from pocketbase.client_response_error import ClientResponseError


class TestAsyncPocketBase:
    """Test cases for AsyncPocketBase."""

    @pytest.fixture
    def client(self):
        """Create an AsyncPocketBase client instance."""
        from pocketbase import AsyncPocketBase
        return AsyncPocketBase("http://localhost:8090")

    def test_init(self):
        """Test client initialization."""
        from pocketbase import AsyncPocketBase
        
        client = AsyncPocketBase("http://localhost:8090")
        assert client.base_url == "http://localhost:8090"
        assert client.lang == "en-US"
        assert client.auth_store is not None

    def test_init_with_trailing_slash(self):
        """Test that trailing slash is removed from base URL."""
        from pocketbase import AsyncPocketBase
        
        client = AsyncPocketBase("http://localhost:8090/")
        assert client.base_url == "http://localhost:8090"

    def test_init_with_custom_lang(self):
        """Test client initialization with custom language."""
        from pocketbase import AsyncPocketBase
        
        client = AsyncPocketBase("http://localhost:8090", lang="zh-CN")
        assert client.lang == "zh-CN"

    def test_build_url(self, client) -> None:
        """Test URL building."""
        assert client.build_url("/api/test") == "http://localhost:8090/api/test"
        assert client.build_url("api/test") == "http://localhost:8090/api/test"

    @pytest.mark.asyncio
    async def test_send_get(self, client) -> None:
        """Test async GET request."""
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.content = b'{"data": "test"}'
            mock_response.json.return_value = {"data": "test"}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            result = await client.send("/api/test", method="GET")
            
            assert result == {"data": "test"}
            mock_client.request.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_post_with_body(self, client) -> None:
        """Test async POST request with body."""
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.content = b'{"id": "123"}'
            mock_response.json.return_value = {"id": "123"}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            result = await client.send(
                "/api/test",
                method="POST",
                body={"name": "test"},
            )
            
            assert result == {"id": "123"}
            call_kwargs = mock_client.request.call_args
            assert call_kwargs.kwargs.get("json") == {"name": "test"}

    @pytest.mark.asyncio
    async def test_send_with_auth(self, client) -> None:
        """Test that auth token is added to request."""
        client.auth_store.save("test_token", {"id": "user1"})
        
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.content = b'{}'
            mock_response.json.return_value = {}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            await client.send("/api/test")
            
            call_kwargs = mock_client.request.call_args
            headers = call_kwargs.kwargs.get("headers", {})
            assert headers.get("Authorization") == "test_token"

    @pytest.mark.asyncio
    async def test_send_error_response(self, client) -> None:
        """Test error handling for failed requests."""
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.url = "http://localhost:8090/api/test"
            mock_response.json.return_value = {"message": "Bad request"}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            with pytest.raises(ClientResponseError) as exc_info:
                await client.send("/api/test")
            
            assert exc_info.value.status == 400
            assert "Bad request" in str(exc_info.value.response)

    @pytest.mark.asyncio
    async def test_send_204_no_content(self, client) -> None:
        """Test handling of 204 No Content response."""
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 204
            mock_response.content = b''
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            result = await client.send("/api/test", method="DELETE")
            
            assert result == {}

    @pytest.mark.asyncio
    async def test_before_send_hook(self, client) -> None:
        """Test before_send hook is called."""
        def before_hook(url, options):
            options["headers"]["X-Custom"] = "value"
            return url, options
        
        client.before_send = before_hook
        
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.content = b'{}'
            mock_response.json.return_value = {}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            await client.send("/api/test")
            
            call_kwargs = mock_client.request.call_args
            headers = call_kwargs.kwargs.get("headers", {})
            assert headers.get("X-Custom") == "value"

    @pytest.mark.asyncio
    async def test_after_send_hook(self, client) -> None:
        """Test after_send hook is called."""
        def after_hook(result):
            result["processed"] = True
            return result
        
        client.after_send = after_hook
        
        with patch.object(client, "_http_client", new_callable=MagicMock) as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.content = b'{"data": "test"}'
            mock_response.json.return_value = {"data": "test"}
            
            mock_client.request = AsyncMock(return_value=mock_response)
            
            result = await client.send("/api/test")
            
            assert result["processed"] is True

    def test_collection_service(self, client) -> None:
        """Test async collection service accessor."""
        service = client.collection("users")
        assert service is not None
        assert service.collection_name == "users"

    def test_filter(self, client) -> None:
        """Test filter method."""
        result = client.filter("name = {:name}", {"name": "test"})
        assert "test" in result

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        """Test async context manager."""
        from pocketbase import AsyncPocketBase
        
        async with AsyncPocketBase("http://localhost:8090") as client:
            assert client.base_url == "http://localhost:8090"

    def test_services_accessible(self, client) -> None:
        """Test that all services are accessible."""
        assert hasattr(client, "collections")
        assert hasattr(client, "backups")
        assert hasattr(client, "crons")
        assert hasattr(client, "files")
        assert hasattr(client, "health")
        assert hasattr(client, "logs")
        assert hasattr(client, "settings")
        assert hasattr(client, "analytics")
        assert hasattr(client, "traces")
        assert hasattr(client, "jobs")
        assert hasattr(client, "secrets")

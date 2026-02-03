"""Additional tests to improve coverage."""

from typing import Any

import httpx
import pytest
from pytest_httpx import HTTPXMock


class TestModuleImports:
    """Test module-level imports."""

    def test_import_pocketbase_class(self) -> None:
        """Test importing PocketBase class directly."""
        from pocketbase import PocketBase

        assert PocketBase is not None
        assert callable(PocketBase)

    def test_import_client_response_error_class(self) -> None:
        """Test importing ClientResponseError class directly."""
        from pocketbase import ClientResponseError

        assert ClientResponseError is not None
        assert issubclass(ClientResponseError, Exception)

    def test_import_invalid_attribute(self) -> None:
        """Test importing invalid attribute raises AttributeError."""
        import pocketbase

        with pytest.raises(AttributeError, match="has no attribute"):
            _ = pocketbase.NonExistentClass

    def test_module_all_attribute(self) -> None:
        """Test module __all__ attribute."""
        import pocketbase

        assert "__all__" in dir(pocketbase)
        assert "PocketBase" in pocketbase.__all__
        assert "ClientResponseError" in pocketbase.__all__

    def test_module_version(self) -> None:
        """Test module version attribute."""
        import pocketbase

        assert hasattr(pocketbase, "__version__")
        assert isinstance(pocketbase.__version__, str)


class TestClientEdgeCases:
    """Test edge cases for PocketBase client."""

    def test_send_network_error(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test handling network errors."""
        from pocketbase.client import PocketBase
        from pocketbase.client_response_error import ClientResponseError

        httpx_mock.add_exception(httpx.ConnectError("Connection refused"))

        pb = PocketBase(base_url)

        with pytest.raises(ClientResponseError) as exc_info:
            pb.send("/api/health", method="GET")

        assert exc_info.value.status == 0
        assert exc_info.value.original_error is not None

    def test_send_error_without_json_body(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test handling error response without JSON body."""
        from pocketbase.client import PocketBase
        from pocketbase.client_response_error import ClientResponseError

        httpx_mock.add_response(
            method="GET",
            url=f"{base_url}/api/health",
            status_code=500,
            content=b"Internal Server Error",
        )

        pb = PocketBase(base_url)

        with pytest.raises(ClientResponseError) as exc_info:
            pb.send("/api/health", method="GET")

        assert exc_info.value.status == 500


class TestClientResponseErrorEdgeCases:
    """Test edge cases for ClientResponseError."""

    def test_error_repr(self) -> None:
        """Test __repr__ method."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(
            url="http://localhost/api/test",
            status=400,
            response={"message": "Bad request"},
        )

        repr_str = repr(error)
        assert "ClientResponseError" in repr_str
        assert "400" in repr_str

    def test_error_message_from_status(self) -> None:
        """Test error message generated from status code."""
        from pocketbase.client_response_error import ClientResponseError

        error = ClientResponseError(status=500)

        assert "500" in str(error)


class TestJwtEdgeCases:
    """Test edge cases for JWT utilities."""

    def test_get_token_payload_invalid_json(self) -> None:
        """Test handling invalid JSON in token payload."""
        from pocketbase.utils.jwt import get_token_payload

        # Token with invalid JSON in payload (not valid JSON after decode)
        # This creates a token where the payload decodes but isn't valid JSON
        token = "eyJhbGciOiJIUzI1NiJ9.bm90anNvbg.sig"
        payload = get_token_payload(token)

        assert payload == {}

    def test_is_token_expired_invalid_exp(self) -> None:
        """Test handling invalid exp claim type."""
        from pocketbase.utils.jwt import is_token_expired

        # Token with non-numeric exp
        # Payload: {"exp": "not_a_number"}
        token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiJub3RfYV9udW1iZXIifQ.sig"
        assert is_token_expired(token) is True


class TestBaseAuthStoreEdgeCases:
    """Test edge cases for BaseAuthStore."""

    def test_load_from_cookie_invalid_base64(self) -> None:
        """Test loading from invalid base64 cookie."""
        from pocketbase.stores.base_auth_store import BaseAuthStore

        store = BaseAuthStore()
        store.load_from_cookie("!!!invalid_base64!!!")

        assert store.token == ""

    def test_load_from_cookie_invalid_json(self) -> None:
        """Test loading from invalid JSON in cookie."""
        import base64

        from pocketbase.stores.base_auth_store import BaseAuthStore

        # Valid base64 but invalid JSON
        invalid_json = base64.b64encode(b"not json").decode()

        store = BaseAuthStore()
        store.load_from_cookie(invalid_json)

        assert store.token == ""

    def test_load_from_cookie_with_record(self) -> None:
        """Test loading cookie with record data."""
        import base64
        import json

        from pocketbase.stores.base_auth_store import BaseAuthStore

        # Create cookie with record data
        cookie_data = {
            "token": "test_token_123",
            "record": {
                "id": "user123",
                "collectionId": "col1",
                "collectionName": "users",
                "created": "2024-01-01",
                "updated": "2024-01-02",
            },
        }
        cookie = base64.b64encode(json.dumps(cookie_data).encode()).decode()

        store = BaseAuthStore()
        store.load_from_cookie(cookie)

        assert store.token == "test_token_123"
        assert store.record is not None
        assert store.record.id == "user123"
        assert store.record.collection_id == "col1"


class TestBaseService:
    """Test BaseService."""

    def test_client_property(self, base_url: str) -> None:
        """Test client property returns the client."""
        from pocketbase.client import PocketBase
        from pocketbase.services.base_service import BaseService

        pb = PocketBase(base_url)
        service = BaseService(pb)

        assert service.client is pb


class TestCrudServiceEdgeCases:
    """Test CRUD service edge cases."""

    def test_get_list_with_sort(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with sort option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"page": 1, "perPage": 30, "totalItems": 0, "totalPages": 0, "items": []},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_list(sort="-created")

        request = httpx_mock.get_request()
        assert "sort=-created" in str(request.url)

    def test_get_list_with_expand(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with expand option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"page": 1, "perPage": 30, "totalItems": 0, "totalPages": 0, "items": []},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_list(expand="author")

        request = httpx_mock.get_request()
        assert "expand=author" in str(request.url)

    def test_get_list_with_fields(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with fields option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"page": 1, "perPage": 30, "totalItems": 0, "totalPages": 0, "items": []},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_list(fields="id,title")

        request = httpx_mock.get_request()
        assert "fields=" in str(request.url)

    def test_get_list_with_skip_total(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_list with skipTotal option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={"page": 1, "perPage": 30, "totalItems": 0, "totalPages": 0, "items": []},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").get_list(skipTotal=True)

        request = httpx_mock.get_request()
        assert "skipTotal" in str(request.url)

    def test_create_with_expand(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test create with expand option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            json={"id": "new123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").create({"title": "Test"}, expand="author")

        request = httpx_mock.get_request()
        assert "expand=author" in str(request.url)

    def test_update_with_fields(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test update with fields option."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="PATCH",
            json={"id": "rec123", "collectionId": "col1", "collectionName": "posts", "created": "", "updated": ""},
        )

        pb = PocketBase(base_url)
        pb.collection("posts").update("rec123", {"title": "Updated"}, fields="id,title")

        request = httpx_mock.get_request()
        assert "fields=" in str(request.url)

    def test_get_full_list_empty_response(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test get_full_list with empty first page."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="GET",
            json={
                "page": 1,
                "perPage": 500,
                "totalItems": 0,
                "totalPages": 0,
                "items": [],
            },
        )

        pb = PocketBase(base_url)
        items = pb.collection("posts").get_full_list()

        assert len(items) == 0


class TestRecordServiceWithCreateData:
    """Test RecordService OAuth2 with createData."""

    def test_auth_with_oauth2_code_with_create_data(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test OAuth2 code authentication with createData."""
        from pocketbase.client import PocketBase

        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/users/auth-with-oauth2",
            json={
                "token": "oauth_token_123",
                "record": {
                    "id": "user123",
                    "collectionId": "_pb_users_auth_",
                    "collectionName": "users",
                    "created": "",
                    "updated": "",
                },
            },
        )

        pb = PocketBase(base_url)
        pb.collection("users").auth_with_oauth2_code(
            provider="google",
            code="auth_code",
            code_verifier="verifier",
            redirect_url="http://localhost:3000/callback",
            createData={"name": "New User"},
        )

        request = httpx_mock.get_request()
        assert request is not None

    def test_auth_response_without_record(self, base_url: str, httpx_mock: HTTPXMock) -> None:
        """Test auth response when record is None (superuser auth case)."""
        from pocketbase.client import PocketBase

        # Simulate a superuser auth response without record
        httpx_mock.add_response(
            method="POST",
            url=f"{base_url}/api/collections/_superusers/auth-with-password",
            json={
                "token": "superuser_token_123",
                # No record field - superuser doesn't have a record
            },
        )

        pb = PocketBase(base_url)
        result = pb.collection("_superusers").auth_with_password(
            identity="admin@example.com",
            password="password123",
        )

        assert result["token"] == "superuser_token_123"
        assert pb.auth_store.token == "superuser_token_123"
        assert pb.auth_store.record is None


class TestCrudServiceBasePath:
    """Test CrudService base_path property."""

    def test_base_path_property(self, base_url: str) -> None:
        """Test that base_path property returns the correct path."""
        from pocketbase.client import PocketBase

        pb = PocketBase(base_url)
        service = pb.collection("posts")

        assert service.base_path == "/api/collections/posts/records"

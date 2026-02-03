"""RecordService - Service for interacting with collection records."""

from typing import TYPE_CHECKING, Any, Callable, Optional

from pocketbase.models.record import RecordModel
from pocketbase.services.crud_service import CrudService

if TYPE_CHECKING:
    from pocketbase.client import PocketBase

# Subscription callback type
SubscriptionCallback = Callable[[dict[str, Any]], None]

# Unsubscribe function type
UnsubscribeFunc = Callable[[], None]


class RecordService(CrudService[RecordModel]):
    """Service for interacting with PocketBase collection records.
    
    Provides CRUD operations and authentication methods for records.
    
    Attributes:
        collection_name: The name of the collection.
    """

    def __init__(self, client: "PocketBase", collection_name: str) -> None:
        """Initialize the RecordService.
        
        Args:
            client: The PocketBase client instance.
            collection_name: The name of the collection.
        """
        base_path = f"/api/collections/{collection_name}/records"
        super().__init__(client, base_path)
        self._collection_name = collection_name

    @property
    def collection_name(self) -> str:
        """Get the collection name."""
        return self._collection_name

    @property
    def is_superusers(self) -> bool:
        """Check if this is the superusers collection."""
        return self._collection_name == "_superusers"

    def update(
        self,
        id: str,
        body: dict[str, Any],
        **options: Any,
    ) -> RecordModel:
        """Update a record and sync with auth store if needed.
        
        Args:
            id: The record ID.
            body: The update data.
            **options: Additional options.
            
        Returns:
            The updated record.
        """
        record = super().update(id, body, **options)

        # Update auth store if updating the authenticated record
        auth_record = self._client.auth_store.record
        if auth_record and auth_record.id == id:
            self._client.auth_store.save(self._client.auth_store.token, record)

        return record

    def delete(
        self,
        id: str,
        **options: Any,
    ) -> bool:
        """Delete a record and clear auth store if needed.
        
        Args:
            id: The record ID.
            **options: Additional options.
            
        Returns:
            True if deletion was successful.
        """
        result = super().delete(id, **options)

        # Clear auth store if deleting the authenticated record
        auth_record = self._client.auth_store.record
        if auth_record and auth_record.id == id:
            self._client.auth_store.clear()

        return result

    def auth_with_password(
        self,
        identity: str,
        password: str,
        auto_refresh_threshold: int | None = None,
        **options: Any,
    ) -> dict[str, Any]:
        """Authenticate with email/username and password.
        
        Args:
            identity: Email or username.
            password: The password.
            auto_refresh_threshold: If set (for superusers), enables auto token refresh
                                   when the token is about to expire within this many seconds.
            **options: Additional options.
            
        Returns:
            Auth response with token and record.
        """
        response = self._client.send(
            f"/api/collections/{self._collection_name}/auth-with-password",
            method="POST",
            body={
                "identity": identity,
                "password": password,
            },
        )

        result = self._auth_response(response)
        
        # Set up auto refresh for superusers if threshold is provided
        if auto_refresh_threshold is not None and self.is_superusers:
            self._client._auto_refresh_threshold = auto_refresh_threshold
            self._client._auto_refresh_callback = lambda: self.auth_refresh()
        
        return result

    def auth_refresh(self, **options: Any) -> dict[str, Any]:
        """Refresh the authentication token.
        
        Args:
            **options: Additional options.
            
        Returns:
            Auth response with new token and record.
        """
        response = self._client.send(
            f"/api/collections/{self._collection_name}/auth-refresh",
            method="POST",
        )

        return self._auth_response(response)

    def request_password_reset(
        self,
        email: str,
        **options: Any,
    ) -> bool:
        """Request a password reset email.
        
        Args:
            email: The user's email address.
            **options: Additional options.
            
        Returns:
            True if the request was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/request-password-reset",
            method="POST",
            body={"email": email},
        )
        return True

    def confirm_password_reset(
        self,
        token: str,
        password: str,
        password_confirm: str,
        **options: Any,
    ) -> bool:
        """Confirm password reset with token.
        
        Args:
            token: The password reset token.
            password: The new password.
            password_confirm: Password confirmation.
            **options: Additional options.
            
        Returns:
            True if the reset was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/confirm-password-reset",
            method="POST",
            body={
                "token": token,
                "password": password,
                "passwordConfirm": password_confirm,
            },
        )
        return True

    def request_verification(
        self,
        email: str,
        **options: Any,
    ) -> bool:
        """Request email verification.
        
        Args:
            email: The user's email address.
            **options: Additional options.
            
        Returns:
            True if the request was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/request-verification",
            method="POST",
            body={"email": email},
        )
        return True

    def confirm_verification(
        self,
        token: str,
        **options: Any,
    ) -> bool:
        """Confirm email verification with token.
        
        Args:
            token: The verification token.
            **options: Additional options.
            
        Returns:
            True if verification was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/confirm-verification",
            method="POST",
            body={"token": token},
        )
        return True

    def request_email_change(
        self,
        new_email: str,
        **options: Any,
    ) -> bool:
        """Request email address change.
        
        Args:
            new_email: The new email address.
            **options: Additional options.
            
        Returns:
            True if the request was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/request-email-change",
            method="POST",
            body={"newEmail": new_email},
        )
        return True

    def confirm_email_change(
        self,
        token: str,
        password: str,
        **options: Any,
    ) -> bool:
        """Confirm email change with token.
        
        Args:
            token: The email change token.
            password: The user's current password.
            **options: Additional options.
            
        Returns:
            True if change was successful.
        """
        self._client.send(
            f"/api/collections/{self._collection_name}/confirm-email-change",
            method="POST",
            body={
                "token": token,
                "password": password,
            },
        )
        return True

    def list_auth_methods(self, **options: Any) -> dict[str, Any]:
        """List available authentication methods.
        
        Args:
            **options: Additional options.
            
        Returns:
            Dictionary of available auth methods.
        """
        return self._client.send(
            f"/api/collections/{self._collection_name}/auth-methods",
            method="GET",
        )

    def request_otp(
        self,
        email: str,
        **options: Any,
    ) -> dict[str, Any]:
        """Request OTP for authentication.
        
        Args:
            email: The user's email address.
            **options: Additional options.
            
        Returns:
            OTP request response.
        """
        return self._client.send(
            f"/api/collections/{self._collection_name}/request-otp",
            method="POST",
            body={"email": email},
        )

    def auth_with_otp(
        self,
        otp_id: str,
        password: str,
        **options: Any,
    ) -> dict[str, Any]:
        """Authenticate with OTP.
        
        Args:
            otp_id: The OTP ID from request_otp.
            password: The OTP password/code.
            **options: Additional options.
            
        Returns:
            Auth response with token and record.
        """
        response = self._client.send(
            f"/api/collections/{self._collection_name}/auth-with-otp",
            method="POST",
            body={
                "otpId": otp_id,
                "password": password,
            },
        )

        return self._auth_response(response)

    def auth_with_oauth2_code(
        self,
        provider: str,
        code: str,
        code_verifier: str,
        redirect_url: str,
        **options: Any,
    ) -> dict[str, Any]:
        """Authenticate with OAuth2 authorization code.
        
        Args:
            provider: The OAuth2 provider name.
            code: The authorization code.
            code_verifier: The PKCE code verifier.
            redirect_url: The redirect URL used in the auth flow.
            **options: Additional options.
            
        Returns:
            Auth response with token and record.
        """
        body: dict[str, Any] = {
            "provider": provider,
            "code": code,
            "codeVerifier": code_verifier,
            "redirectUrl": redirect_url,
        }

        # Add optional parameters
        if "createData" in options:
            body["createData"] = options["createData"]

        response = self._client.send(
            f"/api/collections/{self._collection_name}/auth-with-oauth2",
            method="POST",
            body=body,
        )

        return self._auth_response(response)

    def impersonate(
        self,
        record_id: str,
        duration: int,
        **options: Any,
    ) -> "PocketBase":
        """Impersonate a user and return a new client with their auth token.
        
        This action requires superuser privileges.
        
        Args:
            record_id: The ID of the user to impersonate.
            duration: Token duration in seconds. If 0, uses default collection duration.
            **options: Additional options.
            
        Returns:
            A new PocketBase client with the impersonated user's auth token.
        """
        from urllib.parse import quote
        from pocketbase.client import PocketBase as PB
        from pocketbase.stores.base_auth_store import BaseAuthStore
        
        # Create a new client with fresh auth store
        impersonated_client = PB(
            self._client.base_url,
            auth_store=BaseAuthStore(),
            lang=self._client.lang,
        )
        
        # Make the impersonate request using the new client but with original auth
        # We need to manually set the Authorization header
        response = impersonated_client.send(
            f"/api/collections/{self._collection_name}/impersonate/{quote(record_id, safe='')}",
            method="POST",
            body={"duration": duration},
            headers={"Authorization": self._client.auth_store.token},
        )
        
        # Save the impersonated auth data to the new client
        token = response.get("token", "")
        record_data = response.get("record")
        
        if record_data:
            record = RecordModel.model_validate(record_data)
        else:
            record = None
        
        impersonated_client.auth_store.save(token, record)
        
        return impersonated_client

    def subscribe(
        self,
        topic: str,
        callback: SubscriptionCallback,
        options: Optional[dict[str, Any]] = None,
    ) -> UnsubscribeFunc:
        """Subscribe to realtime changes on this collection.
        
        Args:
            topic: The subscription topic. Use "*" for all records, or a specific record ID.
            callback: Function to call when an event is received.
            options: Optional subscription options (query, headers).
            
        Returns:
            A function to unsubscribe from the topic.
            
        Example:
            >>> # Subscribe to all record changes
            >>> unsubscribe = pb.collection("posts").subscribe("*", lambda e: print(e))
            >>> 
            >>> # Subscribe to a specific record
            >>> unsubscribe = pb.collection("posts").subscribe("record123", lambda e: print(e))
            >>> 
            >>> # Unsubscribe
            >>> unsubscribe()
        """
        # Build the full topic
        if topic == "*":
            full_topic = self._collection_name
        else:
            full_topic = f"{self._collection_name}/{topic}"
        
        return self._client.realtime.subscribe(full_topic, callback, options=options)

    def unsubscribe(self, topic: Optional[str] = None) -> None:
        """Unsubscribe from realtime changes.
        
        Args:
            topic: The topic to unsubscribe from. Use "*" for all records, 
                  a specific record ID, or None to unsubscribe from all topics
                  related to this collection.
                  
        Example:
            >>> # Unsubscribe from all record changes
            >>> pb.collection("posts").unsubscribe("*")
            >>> 
            >>> # Unsubscribe from a specific record
            >>> pb.collection("posts").unsubscribe("record123")
            >>> 
            >>> # Unsubscribe from all collection topics
            >>> pb.collection("posts").unsubscribe()
        """
        if topic is None:
            # Unsubscribe from all topics starting with collection name
            self._client.realtime.unsubscribe_by_prefix(self._collection_name)
        elif topic == "*":
            # Unsubscribe from the collection-level topic
            self._client.realtime.unsubscribe(self._collection_name)
        else:
            # Unsubscribe from a specific record topic
            self._client.realtime.unsubscribe(f"{self._collection_name}/{topic}")

    def _auth_response(self, response: dict[str, Any]) -> dict[str, Any]:
        """Process authentication response and update auth store.
        
        Args:
            response: The auth API response.
            
        Returns:
            The processed response.
        """
        token = response.get("token", "")
        record_data = response.get("record")

        if record_data:
            record = RecordModel.model_validate(record_data)
        else:
            record = None

        self._client.auth_store.save(token, record)

        return response

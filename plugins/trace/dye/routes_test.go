package dye

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestDyeAPIHandler_ListDyedUsers 测试获取染色用户列表
func TestDyeAPIHandler_ListDyedUsers(t *testing.T) {
	t.Run("returns all dyed users", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-1", time.Hour, "admin", "debug")
		_ = store.Add("user-2", time.Hour, "admin", "test")

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("GET", "/api/_/trace/dyed-users", nil)
		rec := httptest.NewRecorder()

		handler.ListDyedUsers(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var response DyeListResponse
		json.Unmarshal(rec.Body.Bytes(), &response)

		if len(response.Items) != 2 {
			t.Errorf("expected 2 users, got %d", len(response.Items))
		}
	})

	t.Run("returns empty list when no users", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("GET", "/api/_/trace/dyed-users", nil)
		rec := httptest.NewRecorder()

		handler.ListDyedUsers(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var response DyeListResponse
		json.Unmarshal(rec.Body.Bytes(), &response)

		if len(response.Items) != 0 {
			t.Errorf("expected 0 users, got %d", len(response.Items))
		}
	})
}

// TestDyeAPIHandler_GetDyedUser 测试获取单个染色用户
func TestDyeAPIHandler_GetDyedUser(t *testing.T) {
	t.Run("returns user info", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "admin", "debug")

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("GET", "/api/_/trace/dyed-users/user-123", nil)
		rec := httptest.NewRecorder()

		handler.GetDyedUser(rec, req, "user-123")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var user DyedUser
		json.Unmarshal(rec.Body.Bytes(), &user)

		if user.UserID != "user-123" {
			t.Errorf("expected user ID 'user-123', got '%s'", user.UserID)
		}
	})

	t.Run("returns 404 for non-existing user", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("GET", "/api/_/trace/dyed-users/non-existing", nil)
		rec := httptest.NewRecorder()

		handler.GetDyedUser(rec, req, "non-existing")

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", rec.Code)
		}
	})
}

// TestDyeAPIHandler_AddDyedUser 测试添加染色用户
func TestDyeAPIHandler_AddDyedUser(t *testing.T) {
	t.Run("adds user successfully", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		body := AddDyedUserRequest{
			UserID: "user-123",
			TTL:    "1h",
			Reason: "debug",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/_/trace/dyed-users", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.AddDyedUser(rec, req)

		if rec.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d", rec.Code)
		}

		if !store.IsDyed("user-123") {
			t.Error("expected user to be dyed")
		}
	})

	t.Run("returns 400 for missing user ID", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		body := AddDyedUserRequest{
			TTL: "1h",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/_/trace/dyed-users", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.AddDyedUser(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("returns 400 for invalid TTL format", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		body := AddDyedUserRequest{
			UserID: "user-123",
			TTL:    "invalid",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/_/trace/dyed-users", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.AddDyedUser(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("returns 409 when max users reached", func(t *testing.T) {
		store := NewMemoryDyeStore(1, time.Hour)
		defer store.Close()

		_ = store.Add("existing-user", time.Hour, "", "")

		handler := NewDyeAPIHandler(store)

		body := AddDyedUserRequest{
			UserID: "user-123",
			TTL:    "1h",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/_/trace/dyed-users", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.AddDyedUser(rec, req)

		if rec.Code != http.StatusConflict {
			t.Errorf("expected status 409, got %d", rec.Code)
		}
	})
}

// TestDyeAPIHandler_DeleteDyedUser 测试删除染色用户
func TestDyeAPIHandler_DeleteDyedUser(t *testing.T) {
	t.Run("deletes user successfully", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "", "")

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("DELETE", "/api/_/trace/dyed-users/user-123", nil)
		rec := httptest.NewRecorder()

		handler.DeleteDyedUser(rec, req, "user-123")

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", rec.Code)
		}

		if store.IsDyed("user-123") {
			t.Error("expected user to be undyed")
		}
	})

	t.Run("returns 204 for non-existing user", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		req := httptest.NewRequest("DELETE", "/api/_/trace/dyed-users/non-existing", nil)
		rec := httptest.NewRecorder()

		handler.DeleteDyedUser(rec, req, "non-existing")

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", rec.Code)
		}
	})
}

// TestDyeAPIHandler_UpdateTTL 测试更新 TTL
func TestDyeAPIHandler_UpdateTTL(t *testing.T) {
	t.Run("updates TTL successfully", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "", "")

		handler := NewDyeAPIHandler(store)

		body := UpdateTTLRequest{
			TTL: "2h",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/api/_/trace/dyed-users/user-123/ttl", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateTTL(rec, req, "user-123")

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("returns 404 for non-existing user", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		handler := NewDyeAPIHandler(store)

		body := UpdateTTLRequest{
			TTL: "2h",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/api/_/trace/dyed-users/non-existing/ttl", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateTTL(rec, req, "non-existing")

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", rec.Code)
		}
	})

	t.Run("returns 400 for invalid TTL format", func(t *testing.T) {
		store := NewMemoryDyeStore(100, time.Hour)
		defer store.Close()

		_ = store.Add("user-123", time.Hour, "", "")

		handler := NewDyeAPIHandler(store)

		body := UpdateTTLRequest{
			TTL: "invalid",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/api/_/trace/dyed-users/user-123/ttl", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.UpdateTTL(rec, req, "user-123")

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})
}

// TestRegisterDyeRoutes 测试路由注册
func TestRegisterDyeRoutes(t *testing.T) {
	store := NewMemoryDyeStore(100, time.Hour)
	defer store.Close()

	handler := NewDyeAPIHandler(store)
	mux := http.NewServeMux()

	handler.RegisterRoutes(mux, "/api/_/trace")

	// Verify handler is created
	if handler == nil {
		t.Error("expected handler to be non-nil")
	}
}

package dye

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

// DyeAPIHandler 处理染色用户 HTTP API
type DyeAPIHandler struct {
	store DyeStore
}

// NewDyeAPIHandler 创建染色用户 API 处理器
func NewDyeAPIHandler(store DyeStore) *DyeAPIHandler {
	return &DyeAPIHandler{store: store}
}

// DyeListResponse 染色用户列表响应
type DyeListResponse struct {
	Items []DyedUser `json:"items"`
	Count int        `json:"count"`
}

// AddDyedUserRequest 添加染色用户请求
type AddDyedUserRequest struct {
	UserID  string `json:"userId"`
	TTL     string `json:"ttl"`     // 格式: "1h", "30m", "24h" 等
	AddedBy string `json:"addedBy"` // 可选
	Reason  string `json:"reason"`  // 可选
}

// UpdateTTLRequest 更新 TTL 请求
type UpdateTTLRequest struct {
	TTL string `json:"ttl"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// RegisterRoutes 注册染色用户相关路由
func (h *DyeAPIHandler) RegisterRoutes(mux *http.ServeMux, prefix string) {
	mux.HandleFunc(prefix+"/dyed-users", h.handleDyedUsers)
	mux.HandleFunc(prefix+"/dyed-users/", h.handleDyedUser)
}

// handleDyedUsers 处理 /dyed-users 路由
func (h *DyeAPIHandler) handleDyedUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListDyedUsers(w, r)
	case http.MethodPost:
		h.AddDyedUser(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleDyedUser 处理 /dyed-users/{id} 和 /dyed-users/{id}/ttl 路由
func (h *DyeAPIHandler) handleDyedUser(w http.ResponseWriter, r *http.Request) {
	// 简单的路径解析
	// 实际实现中应该使用 chi、gorilla/mux 等路由库
	// 这里只是占位，实际路由处理在具体方法中
	http.NotFound(w, r)
}

// ListDyedUsers 获取所有染色用户
// GET /api/_/trace/dyed-users
func (h *DyeAPIHandler) ListDyedUsers(w http.ResponseWriter, r *http.Request) {
	users := h.store.List()
	response := DyeListResponse{
		Items: users,
		Count: len(users),
	}
	writeJSON(w, http.StatusOK, response)
}

// GetDyedUser 获取单个染色用户
// GET /api/_/trace/dyed-users/:id
func (h *DyeAPIHandler) GetDyedUser(w http.ResponseWriter, r *http.Request, userID string) {
	user, found := h.store.Get(userID)
	if !found {
		writeError(w, http.StatusNotFound, "Dyed user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// AddDyedUser 添加染色用户
// POST /api/_/trace/dyed-users
func (h *DyeAPIHandler) AddDyedUser(w http.ResponseWriter, r *http.Request) {
	var req AddDyedUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "userId is required")
		return
	}

	// 解析 TTL
	var ttl time.Duration
	if req.TTL != "" {
		var err error
		ttl, err = time.ParseDuration(req.TTL)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Invalid TTL format. Use format like '1h', '30m', '24h'")
			return
		}
	}

	// 添加用户
	err := h.store.Add(req.UserID, ttl, req.AddedBy, req.Reason)
	if err != nil {
		if errors.Is(err, ErrMaxDyedUsersReached) {
			writeError(w, http.StatusConflict, "Maximum dyed users limit reached")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// 获取添加后的用户信息
	user, _ := h.store.Get(req.UserID)
	writeJSON(w, http.StatusCreated, user)
}

// DeleteDyedUser 删除染色用户
// DELETE /api/_/trace/dyed-users/:id
func (h *DyeAPIHandler) DeleteDyedUser(w http.ResponseWriter, r *http.Request, userID string) {
	_ = h.store.Remove(userID)
	w.WriteHeader(http.StatusNoContent)
}

// UpdateTTL 更新染色用户 TTL
// PUT /api/_/trace/dyed-users/:id/ttl
func (h *DyeAPIHandler) UpdateTTL(w http.ResponseWriter, r *http.Request, userID string) {
	var req UpdateTTLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	// 解析 TTL
	ttl, err := time.ParseDuration(req.TTL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid TTL format. Use format like '1h', '30m', '24h'")
		return
	}

	// 更新 TTL
	err = h.store.UpdateTTL(userID, ttl)
	if err != nil {
		if errors.Is(err, ErrDyedUserNotFound) {
			writeError(w, http.StatusNotFound, "Dyed user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// 获取更新后的用户信息
	user, _ := h.store.Get(userID)
	writeJSON(w, http.StatusOK, user)
}

// writeJSON 写入 JSON 响应
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError 写入错误响应
func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    status,
		Message: message,
	})
}

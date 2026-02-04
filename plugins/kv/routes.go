package kv

import (
	"encoding/json"
	"io"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// registerRoutes 注册 HTTP API 路由
func registerRoutes(r *router.Router[*core.RequestEvent], app core.App, config Config) {
	kvGroup := r.Group("/api/kv")

	// 基础操作
	kvGroup.POST("/set", kvSetHandler(app))
	kvGroup.GET("/get", kvGetHandler(app))
	kvGroup.DELETE("/delete", kvDeleteHandler(app))
	kvGroup.GET("/exists", kvExistsHandler(app))

	// TTL 操作
	kvGroup.GET("/ttl", kvTTLHandler(app))
	kvGroup.POST("/expire", kvExpireHandler(app))

	// 计数器操作
	kvGroup.POST("/incr", kvIncrHandler(app))
	kvGroup.POST("/decr", kvDecrHandler(app))

	// Hash 操作
	kvGroup.POST("/hset", kvHSetHandler(app))
	kvGroup.GET("/hget", kvHGetHandler(app))
	kvGroup.GET("/hgetall", kvHGetAllHandler(app))
	kvGroup.POST("/hdel", kvHDelHandler(app))
	kvGroup.POST("/hincrby", kvHIncrByHandler(app))

	// 批量操作
	kvGroup.POST("/mset", kvMSetHandler(app))
	kvGroup.POST("/mget", kvMGetHandler(app))

	// 分布式锁
	kvGroup.POST("/lock", kvLockHandler(app))
	kvGroup.POST("/unlock", kvUnlockHandler(app))

	// 查询操作
	kvGroup.GET("/keys", kvKeysHandler(app))
}

// ==================== 请求/响应结构 ====================

type kvSetRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
	TTL   int64  `json:"ttl,omitempty"` // 可选，单位毫秒
}

type kvGetRequest struct {
	Key string `json:"key"`
}

type kvIncrRequest struct {
	Key   string `json:"key"`
	Delta int64  `json:"delta,omitempty"` // 可选，默认 1
}

type kvHSetRequest struct {
	Key   string `json:"key"`
	Field string `json:"field"`
	Value any    `json:"value"`
}

type kvHGetRequest struct {
	Key   string `json:"key"`
	Field string `json:"field"`
}

type kvHDelRequest struct {
	Key    string   `json:"key"`
	Fields []string `json:"fields"`
}

type kvHIncrByRequest struct {
	Key   string `json:"key"`
	Field string `json:"field"`
	Delta int64  `json:"delta"`
}

type kvMSetRequest struct {
	Pairs map[string]any `json:"pairs"`
}

type kvMGetRequest struct {
	Keys []string `json:"keys"`
}

type kvLockRequest struct {
	Key string `json:"key"`
	TTL int64  `json:"ttl"` // 单位毫秒
}

type kvKeysRequest struct {
	Pattern string `json:"pattern"`
}

type kvExpireRequest struct {
	Key string `json:"key"`
	TTL int64  `json:"ttl"` // 单位毫秒
}

// ==================== 处理器实现 ====================

func kvSetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvSetRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		var err error
		if req.TTL > 0 {
			err = kv.SetEx(req.Key, req.Value, time.Duration(req.TTL)*time.Millisecond)
		} else {
			err = kv.Set(req.Key, req.Value)
		}

		if err != nil {
			if err == ErrKeyTooLong {
				return e.BadRequestError(err.Error(), nil)
			}
			if err == ErrValueTooLarge {
				return e.BadRequestError(err.Error(), nil)
			}
			return e.InternalServerError("Failed to set value", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvGetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		value, err := kv.Get(key)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"found": false, "value": nil})
			}
			return e.InternalServerError("Failed to get value", err)
		}

		return e.JSON(200, map[string]any{"found": true, "value": value})
	}
}

func kvDeleteHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.Delete(key)
		if err != nil {
			return e.InternalServerError("Failed to delete key", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvExistsHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		exists, err := kv.Exists(key)
		if err != nil {
			return e.InternalServerError("Failed to check existence", err)
		}

		return e.JSON(200, map[string]any{"exists": exists})
	}
}

func kvTTLHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		ttl, err := kv.TTL(key)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"found": false, "ttl": -2})
			}
			return e.InternalServerError("Failed to get TTL", err)
		}

		// 返回毫秒
		return e.JSON(200, map[string]any{"found": true, "ttl": ttl.Milliseconds()})
	}
}

func kvExpireHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvExpireRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.Expire(req.Key, time.Duration(req.TTL)*time.Millisecond)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"ok": false, "error": "key not found"})
			}
			return e.InternalServerError("Failed to set expiration", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvIncrHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvIncrRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		delta := req.Delta
		if delta == 0 {
			delta = 1
		}

		value, err := kv.IncrBy(req.Key, delta)
		if err != nil {
			return e.InternalServerError("Failed to increment", err)
		}

		return e.JSON(200, map[string]any{"value": value})
	}
}

func kvDecrHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvIncrRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		delta := req.Delta
		if delta == 0 {
			delta = 1
		}

		value, err := kv.IncrBy(req.Key, -delta)
		if err != nil {
			return e.InternalServerError("Failed to decrement", err)
		}

		return e.JSON(200, map[string]any{"value": value})
	}
}

func kvHSetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvHSetRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" || req.Field == "" {
			return e.BadRequestError("Key and field are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.HSet(req.Key, req.Field, req.Value)
		if err != nil {
			return e.InternalServerError("Failed to set hash field", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvHGetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		field := e.Request.URL.Query().Get("field")

		if key == "" || field == "" {
			return e.BadRequestError("Key and field are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		value, err := kv.HGet(key, field)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"found": false, "value": nil})
			}
			return e.InternalServerError("Failed to get hash field", err)
		}

		return e.JSON(200, map[string]any{"found": true, "value": value})
	}
}

func kvHGetAllHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.URL.Query().Get("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		value, err := kv.HGetAll(key)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"found": false, "value": nil})
			}
			return e.InternalServerError("Failed to get hash", err)
		}

		return e.JSON(200, map[string]any{"found": true, "value": value})
	}
}

func kvHDelHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvHDelRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" || len(req.Fields) == 0 {
			return e.BadRequestError("Key and fields are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.HDel(req.Key, req.Fields...)
		if err != nil {
			return e.InternalServerError("Failed to delete hash fields", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvHIncrByHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvHIncrByRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" || req.Field == "" {
			return e.BadRequestError("Key and field are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		value, err := kv.HIncrBy(req.Key, req.Field, req.Delta)
		if err != nil {
			return e.InternalServerError("Failed to increment hash field", err)
		}

		return e.JSON(200, map[string]any{"value": value})
	}
}

func kvMSetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvMSetRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if len(req.Pairs) == 0 {
			return e.BadRequestError("Pairs are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.MSet(req.Pairs)
		if err != nil {
			return e.InternalServerError("Failed to set multiple values", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvMGetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvMGetRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if len(req.Keys) == 0 {
			return e.BadRequestError("Keys are required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		values, err := kv.MGet(req.Keys...)
		if err != nil {
			return e.InternalServerError("Failed to get multiple values", err)
		}

		return e.JSON(200, map[string]any{"values": values})
	}
}

func kvLockHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvLockRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		ttl := time.Duration(req.TTL) * time.Millisecond
		if ttl <= 0 {
			ttl = 30 * time.Second // 默认 30 秒
		}

		acquired, err := kv.Lock(req.Key, ttl)
		if err != nil {
			return e.InternalServerError("Failed to acquire lock", err)
		}

		return e.JSON(200, map[string]any{"acquired": acquired})
	}
}

func kvUnlockHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req kvGetRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		err := kv.Unlock(req.Key)
		if err != nil {
			if err == ErrNotFound {
				return e.JSON(200, map[string]any{"ok": false, "error": "lock not found or not owned"})
			}
			return e.InternalServerError("Failed to release lock", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

func kvKeysHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		pattern := e.Request.URL.Query().Get("pattern")
		if pattern == "" {
			pattern = "*"
		}

		kv := GetStore(app)
		if kv == nil {
			return e.InternalServerError("KV store not available", nil)
		}

		keys, err := kv.Keys(pattern)
		if err != nil {
			return e.InternalServerError("Failed to get keys", err)
		}

		return e.JSON(200, map[string]any{"keys": keys})
	}
}

// readJSON 读取 JSON 请求体
func readJSON(e *core.RequestEvent, v any) error {
	body, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return err
	}
	defer e.Request.Body.Close()

	return json.Unmarshal(body, v)
}

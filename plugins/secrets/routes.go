package secrets

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
)

// registerRoutes 注册 Secrets API 路由
func registerRoutes(rg *router.Router[*core.RequestEvent], app core.App, config Config) {
	subGroup := rg.Group("/api/secrets")

	// 所有路由都需要检查 Secrets 功能是否启用 + Superuser 权限
	subGroup.Bind(requireSecretsEnabled(app))
	subGroup.Bind(apis.RequireSuperuserAuth())

	// GET /api/secrets - 列出所有 Secrets（掩码显示）
	subGroup.GET("", secretsList(app))

	// POST /api/secrets - 创建 Secret
	subGroup.POST("", secretsCreate(app, config))

	// GET /api/secrets/{key} - 获取 Secret（解密值）
	subGroup.GET("/{key}", secretsGet(app))

	// PUT /api/secrets/{key} - 更新 Secret
	subGroup.PUT("/{key}", secretsUpdate(app, config))

	// DELETE /api/secrets/{key} - 删除 Secret
	subGroup.DELETE("/{key}", secretsDelete(app))
}

// requireSecretsEnabled 检查 Secrets 功能是否启用
func requireSecretsEnabled(app core.App) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id: "pbRequireSecretsEnabled",
		Func: func(e *core.RequestEvent) error {
			store := GetStore(app)
			if store == nil || !store.IsEnabled() {
				return e.JSON(http.StatusServiceUnavailable, map[string]string{
					"message": "Secrets feature is disabled. Please set PB_MASTER_KEY environment variable.",
				})
			}
			return e.Next()
		},
	}
}

// secretsList 列出所有 Secrets
func secretsList(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		store := GetStore(app)
		if store == nil {
			return e.InternalServerError("Secrets plugin not registered", ErrSecretsNotRegistered)
		}

		list, err := store.List()
		if err != nil {
			return e.InternalServerError("Failed to list secrets", err)
		}

		return e.JSON(http.StatusOK, map[string]any{
			"items": list,
			"total": len(list),
		})
	}
}

// SecretCreateRequest 创建 Secret 请求
type SecretCreateRequest struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Env         string `json:"env"`
	Description string `json:"description"`
}

// secretsCreate 创建 Secret
func secretsCreate(app core.App, config Config) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		store := GetStore(app)
		if store == nil {
			return e.InternalServerError("Secrets plugin not registered", ErrSecretsNotRegistered)
		}

		var req SecretCreateRequest
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		// 构建选项
		var opts []SecretOption
		if req.Env != "" {
			opts = append(opts, WithEnv(req.Env))
		}
		if req.Description != "" {
			opts = append(opts, WithDescription(req.Description))
		}

		// 创建 Secret
		if err := store.Set(req.Key, req.Value, opts...); err != nil {
			if err == ErrSecretKeyEmpty || err == ErrSecretKeyTooLong || err == ErrSecretValueTooLarge {
				return e.BadRequestError(err.Error(), err)
			}
			return e.InternalServerError("Failed to create secret", err)
		}

		env := req.Env
		if env == "" {
			env = config.DefaultEnv
		}

		return e.JSON(http.StatusOK, map[string]any{
			"key":     req.Key,
			"env":     env,
			"message": "Secret created successfully",
		})
	}
}

// secretsGet 获取 Secret（解密值）
func secretsGet(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		store := GetStore(app)
		if store == nil {
			return e.InternalServerError("Secrets plugin not registered", ErrSecretsNotRegistered)
		}

		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		value, err := store.Get(key)
		if err != nil {
			if err == ErrSecretNotFound {
				return e.NotFoundError("Secret not found", err)
			}
			return e.InternalServerError("Failed to get secret", err)
		}

		return e.JSON(http.StatusOK, map[string]any{
			"key":   key,
			"value": value,
		})
	}
}

// SecretUpdateRequest 更新 Secret 请求
type SecretUpdateRequest struct {
	Value       string `json:"value"`
	Description string `json:"description"`
}

// secretsUpdate 更新 Secret
func secretsUpdate(app core.App, config Config) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		store := GetStore(app)
		if store == nil {
			return e.InternalServerError("Secrets plugin not registered", ErrSecretsNotRegistered)
		}

		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		var req SecretUpdateRequest
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		// 构建选项
		var opts []SecretOption
		if req.Description != "" {
			opts = append(opts, WithDescription(req.Description))
		}

		// 更新 Secret（使用相同的 Set 方法，会覆盖）
		if err := store.Set(key, req.Value, opts...); err != nil {
			if err == ErrSecretValueTooLarge {
				return e.BadRequestError(err.Error(), err)
			}
			return e.InternalServerError("Failed to update secret", err)
		}

		return e.JSON(http.StatusOK, map[string]any{
			"key":     key,
			"message": "Secret updated successfully",
		})
	}
}

// secretsDelete 删除 Secret
func secretsDelete(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		store := GetStore(app)
		if store == nil {
			return e.InternalServerError("Secrets plugin not registered", ErrSecretsNotRegistered)
		}

		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		if err := store.Delete(key); err != nil {
			return e.InternalServerError("Failed to delete secret", err)
		}

		return e.NoContent(http.StatusNoContent)
	}
}

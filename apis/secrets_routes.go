package apis

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindSecretsApi 注册 Secrets API 路由
func bindSecretsApi(app core.App, rg *router.Router[*core.RequestEvent]) {
	subGroup := rg.Group("/api/secrets")

	// 所有路由都需要检查 Secrets 功能是否启用 + Superuser 权限
	subGroup.Bind(requireSecretsEnabled(app))
	subGroup.Bind(RequireSuperuserAuth())

	// GET /api/secrets - 列出所有 Secrets（掩码显示）
	subGroup.GET("", secretsList(app))

	// POST /api/secrets - 创建 Secret
	subGroup.POST("", secretsCreate(app))

	// GET /api/secrets/{key} - 获取 Secret（解密值）
	subGroup.GET("/{key}", secretsGet(app))

	// PUT /api/secrets/{key} - 更新 Secret
	subGroup.PUT("/{key}", secretsUpdate(app))

	// DELETE /api/secrets/{key} - 删除 Secret
	subGroup.DELETE("/{key}", secretsDelete(app))
}

// requireSecretsEnabled 检查 Secrets 功能是否启用
func requireSecretsEnabled(app core.App) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id: "pbRequireSecretsEnabled",
		Func: func(e *core.RequestEvent) error {
			secrets := app.Secrets()
			if secrets == nil || !secrets.IsEnabled() {
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
		list, err := app.Secrets().List()
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
func secretsCreate(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req SecretCreateRequest
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		// 构建选项
		var opts []core.SecretOption
		if req.Env != "" {
			opts = append(opts, core.WithEnv(req.Env))
		}
		if req.Description != "" {
			opts = append(opts, core.WithDescription(req.Description))
		}

		// 创建 Secret
		if err := app.Secrets().Set(req.Key, req.Value, opts...); err != nil {
			if err == core.ErrSecretKeyEmpty || err == core.ErrSecretKeyTooLong || err == core.ErrSecretValueTooLarge {
				return e.BadRequestError(err.Error(), err)
			}
			return e.InternalServerError("Failed to create secret", err)
		}

		return e.JSON(http.StatusOK, map[string]any{
			"key":     req.Key,
			"env":     req.Env,
			"message": "Secret created successfully",
		})
	}
}

// secretsGet 获取 Secret（解密值）
func secretsGet(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		value, err := app.Secrets().Get(key)
		if err != nil {
			if err == core.ErrSecretNotFound {
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
func secretsUpdate(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		var req SecretUpdateRequest
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		// 构建选项
		var opts []core.SecretOption
		if req.Description != "" {
			opts = append(opts, core.WithDescription(req.Description))
		}

		// 更新 Secret（使用相同的 Set 方法，会覆盖）
		if err := app.Secrets().Set(key, req.Value, opts...); err != nil {
			if err == core.ErrSecretValueTooLarge {
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
		key := e.Request.PathValue("key")
		if key == "" {
			return e.BadRequestError("Key is required", nil)
		}

		if err := app.Secrets().Delete(key); err != nil {
			return e.InternalServerError("Failed to delete secret", err)
		}

		return e.NoContent(http.StatusNoContent)
	}
}

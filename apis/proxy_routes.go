package apis

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindProxyApi 注册代理路由
// 代理路由使用动态匹配，拦截 /-/* 路径的请求
func bindProxyApi(app core.App, rg *router.Router[*core.RequestEvent]) {
	// 注册 /-/* 网关路由（推荐的代理前缀）
	// 使用通配符匹配所有 /-/ 开头的路径
	// 注意：必须使用具体的 HTTP 方法，避免与 /{path...} 静态文件路由冲突
	// Go 1.22 的 ServeMux 不允许 "ANY /-/{path...}" 和 "GET /{path...}" 同时存在
	proxyPath := "/-/{path...}"
	handler := proxyHandler(app)
	rg.GET(proxyPath, handler)
	rg.POST(proxyPath, handler)
	rg.PUT(proxyPath, handler)
	rg.PATCH(proxyPath, handler)
	rg.DELETE(proxyPath, handler)
	rg.HEAD(proxyPath, handler)
	rg.OPTIONS(proxyPath, handler)
}

// proxyHandler 创建代理请求处理器
func proxyHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		pm := app.ProxyManager()
		if pm == nil {
			return e.NotFoundError("Proxy manager not initialized", nil)
		}

		// 获取完整请求路径
		requestPath := e.Request.URL.Path

		// 匹配代理配置
		proxy := pm.MatchProxy(requestPath)
		if proxy == nil {
			return e.NotFoundError("No matching proxy found", nil)
		}

		// 检查代理是否启用
		if !proxy.Active {
			return e.NotFoundError("Proxy is disabled", nil)
		}

		// 检查访问权限
		allowed, err := core.CheckProxyAccess(e, proxy)
		if err != nil {
			return e.InternalServerError("Failed to check access", err)
		}
		if !allowed {
			if e.Auth == nil {
				return e.UnauthorizedError("Authentication required", nil)
			}
			return e.ForbiddenError("Access denied", nil)
		}

		// 执行代理转发
		pm.ServeHTTPWithAuth(e.Response, e.Request, proxy, e.Auth)

		return nil
	}
}

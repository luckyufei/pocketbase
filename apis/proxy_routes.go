package apis

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindProxyApi 注册代理路由
// 代理路由使用动态匹配，拦截 /-/* 和自定义路径的请求
func bindProxyApi(app core.App, rg *router.Router[*core.RequestEvent]) {
	// 注册 /-/* 网关路由（推荐的代理前缀）
	// 使用通配符匹配所有 /-/ 开头的路径
	rg.Any("/-/{path...}", proxyHandler(app))

	// 注册 fallback 路由用于开发代理模式
	// 这个路由优先级最低，只有在没有其他路由匹配时才会触发
	// 用于将未匹配的请求代理到 Vite 等开发服务器
	rg.Any("/{path...}", devProxyFallbackHandler(app)).
		BindFunc(func(e *core.RequestEvent) error {
			// 只有配置了 dev-proxy 才处理
			pm := app.ProxyManager()
			if pm == nil || pm.GetDevProxy() == "" {
				return e.Next()
			}
			return nil
		})
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

// devProxyFallbackHandler 开发代理 fallback 处理器
// 将未匹配的请求代理到开发服务器（如 Vite）
func devProxyFallbackHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		pm := app.ProxyManager()
		if pm == nil {
			return e.Next()
		}

		devProxy := pm.GetDevProxy()
		if devProxy == "" {
			return e.Next()
		}

		// 使用 ProxyManager 的 ServeHTTP 处理
		// 它会自动使用 devProxy 作为 fallback
		pm.ServeHTTP(e.Response, e.Request)

		return nil
	}
}

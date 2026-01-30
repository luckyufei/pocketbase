package gateway

import (
	"github.com/pocketbase/pocketbase/core"
)

// registerRoutes 注册代理路由
func (p *gatewayPlugin) registerRoutes(e *core.ServeEvent) {
	// 注册 /-/* 网关路由（推荐的代理前缀）
	// 使用通配符匹配所有 /-/ 开头的路径
	proxyPath := "/-/{path...}"
	handler := p.proxyHandler()

	// 为所有 HTTP 方法注册处理器
	e.Router.GET(proxyPath, handler)
	e.Router.POST(proxyPath, handler)
	e.Router.PUT(proxyPath, handler)
	e.Router.PATCH(proxyPath, handler)
	e.Router.DELETE(proxyPath, handler)
	e.Router.HEAD(proxyPath, handler)
	e.Router.OPTIONS(proxyPath, handler)
}

// proxyHandler 创建代理请求处理器
func (p *gatewayPlugin) proxyHandler() func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		if p.manager == nil {
			return e.NotFoundError("Gateway not initialized", nil)
		}

		// 获取完整请求路径
		requestPath := e.Request.URL.Path

		// 匹配代理配置
		proxy := p.manager.MatchProxy(requestPath)
		if proxy == nil {
			return e.NotFoundError("No matching proxy found", nil)
		}

		// 检查代理是否启用
		if !proxy.Active {
			return e.NotFoundError("Proxy is disabled", nil)
		}

		// 构建 AuthInfo
		var authInfo *AuthInfo
		if e.Auth != nil {
			authInfo = &AuthInfo{
				ID:     e.Auth.Id,
				Fields: make(map[string]any),
			}
			// 复制认证记录的字段
			for k, v := range e.Auth.PublicExport() {
				authInfo.Fields[k] = v
			}
		}

		// 检查访问权限
		isSuperuser := e.HasSuperuserAuth()
		if !CheckProxyAccess(proxy, isSuperuser, authInfo) {
			if e.Auth == nil {
				return e.UnauthorizedError("Authentication required", nil)
			}
			return e.ForbiddenError("Access denied", nil)
		}

		// 执行代理转发
		p.serveProxy(e, proxy, authInfo)

		return nil
	}
}

package gateway

import (
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// Manager 代理管理器
// 负责路由匹配、请求转发、Hot Reload
type Manager struct {
	app core.App

	mu        sync.RWMutex
	proxies   []*ProxyConfig // 按路径长度降序排列（最长匹配优先）
	transport *http.Transport
}

// NewManager 创建代理管理器实例
func NewManager(app core.App) *Manager {
	// 创建全局共享的 HTTP Transport
	// 参考 spec 中的配置要求
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment, // 支持系统代理
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true, // OpenAI HTTP/2 优化
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &Manager{
		app:       app,
		proxies:   make([]*ProxyConfig, 0),
		transport: transport,
	}
}

// SetProxies 设置代理配置列表（用于 Hot Reload）
// 会自动按路径长度降序排列，确保最长匹配优先
func (m *Manager) SetProxies(proxies []*ProxyConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 过滤出活跃的代理
	active := make([]*ProxyConfig, 0, len(proxies))
	for _, p := range proxies {
		if p.Active {
			active = append(active, p)
		}
	}

	// 按路径长度降序排列（最长匹配优先）
	sort.Slice(active, func(i, j int) bool {
		return len(active[i].Path) > len(active[j].Path)
	})

	m.proxies = active
}

// MatchProxy 匹配请求路径对应的代理配置
// 使用最长前缀匹配算法
func (m *Manager) MatchProxy(requestPath string) *ProxyConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, proxy := range m.proxies {
		if strings.HasPrefix(requestPath, proxy.Path) {
			// 确保是完整的路径段匹配
			// 例如 "/-/openai" 应该匹配 "/-/openai" 和 "/-/openai/xxx"
			// 但不应该匹配 "/-/openaiextra"
			remaining := requestPath[len(proxy.Path):]
			if remaining == "" || strings.HasPrefix(remaining, "/") {
				return proxy
			}
		}
	}

	return nil
}

// BuildUpstreamURL 构建上游请求 URL
func (m *Manager) BuildUpstreamURL(proxy *ProxyConfig, requestPath string) string {
	upstream := strings.TrimSuffix(proxy.Upstream, "/")

	var path string
	if proxy.StripPath {
		// 移除匹配的前缀
		path = strings.TrimPrefix(requestPath, proxy.Path)
	} else {
		path = requestPath
	}

	// 分离路径和查询字符串
	pathPart := path
	queryPart := ""
	if idx := strings.Index(path, "?"); idx != -1 {
		pathPart = path[:idx]
		queryPart = path[idx:]
	}

	// 确保路径以 / 开头（如果有路径的话）
	if pathPart != "" && !strings.HasPrefix(pathPart, "/") {
		pathPart = "/" + pathPart
	}

	return upstream + pathPart + queryPart
}

// Transport 返回共享的 HTTP Transport
func (m *Manager) Transport() *http.Transport {
	return m.transport
}

// GetProxies 返回当前活跃的代理配置（只读）
func (m *Manager) GetProxies() []*ProxyConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 返回副本，避免外部修改
	result := make([]*ProxyConfig, len(m.proxies))
	copy(result, m.proxies)
	return result
}

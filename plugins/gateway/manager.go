package gateway

import (
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

// ManagerConfig Manager 配置
// T050, T051, T052: 集成所有组件
type ManagerConfig struct {
	// TransportConfig HTTP Transport 配置
	TransportConfig TransportConfig

	// BufferPool 缓冲区池（可选）
	// T035: 注入 BufferPool
	BufferPool *BytesPool

	// Metrics 指标收集器（可选）
	Metrics *MetricsCollector
}

// Manager 代理管理器
// 负责路由匹配、请求转发、Hot Reload
type Manager struct {
	app    core.App
	config ManagerConfig

	mu        sync.RWMutex
	proxies   []*ProxyConfig // 按路径长度降序排列（最长匹配优先）
	transport *http.Transport

	// T050: 每个代理独立的控制组件
	limiters map[string]*ConcurrencyLimiter
	breakers map[string]*CircuitBreaker
}

// NewManager 创建代理管理器实例（使用默认配置）
func NewManager(app core.App) *Manager {
	return NewManagerWithConfig(app, ManagerConfig{
		TransportConfig: DefaultTransportConfig(),
	})
}

// NewManagerWithConfig 创建带配置的代理管理器
// T050, T051, T052: 集成所有组件
func NewManagerWithConfig(app core.App, config ManagerConfig) *Manager {
	// 使用 HardenedTransport
	transport := NewHardenedTransport(config.TransportConfig)

	return &Manager{
		app:       app,
		config:    config,
		proxies:   make([]*ProxyConfig, 0),
		transport: transport,
		limiters:  make(map[string]*ConcurrencyLimiter),
		breakers:  make(map[string]*CircuitBreaker),
	}
}

// SetProxies 设置代理配置列表（用于 Hot Reload）
// 会自动按路径长度降序排列，确保最长匹配优先
// T050: 为每个 Proxy 创建独立的 Limiter 和 CircuitBreaker
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

	// T050: 为每个代理创建控制组件
	// 清理旧的组件
	m.limiters = make(map[string]*ConcurrencyLimiter)
	m.breakers = make(map[string]*CircuitBreaker)

	for _, proxy := range active {
		// 创建 ConcurrencyLimiter
		if proxy.MaxConcurrent > 0 {
			m.limiters[proxy.ID] = NewConcurrencyLimiter(proxy.MaxConcurrent)
		}

		// 创建 CircuitBreaker
		if proxy.CircuitBreaker != nil && proxy.CircuitBreaker.Enabled {
			m.breakers[proxy.ID] = NewCircuitBreaker(*proxy.CircuitBreaker)
		}
	}
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

// BufferPool 返回缓冲区池
// T035: 注入 BufferPool
func (m *Manager) BufferPool() *BytesPool {
	return m.config.BufferPool
}

// Metrics 返回指标收集器
func (m *Manager) Metrics() *MetricsCollector {
	return m.config.Metrics
}

// GetLimiter 获取代理的并发限制器
// T050: 每个 Proxy 独立的 Limiter
func (m *Manager) GetLimiter(proxyID string) *ConcurrencyLimiter {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.limiters[proxyID]
}

// GetCircuitBreaker 获取代理的熔断器
// T050: 每个 Proxy 独立的 CircuitBreaker
func (m *Manager) GetCircuitBreaker(proxyID string) *CircuitBreaker {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.breakers[proxyID]
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

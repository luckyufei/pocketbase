package core

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// ProxyConfig 代理配置（内存中的路由表项）
type ProxyConfig struct {
	ID         string
	Path       string
	Upstream   string
	StripPath  bool
	AccessRule string
	Headers    map[string]string
	Timeout    int
	Active     bool
}

// ProxyManager 代理管理器
// 负责路由匹配、请求转发、Hot Reload
type ProxyManager struct {
	app App

	mu      sync.RWMutex
	proxies []*ProxyConfig // 按路径长度降序排列
}

// NewProxyManager 创建代理管理器实例
func NewProxyManager(app App) *ProxyManager {
	return &ProxyManager{
		app:     app,
		proxies: make([]*ProxyConfig, 0),
	}
}

// SetProxies 设置代理配置列表（用于 Hot Reload）
// 会自动按路径长度降序排列，确保最长匹配优先
func (pm *ProxyManager) SetProxies(proxies []*ProxyConfig) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

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

	pm.proxies = active
}

// MatchProxy 匹配请求路径对应的代理配置
// 使用最长前缀匹配算法
func (pm *ProxyManager) MatchProxy(requestPath string) *ProxyConfig {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, proxy := range pm.proxies {
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
func (pm *ProxyManager) BuildUpstreamURL(proxy *ProxyConfig, requestPath string) string {
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

// ServeHTTP 实现 http.Handler 接口
func (pm *ProxyManager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	proxy := pm.MatchProxy(r.URL.Path)
	if proxy == nil {
		http.NotFound(w, r)
		return
	}

	pm.serveProxy(w, r, proxy)
}

// serveProxy 执行代理转发
func (pm *ProxyManager) serveProxy(w http.ResponseWriter, r *http.Request, proxy *ProxyConfig) {
	startTime := time.Now()
	upstreamURL := pm.BuildUpstreamURL(proxy, r.URL.RequestURI())

	target, err := url.Parse(upstreamURL)
	if err != nil {
		pm.logProxyError(r, proxy, "invalid upstream URL", err)
		http.Error(w, "Bad Gateway: invalid upstream URL", http.StatusBadGateway)
		return
	}

	// 创建响应记录器以捕获状态码
	rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

	// 创建反向代理
	reverseProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL = target
			req.Host = target.Host

			// 保留原始请求头
			if r.Header.Get("X-Forwarded-For") == "" {
				req.Header.Set("X-Forwarded-For", r.RemoteAddr)
			}
			req.Header.Set("X-Forwarded-Host", r.Host)
			req.Header.Set("X-Forwarded-Proto", pm.getScheme(r))
		},
		FlushInterval: -1, // 立即 flush，支持 Streaming
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			if err == context.DeadlineExceeded {
				pm.logProxyError(r, proxy, "gateway timeout", err)
				http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
				return
			}
			pm.logProxyError(r, proxy, "bad gateway", err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
		},
	}

	// 设置超时
	timeout := proxy.Timeout
	if timeout <= 0 {
		timeout = 30
	}

	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	reverseProxy.ServeHTTP(rw, r.WithContext(ctx))

	// 记录请求日志
	pm.logProxyRequest(r, proxy, rw.statusCode, time.Since(startTime))
}

// getScheme 获取请求协议
func (pm *ProxyManager) getScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		return proto
	}
	return "http"
}

// LoadProxies 从数据库加载代理配置
func (pm *ProxyManager) LoadProxies() error {
	records, err := pm.app.FindAllRecords(CollectionNameProxies)
	if err != nil {
		// Collection 可能不存在（首次启动）
		return nil
	}

	configs := make([]*ProxyConfig, 0, len(records))
	for _, record := range records {
		config := &ProxyConfig{
			ID:         record.Id,
			Path:       record.GetString(ProxyFieldPath),
			Upstream:   record.GetString(ProxyFieldUpstream),
			StripPath:  record.GetBool(ProxyFieldStripPath),
			AccessRule: record.GetString(ProxyFieldAccessRule),
			Timeout:    record.GetInt(ProxyFieldTimeout),
			Active:     record.GetBool(ProxyFieldActive),
		}

		// 解析 headers JSON
		headers := make(map[string]string)
		record.UnmarshalJSONField(ProxyFieldHeaders, &headers)
		config.Headers = headers

		configs = append(configs, config)
	}

	pm.SetProxies(configs)
	return nil
}

// Reload 重新加载代理配置（Hot Reload）
func (pm *ProxyManager) Reload() error {
	return pm.LoadProxies()
}

// ServeHTTPWithAuth 带认证信息的代理转发
// 用于在 API 路由中调用，支持请求头注入
func (pm *ProxyManager) ServeHTTPWithAuth(w http.ResponseWriter, r *http.Request, proxy *ProxyConfig, authRecord *Record) {
	startTime := time.Now()
	upstreamURL := pm.BuildUpstreamURL(proxy, r.URL.RequestURI())

	target, err := url.Parse(upstreamURL)
	if err != nil {
		pm.logProxyError(r, proxy, "invalid upstream URL", err)
		http.Error(w, "Bad Gateway: invalid upstream URL", http.StatusBadGateway)
		return
	}

	// 创建响应记录器以捕获状态码
	rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

	// 创建反向代理
	reverseProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL = target
			req.Host = target.Host

			// 保留原始请求头
			if r.Header.Get("X-Forwarded-For") == "" {
				req.Header.Set("X-Forwarded-For", r.RemoteAddr)
			}
			req.Header.Set("X-Forwarded-Host", r.Host)
			req.Header.Set("X-Forwarded-Proto", pm.getScheme(r))

			// 注入自定义请求头
			if len(proxy.Headers) > 0 {
				headers, err := BuildProxyHeaders(pm.app, proxy.Headers, authRecord)
				if err == nil {
					for key, value := range headers {
						if value != "" {
							req.Header.Set(key, value)
						}
					}
				}
			}
		},
		FlushInterval: -1, // 立即 flush，支持 Streaming
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			if err == context.DeadlineExceeded {
				pm.logProxyError(r, proxy, "gateway timeout", err)
				http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
				return
			}
			pm.logProxyError(r, proxy, "bad gateway", err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
		},
	}

	// 设置超时
	timeout := proxy.Timeout
	if timeout <= 0 {
		timeout = 30
	}

	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	reverseProxy.ServeHTTP(rw, r.WithContext(ctx))

	// 记录请求日志
	pm.logProxyRequest(r, proxy, rw.statusCode, time.Since(startTime))
}

// responseWriter 包装 http.ResponseWriter 以捕获状态码
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// logProxyRequest 记录代理请求日志（不包含敏感 headers）
func (pm *ProxyManager) logProxyRequest(r *http.Request, proxy *ProxyConfig, statusCode int, duration time.Duration) {
	pm.app.Logger().Debug(
		"proxy request",
		"method", r.Method,
		"path", r.URL.Path,
		"proxy_path", proxy.Path,
		"upstream", proxy.Upstream,
		"status", statusCode,
		"duration_ms", duration.Milliseconds(),
		"remote_addr", r.RemoteAddr,
	)
}

// logProxyError 记录代理错误日志
func (pm *ProxyManager) logProxyError(r *http.Request, proxy *ProxyConfig, message string, err error) {
	pm.app.Logger().Warn(
		"proxy error",
		"message", message,
		"method", r.Method,
		"path", r.URL.Path,
		"proxy_path", proxy.Path,
		"upstream", proxy.Upstream,
		"error", err,
	)
}

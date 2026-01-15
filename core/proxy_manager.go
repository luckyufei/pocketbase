package core

import (
	"context"
	"io"
	"net"
	"net/http"
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

	mu        sync.RWMutex
	proxies   []*ProxyConfig // 按路径长度降序排列
	transport *http.Transport
}

// NewProxyManager 创建代理管理器实例
func NewProxyManager(app App) *ProxyManager {
	// 创建共享的 HTTP Transport
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &ProxyManager{
		app:       app,
		proxies:   make([]*ProxyConfig, 0),
		transport: transport,
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

// serveProxy 执行代理转发（直接使用 http.Client，完全控制请求响应）
func (pm *ProxyManager) serveProxy(w http.ResponseWriter, r *http.Request, proxy *ProxyConfig) {
	startTime := time.Now()
	upstreamURL := pm.BuildUpstreamURL(proxy, r.URL.RequestURI())

	// 设置超时
	timeout := proxy.Timeout
	if timeout <= 0 {
		timeout = 30
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	// 创建上游请求
	upstreamReq, err := http.NewRequestWithContext(ctx, r.Method, upstreamURL, r.Body)
	if err != nil {
		pm.logProxyError(r, proxy, "failed to create upstream request", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
		return
	}

	// 复制请求头
	for key, values := range r.Header {
		for _, value := range values {
			upstreamReq.Header.Add(key, value)
		}
	}

	// 设置代理相关头
	if r.Header.Get("X-Forwarded-For") == "" {
		upstreamReq.Header.Set("X-Forwarded-For", r.RemoteAddr)
	}
	upstreamReq.Header.Set("X-Forwarded-Host", r.Host)
	upstreamReq.Header.Set("X-Forwarded-Proto", pm.getScheme(r))

	// 设置正确的 Host 头
	parsedURL, _ := url.Parse(upstreamURL)
	if parsedURL != nil {
		upstreamReq.Host = parsedURL.Host
	}

	// 发送请求
	client := &http.Client{Transport: pm.transport}
	resp, err := client.Do(upstreamReq)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			pm.logProxyError(r, proxy, "gateway timeout", err)
			http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
		} else {
			pm.logProxyError(r, proxy, "bad gateway", err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
		}
		return
	}
	defer resp.Body.Close()

	// 复制响应头（排除 hop-by-hop 头）
	for key, values := range resp.Header {
		if !isHopByHopHeader(key) {
			for _, value := range values {
				w.Header().Add(key, value)
			}
		}
	}

	// 写入状态码
	w.WriteHeader(resp.StatusCode)

	// 流式复制响应体
	if flusher, ok := w.(http.Flusher); ok {
		// 支持 streaming：小块读取并立即 flush
		buf := make([]byte, 32*1024)
		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				if _, writeErr := w.Write(buf[:n]); writeErr != nil {
					break
				}
				flusher.Flush()
			}
			if readErr != nil {
				break
			}
		}
	} else {
		io.Copy(w, resp.Body)
	}

	pm.logProxyRequest(r, proxy, resp.StatusCode, time.Since(startTime))
}

// IsHopByHopHeader 检查是否为 hop-by-hop 头（不应转发）
// 这些头是针对单个传输层连接的，不应该被代理转发
func IsHopByHopHeader(header string) bool {
	hopByHop := map[string]bool{
		"Connection":          true,
		"Keep-Alive":          true,
		"Proxy-Authenticate":  true,
		"Proxy-Authorization": true,
		"Te":                  true,
		"Trailers":            true,
		"Transfer-Encoding":   true,
		"Upgrade":             true,
	}
	return hopByHop[http.CanonicalHeaderKey(header)]
}

// isHopByHopHeader 内部使用的别名
func isHopByHopHeader(header string) bool {
	return IsHopByHopHeader(header)
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

	// 设置超时
	timeout := proxy.Timeout
	if timeout <= 0 {
		timeout = 30
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	// 创建上游请求
	upstreamReq, err := http.NewRequestWithContext(ctx, r.Method, upstreamURL, r.Body)
	if err != nil {
		pm.logProxyError(r, proxy, "failed to create upstream request", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
		return
	}

	// 复制请求头
	for key, values := range r.Header {
		for _, value := range values {
			upstreamReq.Header.Add(key, value)
		}
	}

	// 设置代理相关头
	if r.Header.Get("X-Forwarded-For") == "" {
		upstreamReq.Header.Set("X-Forwarded-For", r.RemoteAddr)
	}
	upstreamReq.Header.Set("X-Forwarded-Host", r.Host)
	upstreamReq.Header.Set("X-Forwarded-Proto", pm.getScheme(r))

	// 设置正确的 Host 头
	parsedURL, _ := url.Parse(upstreamURL)
	if parsedURL != nil {
		upstreamReq.Host = parsedURL.Host
	}

	// 注入自定义请求头
	if len(proxy.Headers) > 0 {
		headers, err := BuildProxyHeaders(pm.app, proxy.Headers, authRecord)
		if err == nil {
			for key, value := range headers {
				if value != "" {
					upstreamReq.Header.Set(key, value)
				}
			}
		}
	}

	// 发送请求
	client := &http.Client{Transport: pm.transport}
	resp, err := client.Do(upstreamReq)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			pm.logProxyError(r, proxy, "gateway timeout", err)
			http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
		} else {
			pm.logProxyError(r, proxy, "bad gateway", err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
		}
		return
	}
	defer resp.Body.Close()

	// 复制响应头（排除 hop-by-hop 头）
	for key, values := range resp.Header {
		if !isHopByHopHeader(key) {
			for _, value := range values {
				w.Header().Add(key, value)
			}
		}
	}

	// 写入状态码
	w.WriteHeader(resp.StatusCode)

	// 流式复制响应体
	if flusher, ok := w.(http.Flusher); ok {
		buf := make([]byte, 32*1024)
		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				if _, writeErr := w.Write(buf[:n]); writeErr != nil {
					break
				}
				flusher.Flush()
			}
			if readErr != nil {
				break
			}
		}
	} else {
		io.Copy(w, resp.Body)
	}

	pm.logProxyRequest(r, proxy, resp.StatusCode, time.Since(startTime))
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

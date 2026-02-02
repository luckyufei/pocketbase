package gateway

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

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

// createReverseProxy 创建通用的 ReverseProxy 实例
// 实现 "暴力归一化" 策略，统一代理本地 Sidecar 和外部 LLM
// T035: 注入 BufferPool
// T031b: 注入 ModifyResponse 处理非标准响应
func (p *gatewayPlugin) createReverseProxy(targetURL string, proxy *ProxyConfig, authInfo *AuthInfo) *httputil.ReverseProxy {
	target, _ := url.Parse(targetURL)

	reverseProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			// 1. 基础地址重写
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			// 保留 Path（已在 BuildUpstreamURL 中处理）

			// 2. [核心防坑点 A] 重写 Host 头
			// OpenAI/Cloudflare 会校验 Host 头，localhost 会被拒绝
			req.Host = target.Host

			// 3. [核心防坑点 B] 暴力剥离压缩
			// 强迫上游发送 Plain Text，彻底解决 "Body Size Mismatch"
			// 代价：带宽增加 3-5 倍，但对 AI 文本流完全可接受
			req.Header.Del("Accept-Encoding")

			// 4. 清理 Hop-by-hop Headers
			req.Header.Del("Connection")
			req.Header.Del("Keep-Alive")
			req.Header.Del("Proxy-Authenticate")
			req.Header.Del("Te")
			req.Header.Del("Trailers")
			req.Header.Del("Upgrade")

			// 5. 设置代理相关头
			if req.Header.Get("X-Forwarded-For") == "" {
				// 保留原始客户端 IP
				req.Header.Set("X-Forwarded-For", req.RemoteAddr)
			}
			req.Header.Set("X-Forwarded-Host", req.Host)

			// 6. 注入自定义请求头
			if len(proxy.Headers) > 0 {
				secretGetter := p.createSecretGetter()
				headers, err := BuildProxyHeaders(proxy.Headers, authInfo, secretGetter)
				if err == nil {
					for key, value := range headers {
						if value != "" {
							req.Header.Set(key, value)
						}
					}
				}
			}
		},
		Transport: p.manager.Transport(),
		// 7. [关键] SSE 流式响应优化
		FlushInterval: DefaultFlushInterval,
		// 8. 结构化错误响应 (T031b)
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			handleUpstreamError(w, r, err)
		},
		// 9. T031b: 非标准响应容错处理
		ModifyResponse: createModifyResponse(),
	}

	// T035: 注入 BufferPool 减少 GC 压力
	if p.manager.BufferPool() != nil {
		reverseProxy.BufferPool = p.manager.BufferPool()
	}

	return reverseProxy
}

// serveProxy 执行代理转发
// T045: 增强结构化日志，记录 upstream_latency_ms 和 proxy_latency_ms
func (p *gatewayPlugin) serveProxy(e *core.RequestEvent, proxy *ProxyConfig, authInfo *AuthInfo) {
	startTime := time.Now()

	// 构建上游 URL
	upstreamURL := p.manager.BuildUpstreamURL(proxy, e.Request.URL.RequestURI())

	// 设置超时
	timeout := proxy.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	ctx, cancel := context.WithTimeout(e.Request.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	// 更新请求的 Context
	req := e.Request.WithContext(ctx)

	// 解析目标 URL
	target, err := url.Parse(upstreamURL)
	if err != nil {
		WriteGatewayError(e.Response, http.StatusBadGateway, ErrUpstreamUnavailable, "Invalid upstream URL: "+err.Error())
		return
	}

	// 设置请求 URL
	req.URL = target

	// 获取控制组件
	limiter := p.manager.GetLimiter(proxy.ID)
	breaker := p.manager.GetCircuitBreaker(proxy.ID)
	metrics := p.manager.Metrics()

	// 创建 ReverseProxy
	reverseProxy := p.createReverseProxy(upstreamURL, proxy, authInfo)

	// T045: 记录上游请求开始时间
	upstreamStart := time.Now()

	// 使用 wrapHandler 包装执行
	wrapped := wrapHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reverseProxy.ServeHTTP(w, r)
		}),
		proxy.ID,
		limiter,
		breaker,
		metrics,
	)

	// 执行代理
	wrapped.ServeHTTP(e.Response, req)

	// T045: 计算延迟
	upstreamLatency := time.Since(upstreamStart)
	totalDuration := time.Since(startTime)
	proxyLatency := totalDuration - upstreamLatency // 代理开销（不含上游）

	// T045: 结构化日志增强
	logFields := []any{
		"proxy_name", proxy.Path,
		"method", e.Request.Method,
		"path", e.Request.URL.Path,
		"upstream", proxy.Upstream,
		"upstream_latency_ms", upstreamLatency.Milliseconds(),
		"proxy_latency_ms", proxyLatency.Milliseconds(),
		"duration_ms", totalDuration.Milliseconds(),
	}

	// 添加可选字段
	if limiter != nil {
		logFields = append(logFields, "concurrent_count", limiter.InUse())
	}
	if breaker != nil {
		logFields = append(logFields, "circuit_state", breaker.State().String())
	}

	p.app.Logger().Debug("gateway request", logFields...)
}

// createSecretGetter 创建 Secret 获取函数
func (p *gatewayPlugin) createSecretGetter() SecretGetter {
	return func(name string) (string, error) {
		secrets := p.app.Secrets()
		if secrets == nil || !secrets.IsEnabled() {
			return "", nil
		}
		return secrets.Get(name)
	}
}

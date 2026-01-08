package apis

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/serverless/loader"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/tools/router"
)

// ServerlessConfig Serverless 路由配置
type ServerlessConfig struct {
	// FunctionsDir Serverless 函数目录
	FunctionsDir string

	// PoolSize 运行时实例池大小
	PoolSize int

	// Timeout HTTP 请求超时时间
	Timeout time.Duration

	// MaxBodySize 最大请求体大小
	MaxBodySize int64
}

// DefaultServerlessConfig 返回默认配置
func DefaultServerlessConfig() ServerlessConfig {
	return ServerlessConfig{
		FunctionsDir: "pb_serverless",
		PoolSize:     4,
		Timeout:      30 * time.Second,
		MaxBodySize:  10 * 1024 * 1024, // 10MB
	}
}

// DefaultRuntimeConfig 返回默认运行时配置
func DefaultRuntimeConfig() runtime.RuntimeConfig {
	return runtime.DefaultRuntimeConfig()
}

// ServerlessHandler Serverless 处理器
type ServerlessHandler struct {
	app    core.App
	config ServerlessConfig
	pool   *runtime.Pool
	loader *loader.Loader
	routes map[string]*loader.Module
	mu     sync.RWMutex
}

// NewServerlessHandler 创建新的 Serverless 处理器
func NewServerlessHandler(app core.App, config ServerlessConfig) (*ServerlessHandler, error) {
	// 创建运行时池
	pool, err := runtime.NewPool(config.PoolSize)
	if err != nil {
		return nil, err
	}

	// 创建加载器
	functionsDir := config.FunctionsDir
	if !filepath.IsAbs(functionsDir) {
		functionsDir = filepath.Join(app.DataDir(), "..", functionsDir)
	}

	ldr := loader.NewLoader(functionsDir)

	handler := &ServerlessHandler{
		app:    app,
		config: config,
		pool:   pool,
		loader: ldr,
		routes: make(map[string]*loader.Module),
	}

	// 扫描并注册路由
	if err := handler.scanRoutes(); err != nil {
		pool.Close()
		return nil, err
	}

	return handler, nil
}

// scanRoutes 扫描路由文件
func (h *ServerlessHandler) scanRoutes() error {
	modules, err := h.loader.ScanRoutes()
	if err != nil {
		// 如果目录不存在，不报错
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, module := range modules {
		h.routes[module.Route] = module
	}

	return nil
}

// Close 关闭处理器
func (h *ServerlessHandler) Close() error {
	if h.pool != nil {
		return h.pool.Close()
	}
	return nil
}

// ServeHTTP 实现 http.Handler 接口
func (h *ServerlessHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 直接处理 HTTP 请求
	h.handleHTTP(w, r)
}

// handleHTTP 处理原始 HTTP 请求
func (h *ServerlessHandler) handleHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 匹配路由
	module, params, ok := h.matchRoute(path)
	if !ok {
		h.writeError(w, http.StatusNotFound, "Route not found")
		return
	}

	// 检查 HTTP 方法是否支持
	method := r.Method
	exportedMethods := module.ExportedMethods()
	methodSupported := false
	for _, m := range exportedMethods {
		if m == method {
			methodSupported = true
			break
		}
	}
	if !methodSupported && len(exportedMethods) > 0 {
		h.writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// 构建 JS 请求对象
	jsReq, err := h.buildJSRequest(r, params)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "Failed to parse request")
		return
	}

	// 创建超时上下文
	ctx, cancel := context.WithTimeout(r.Context(), h.config.Timeout)
	defer cancel()

	// 获取运行时实例
	engine, err := h.pool.Acquire(ctx)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			h.writeError(w, http.StatusGatewayTimeout, "Gateway Timeout")
			return
		}
		h.writeError(w, http.StatusServiceUnavailable, "No available runtime")
		return
	}
	defer h.pool.Release(engine)

	// 构建执行代码
	code := h.buildExecutionCode(module, method, jsReq)

	// 执行 JS 代码
	result, err := engine.Execute(ctx, code, DefaultRuntimeConfig())
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			h.writeError(w, http.StatusGatewayTimeout, "Execution timeout")
			return
		}
		h.writeError(w, http.StatusInternalServerError, "Execution failed: "+err.Error())
		return
	}

	// 解析响应
	var jsResp jsResponse
	if err := json.Unmarshal([]byte(result.Value), &jsResp); err != nil {
		// 如果无法解析为 JSON，直接返回原始值
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(result.Value))
		return
	}

	h.writeJSResponse(w, &jsResp)
}

// Handle 处理 Serverless 请求（用于 PocketBase 路由集成）
func (h *ServerlessHandler) Handle(e *core.RequestEvent) error {
	h.handleHTTP(e.Response, e.Request)
	return nil
}

// matchRoute 匹配路由
func (h *ServerlessHandler) matchRoute(path string) (*loader.Module, map[string]string, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	params := make(map[string]string)
	pathSegments := strings.Split(path, "/")

	for route, module := range h.routes {
		routeSegments := strings.Split(route, "/")

		if len(routeSegments) != len(pathSegments) {
			continue
		}

		matched := true
		for i, seg := range routeSegments {
			if strings.HasPrefix(seg, ":") {
				// 动态参数
				params[seg[1:]] = pathSegments[i]
			} else if seg != pathSegments[i] {
				matched = false
				break
			}
		}

		if matched {
			return module, params, true
		}
	}

	return nil, nil, false
}

// jsRequest JS 请求对象
type jsRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	Params  map[string]string `json:"params"`
	Query   map[string]string `json:"query"`
}

// jsResponse JS 响应对象
type jsResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// buildJSRequest 构建 JS 请求对象
func (h *ServerlessHandler) buildJSRequest(r *http.Request, params map[string]string) (*jsRequest, error) {
	// 读取请求体
	var body string
	if r.Body != nil {
		data, err := io.ReadAll(io.LimitReader(r.Body, h.config.MaxBodySize))
		if err != nil {
			return nil, err
		}
		body = string(data)
	}

	// 转换 Headers
	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	// 转换 Query
	query := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			query[k] = v[0]
		}
	}

	return &jsRequest{
		Method:  r.Method,
		URL:     r.URL.Path,
		Headers: headers,
		Body:    body,
		Params:  params,
		Query:   query,
	}, nil
}

// buildExecutionCode 构建执行代码
func (h *ServerlessHandler) buildExecutionCode(module *loader.Module, method string, req *jsRequest) string {
	reqJSON, _ := json.Marshal(req)

	// 构建执行代码
	code := module.Code + "\n"
	code += `
(async function() {
    const __req = ` + string(reqJSON) + `;
    
    // 构建 Request 对象
    const request = new Request(__req.url, {
        method: __req.method,
        headers: __req.headers,
        body: __req.body || undefined
    });
    request.params = __req.params;
    request.query = __req.query;
    
    // 调用处理函数
    let response;
    if (typeof ` + method + ` === 'function') {
        response = await ` + method + `(request);
    } else {
        response = new Response(JSON.stringify({error: "Handler not found"}), {
            status: 404,
            headers: {"Content-Type": "application/json"}
        });
    }
    
    // 转换响应
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, name) => {
        headers[name] = value;
    });
    
    return JSON.stringify({
        status: response.status,
        headers: headers,
        body: body
    });
})();
`
	return code
}

// writeJSResponse 写入 JS 响应
func (h *ServerlessHandler) writeJSResponse(w http.ResponseWriter, resp *jsResponse) error {
	// 写入 Headers
	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}

	// 写入状态码
	if resp.Status > 0 {
		w.WriteHeader(resp.Status)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	// 写入 Body
	if resp.Body != "" {
		_, err := w.Write([]byte(resp.Body))
		return err
	}

	return nil
}

// writeError 写入错误响应
func (h *ServerlessHandler) writeError(w http.ResponseWriter, status int, message string) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	resp := map[string]string{"error": message}
	return json.NewEncoder(w).Encode(resp)
}

// bindServerlessApi 注册 Serverless API 路由
func bindServerlessApi(app core.App, rg *router.RouterGroup[*core.RequestEvent], config ServerlessConfig) error {
	handler, err := NewServerlessHandler(app, config)
	if err != nil {
		return err
	}

	// 注册通配符路由
	rg.Any("/pb_serverless/{path...}", func(e *core.RequestEvent) error {
		return handler.Handle(e)
	})

	return nil
}

// BindServerlessApiWithConfig 使用配置注册 Serverless API
func BindServerlessApiWithConfig(app core.App, rg *router.RouterGroup[*core.RequestEvent], config ServerlessConfig) error {
	return bindServerlessApi(app, rg, config)
}

// BindServerlessApi 使用默认配置注册 Serverless API
func BindServerlessApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) error {
	return bindServerlessApi(app, rg, DefaultServerlessConfig())
}

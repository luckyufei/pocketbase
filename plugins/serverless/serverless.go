// Package serverless 提供基于 WASM (QuickJS + wazero) 的 Serverless 运行时
//
// 支持 TypeScript/JavaScript 编写 HTTP Handler、DB Hooks、Cron Jobs，
// 兼容 Vercel AI SDK，提供 fetch、KV、Vector Search 等 Host Functions。
//
// Example:
//
//	serverless.MustRegister(app, serverless.Config{
//		FunctionsDir: "pb_serverless",
//		PoolSize:     4,
//	})
package serverless

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/serverless/loader"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/plugins/serverless/triggers"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// Config 定义 serverless 插件的配置选项
type Config struct {
	// MaxMemoryMB 单个实例最大内存限制（MB）
	// 默认: 128
	MaxMemoryMB int

	// TimeoutSeconds HTTP 请求超时时间（秒）
	// 默认: 30
	TimeoutSeconds int

	// CronTimeoutMinutes Cron 任务超时时间（分钟）
	// 默认: 15
	CronTimeoutMinutes int

	// PoolSize 预热实例池大小
	// 默认: 4
	PoolSize int

	// FunctionsDir Serverless 函数目录
	// 默认: "pb_serverless"
	FunctionsDir string

	// NetworkWhitelist 网络白名单（允许 fetch 的域名）
	// 空列表表示允许所有
	NetworkWhitelist []string

	// EnableBytecodeCache 启用字节码预编译缓存
	// 默认: true
	EnableBytecodeCache bool
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		MaxMemoryMB:         128,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            4,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil, // 允许所有
		EnableBytecodeCache: true,
	}
}

// Plugin 是 serverless 插件的主结构体
type Plugin struct {
	app         core.App
	config      Config
	pool        *runtime.Pool
	httpTrigger *triggers.HTTPTrigger
	loader      *loader.Loader
}

// NewPlugin 创建新的 serverless 插件实例
func NewPlugin(app core.App, config Config) *Plugin {
	// 应用默认值
	if config.PoolSize <= 0 {
		config.PoolSize = 4
	}
	if config.TimeoutSeconds <= 0 {
		config.TimeoutSeconds = 30
	}
	if config.FunctionsDir == "" {
		config.FunctionsDir = "pb_serverless"
	}
	if config.MaxMemoryMB <= 0 {
		config.MaxMemoryMB = 128
	}

	return &Plugin{
		app:    app,
		config: config,
	}
}

// MustRegister 注册 serverless 插件到 PocketBase 应用
// 如果注册失败会 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 serverless 插件到 PocketBase 应用
func Register(app core.App, config Config) error {
	p := NewPlugin(app, config)
	return p.register()
}

// register 内部注册逻辑
func (p *Plugin) register() error {
	// 检查 app 是否为 nil
	if p.app == nil {
		return nil
	}

	// 在服务启动时初始化
	p.app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			// 获取函数目录的绝对路径
			functionsDir := p.config.FunctionsDir
			if !filepath.IsAbs(functionsDir) {
				functionsDir = filepath.Join(p.app.DataDir(), "..", functionsDir)
			}

			// 检查目录是否存在
			if _, err := os.Stat(functionsDir); os.IsNotExist(err) {
				// 目录不存在，跳过 serverless 初始化
				p.app.Logger().Info("Serverless: 函数目录不存在，跳过初始化", "dir", functionsDir)
				return e.Next()
			}

			// 初始化加载器
			p.loader = loader.NewLoader(functionsDir)

			// 初始化运行时池
			var err error
			p.pool, err = runtime.NewPool(p.config.PoolSize)
			if err != nil {
				p.app.Logger().Error("Serverless: 初始化运行时池失败", "error", err)
				return e.Next()
			}

			// 初始化 HTTP 触发器
			p.httpTrigger = triggers.NewHTTPTrigger(p.pool, triggers.HTTPTriggerConfig{
				Timeout:     time.Duration(p.config.TimeoutSeconds) * time.Second,
				MaxBodySize: 10 * 1024 * 1024, // 10MB
			})

			// 扫描并注册路由
			modules, err := p.loader.ScanRoutes()
			if err != nil {
				p.app.Logger().Warn("Serverless: 扫描路由失败", "error", err)
			} else {
				for _, m := range modules {
					p.httpTrigger.RegisterRoute(m.Route, m.Path)
					p.app.Logger().Info("Serverless: 注册路由", "route", m.Route, "file", m.Name)
				}
			}

			// 注册 serverless API 路由
			p.registerRoutes(e)

			p.app.Logger().Info("Serverless: 初始化完成",
				"poolSize", p.config.PoolSize,
				"functionsDir", functionsDir,
				"routes", len(modules))

			return e.Next()
		},
		Priority: 10,
	})

	// 在应用终止时清理
	p.app.OnTerminate().Bind(&hook.Handler[*core.TerminateEvent]{
		Func: func(e *core.TerminateEvent) error {
			if p.pool != nil {
				p.pool.Close()
			}
			return e.Next()
		},
	})

	return nil
}

// registerRoutes 注册 HTTP 路由
func (p *Plugin) registerRoutes(e *core.ServeEvent) {
	// 健康检查端点
	e.Router.GET("/api/serverless/health", func(re *core.RequestEvent) error {
		stats := runtime.PoolStats{}
		if p.pool != nil {
			stats = p.pool.Stats()
		}

		return re.JSON(http.StatusOK, map[string]any{
			"status": "ok",
			"pool": map[string]any{
				"total":     stats.Total,
				"inUse":     stats.InUse,
				"available": stats.Available,
			},
		})
	})

	// 函数列表端点
	e.Router.GET("/api/serverless/functions", func(re *core.RequestEvent) error {
		if p.loader == nil {
			return re.JSON(http.StatusOK, map[string]any{
				"routes":  []any{},
				"hooks":   []any{},
				"workers": []any{},
			})
		}

		routes, _ := p.loader.ScanRoutes()
		hooks, _ := p.loader.ScanHooks()
		workers, _ := p.loader.ScanWorkers()

		routeList := make([]map[string]any, 0, len(routes))
		for _, m := range routes {
			routeList = append(routeList, map[string]any{
				"name":    m.Name,
				"route":   m.Route,
				"methods": m.ExportedMethods(),
			})
		}

		hookList := make([]map[string]any, 0, len(hooks))
		for _, m := range hooks {
			hookList = append(hookList, map[string]any{
				"name": m.Name,
			})
		}

		workerList := make([]map[string]any, 0, len(workers))
		for _, m := range workers {
			workerList = append(workerList, map[string]any{
				"name": m.Name,
			})
		}

		return re.JSON(http.StatusOK, map[string]any{
			"routes":  routeList,
			"hooks":   hookList,
			"workers": workerList,
		})
	})

	// 动态 serverless 路由处理函数
	serverlessHandler := func(re *core.RequestEvent) error {
		if p.httpTrigger == nil {
			return re.JSON(http.StatusServiceUnavailable, map[string]any{
				"error": "Serverless runtime not initialized",
			})
		}

		// 重建完整路径
		path := "/api/pb_serverless/" + re.Request.PathValue("path")

		// 匹配路由
		file, params, ok := p.httpTrigger.MatchRoute(path)
		if !ok {
			return re.JSON(http.StatusNotFound, map[string]any{
				"error": "Route not found",
				"path":  path,
			})
		}

		// 构建请求
		jsReq, err := p.httpTrigger.BuildJSRequest(re.Request)
		if err != nil {
			return re.JSON(http.StatusBadRequest, map[string]any{
				"error": "Failed to parse request",
			})
		}
		jsReq.Params = params

		// 读取函数代码
		code, err := os.ReadFile(file)
		if err != nil {
			return re.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("Failed to load function: %v", err),
			})
		}

		// 获取运行时实例
		ctx, cancel := p.httpTrigger.WithTimeout(re.Request.Context())
		defer cancel()

		engine, err := p.pool.Acquire(ctx)
		if err != nil {
			return re.JSON(http.StatusServiceUnavailable, map[string]any{
				"error": "No available runtime",
			})
		}
		defer p.pool.Release(engine)

		// 构建执行代码 - 支持 export default 和具名导出
		method := re.Request.Method
		execCode := fmt.Sprintf(`
			(async function() {
				// 模拟 Response 类
				class Response {
					constructor(body, init = {}) {
						this.body = body;
						this.status = init.status || 200;
						this.headers = init.headers || {};
					}
					static json(data, init = {}) {
						return new Response(JSON.stringify(data), {
							...init,
							headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
						});
					}
				}
				globalThis.Response = Response;
				
				// 加载用户代码
				const __userCode = (function() {
					let __exports = {};
					%s
					// 检查 export default
					if (typeof module !== 'undefined' && module.exports && module.exports.default) {
						return module.exports.default;
					}
					// 检查具名导出
					if (typeof %s === 'function') {
						return %s;
					}
					// 尝试全局 default
					if (typeof __exports.default === 'function') {
						return __exports.default;
					}
					return null;
				})();
				
				const request = %s;
				request.method = '%s';
				
				let handler = __userCode;
				if (!handler && typeof %s === 'function') {
					handler = %s;
				}
				
				if (typeof handler === 'function') {
					const result = await handler(request);
					if (result instanceof Response) {
						return JSON.stringify({
							status: result.status,
							headers: result.headers,
							body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
						});
					}
					return JSON.stringify(result || { status: 200, body: '' });
				}
				return JSON.stringify({ status: 405, body: 'Method not allowed' });
			})()
		`, string(code), method, method, jsReq.ToJSON(), method, method, method)

		// 执行代码
		cfg := runtime.DefaultRuntimeConfig()
		cfg.Timeout = time.Duration(p.config.TimeoutSeconds) * time.Second
		if p.config.MaxMemoryMB > 0 {
			cfg.MaxMemory = uint64(p.config.MaxMemoryMB) * 1024 * 1024
		}
		execResult, err := engine.Execute(ctx, execCode, cfg)
		if err != nil {
			return re.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("Execution error: %v", err),
			})
		}

		// 解析响应
		var jsResp triggers.JSResponse
		if err := json.Unmarshal([]byte(execResult.Value), &jsResp); err != nil {
			// 如果不是 JSON，直接返回结果
			return re.String(http.StatusOK, execResult.Value)
		}

		// 设置响应头
		for k, v := range jsResp.Headers {
			re.Response.Header().Set(k, v)
		}

		// 返回响应
		if jsResp.Status == 0 {
			jsResp.Status = http.StatusOK
		}

		return re.String(jsResp.Status, jsResp.Body)
	}

	// 为每个 HTTP 方法注册路由
	e.Router.GET("/api/pb_serverless/{path...}", serverlessHandler)
	e.Router.POST("/api/pb_serverless/{path...}", serverlessHandler)
	e.Router.PUT("/api/pb_serverless/{path...}", serverlessHandler)
	e.Router.PATCH("/api/pb_serverless/{path...}", serverlessHandler)
	e.Router.DELETE("/api/pb_serverless/{path...}", serverlessHandler)
}

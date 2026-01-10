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
	goruntime "runtime"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/serverless/loader"
	"github.com/pocketbase/pocketbase/plugins/serverless/metrics"
	"github.com/pocketbase/pocketbase/plugins/serverless/reliability"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/plugins/serverless/triggers"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// Config 定义 serverless 插件的配置选项
type Config struct {
	// MaxMemoryMB 单个实例最大内存限制（MB）
	// 默认: 根据系统内存自动配置
	// - 系统内存 < 512MB: 32MB
	// - 系统内存 < 1GB: 64MB
	// - 系统内存 < 2GB: 96MB
	// - 系统内存 >= 2GB: 128MB
	MaxMemoryMB int

	// TimeoutSeconds HTTP 请求超时时间（秒）
	// 默认: 30
	TimeoutSeconds int

	// CronTimeoutMinutes Cron 任务超时时间（分钟）
	// 默认: 15
	CronTimeoutMinutes int

	// PoolSize 预热实例池大小
	// 默认: 根据系统内存自动配置
	// - 系统内存 < 512MB: 1
	// - 系统内存 < 1GB: 2
	// - 系统内存 < 2GB: 3
	// - 系统内存 >= 2GB: 4
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

	// AutoConfig 是否启用自动配置
	// 默认: true（根据系统内存自动设置 PoolSize 和 MaxMemoryMB）
	AutoConfig bool

	// ===== 可靠性配置 =====

	// EnableCircuitBreaker 启用断路器
	// 默认: true
	EnableCircuitBreaker bool

	// CircuitBreakerConfig 断路器配置
	CircuitBreakerConfig reliability.CircuitBreakerConfig

	// EnableRetry 启用重试机制
	// 默认: true
	EnableRetry bool

	// RetryConfig 重试配置
	RetryConfig reliability.RetryConfig

	// ===== 指标配置 =====

	// EnableMetrics 启用指标收集
	// 默认: true
	EnableMetrics bool

	// ===== 动态池配置 =====

	// DynamicPoolConfig 动态池配置
	DynamicPoolConfig runtime.DynamicPoolConfig
}

// MemoryProfile 定义不同内存配置档位
type MemoryProfile struct {
	Name        string // 配置档位名称
	MinMemoryMB uint64 // 最小系统内存（MB）
	PoolSize    int    // 推荐池大小
	MaxMemoryMB int    // 推荐单实例内存限制（MB）
}

// 预定义的内存配置档位
var memoryProfiles = []MemoryProfile{
	{Name: "minimal", MinMemoryMB: 0, PoolSize: 1, MaxMemoryMB: 32},
	{Name: "low", MinMemoryMB: 512, PoolSize: 2, MaxMemoryMB: 64},
	{Name: "medium", MinMemoryMB: 1024, PoolSize: 3, MaxMemoryMB: 96},
	{Name: "standard", MinMemoryMB: 2048, PoolSize: 4, MaxMemoryMB: 128},
	{Name: "high", MinMemoryMB: 4096, PoolSize: 6, MaxMemoryMB: 128},
	{Name: "enterprise", MinMemoryMB: 8192, PoolSize: 8, MaxMemoryMB: 256},
}

// getSystemMemoryMB 获取系统总内存（MB）
func getSystemMemoryMB() uint64 {
	var m goruntime.MemStats
	goruntime.ReadMemStats(&m)
	// Sys 是从操作系统获取的总内存
	// 但这不是系统总内存，我们需要用其他方式
	// 使用 GOMAXPROCS 和经验值估算，或者直接读取系统信息

	// 尝试从环境变量获取（容器环境常用）
	if memLimit := os.Getenv("MEMORY_LIMIT_MB"); memLimit != "" {
		var mb uint64
		if _, err := fmt.Sscanf(memLimit, "%d", &mb); err == nil && mb > 0 {
			return mb
		}
	}

	// 使用 cgroup 限制（容器环境）
	if data, err := os.ReadFile("/sys/fs/cgroup/memory/memory.limit_in_bytes"); err == nil {
		var bytes uint64
		if _, err := fmt.Sscanf(string(data), "%d", &bytes); err == nil {
			// 如果限制值不是极大值（表示无限制）
			if bytes < 1<<62 {
				return bytes / (1024 * 1024)
			}
		}
	}

	// cgroup v2
	if data, err := os.ReadFile("/sys/fs/cgroup/memory.max"); err == nil {
		var bytes uint64
		if _, err := fmt.Sscanf(string(data), "%d", &bytes); err == nil {
			if bytes < 1<<62 {
				return bytes / (1024 * 1024)
			}
		}
	}

	// 默认假设 2GB（标准配置）
	return 2048
}

// GetMemoryProfile 根据系统内存获取推荐配置
func GetMemoryProfile() MemoryProfile {
	systemMemMB := getSystemMemoryMB()
	
	// 从高到低匹配配置档位
	var selected MemoryProfile
	for _, profile := range memoryProfiles {
		if systemMemMB >= profile.MinMemoryMB {
			selected = profile
		}
	}
	
	return selected
}

// DefaultConfig 返回默认配置（根据系统内存自动调整）
func DefaultConfig() Config {
	profile := GetMemoryProfile()
	
	return Config{
		MaxMemoryMB:          profile.MaxMemoryMB,
		TimeoutSeconds:       30,
		CronTimeoutMinutes:   15,
		PoolSize:             profile.PoolSize,
		FunctionsDir:         "pb_serverless",
		NetworkWhitelist:     nil, // 允许所有
		EnableBytecodeCache:  true,
		AutoConfig:           true,
		// 可靠性配置
		EnableCircuitBreaker: true,
		CircuitBreakerConfig: reliability.DefaultCircuitBreakerConfig(),
		EnableRetry:          true,
		RetryConfig:          reliability.DefaultRetryConfig(),
		// 指标配置
		EnableMetrics:        true,
		// 动态池配置
		DynamicPoolConfig:    runtime.DefaultDynamicPoolConfig(),
	}
}

// ConfigForMemory 根据指定内存大小返回推荐配置
// memoryMB: 可用内存大小（MB）
func ConfigForMemory(memoryMB uint64) Config {
	var selected MemoryProfile
	for _, profile := range memoryProfiles {
		if memoryMB >= profile.MinMemoryMB {
			selected = profile
		}
	}
	
	return Config{
		MaxMemoryMB:         selected.MaxMemoryMB,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            selected.PoolSize,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false, // 已手动指定
	}
}

// MinimalConfig 返回最小资源配置（适用于 <512MB 内存环境）
func MinimalConfig() Config {
	return Config{
		MaxMemoryMB:         32,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            1,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false,
	}
}

// LowMemoryConfig 返回低内存配置（适用于 512MB-1GB 内存环境）
func LowMemoryConfig() Config {
	return Config{
		MaxMemoryMB:         64,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            2,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false,
	}
}

// StandardConfig 返回标准配置（适用于 2GB+ 内存环境）
func StandardConfig() Config {
	return Config{
		MaxMemoryMB:         128,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            4,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false,
	}
}

// HighPerformanceConfig 返回高性能配置（适用于 4GB+ 内存环境）
func HighPerformanceConfig() Config {
	return Config{
		MaxMemoryMB:         128,
		TimeoutSeconds:      30,
		CronTimeoutMinutes:  15,
		PoolSize:            6,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false,
	}
}

// EnterpriseConfig 返回企业级配置（适用于 8GB+ 内存环境）
func EnterpriseConfig() Config {
	return Config{
		MaxMemoryMB:         256,
		TimeoutSeconds:      60,
		CronTimeoutMinutes:  30,
		PoolSize:            8,
		FunctionsDir:        "pb_serverless",
		NetworkWhitelist:    nil,
		EnableBytecodeCache: true,
		AutoConfig:          false,
	}
}

// Plugin 是 serverless 插件的主结构体
type Plugin struct {
	app              core.App
	config           Config
	pool             *runtime.Pool
	httpTrigger      *triggers.HTTPTrigger
	loader           *loader.Loader
	metricsCollector metrics.Collector
}

// NewPlugin 创建新的 serverless 插件实例
func NewPlugin(app core.App, config Config) *Plugin {
	// 如果启用自动配置且未手动设置值，则根据系统内存自动配置
	if config.AutoConfig || (config.PoolSize <= 0 && config.MaxMemoryMB <= 0) {
		profile := GetMemoryProfile()
		
		if config.PoolSize <= 0 {
			config.PoolSize = profile.PoolSize
		}
		if config.MaxMemoryMB <= 0 {
			config.MaxMemoryMB = profile.MaxMemoryMB
		}
	}
	
	// 应用默认值（兜底）
	if config.PoolSize <= 0 {
		config.PoolSize = 4
	}
	if config.TimeoutSeconds <= 0 {
		config.TimeoutSeconds = 30
	}
	if config.CronTimeoutMinutes <= 0 {
		config.CronTimeoutMinutes = 15
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

			// 初始化指标收集器
			if p.config.EnableMetrics {
				p.metricsCollector = metrics.NewCollector()
			}

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
				"maxMemoryMB", p.config.MaxMemoryMB,
				"functionsDir", functionsDir,
				"routes", len(modules),
				"profile", GetMemoryProfile().Name)

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

	// 指标端点
	e.Router.GET("/api/serverless/metrics", func(re *core.RequestEvent) error {
		if p.metricsCollector == nil {
			return re.JSON(http.StatusServiceUnavailable, map[string]any{
				"error": "Metrics collection is disabled",
			})
		}

		// 解析窗口参数
		windowStr := re.Request.URL.Query().Get("window")
		window := 5 * time.Minute
		if windowStr != "" {
			if d, err := time.ParseDuration(windowStr); err == nil {
				window = d
			}
		}

		// 获取统计数据
		stats := p.metricsCollector.GetStats()
		windowStats := p.metricsCollector.GetWindowStats(window)

		// 更新池统计
		if p.pool != nil {
			poolStats := p.pool.Stats()
			p.metricsCollector.UpdatePoolStats(metrics.PoolStats{
				Size:            poolStats.Total,
				Available:       poolStats.Available,
				InUse:           poolStats.InUse,
				WaitingRequests: 0,
				TotalCreated:    0,
				TotalDestroyed:  0,
			})
		}

		// 构建响应
		resp := map[string]any{
			"totalRequests": stats.TotalRequests,
			"successCount":  stats.SuccessRequests,
			"errorCount":    stats.ErrorRequests,
			"timeoutCount":  stats.TimeoutRequests,
			"rejectedCount": stats.RejectedRequests,
			"coldStarts":    stats.ColdStarts,
			"uptime":        time.Since(stats.StartTime).Seconds(),
			"latency": map[string]any{
				"min":     stats.LatencyHistogram.Min,
				"max":     stats.LatencyHistogram.Max,
				"avg":     calculateAvgLatency(stats.LatencyHistogram.Sum, stats.LatencyHistogram.Count),
				"buckets": stats.LatencyHistogram.Buckets,
				"counts":  stats.LatencyHistogram.Counts,
			},
			"pool": map[string]any{
				"size":            stats.PoolStats.Size,
				"available":       stats.PoolStats.Available,
				"inUse":           stats.PoolStats.InUse,
				"waitingRequests": stats.PoolStats.WaitingRequests,
				"totalCreated":    stats.PoolStats.TotalCreated,
				"totalDestroyed":  stats.PoolStats.TotalDestroyed,
			},
			"memory": map[string]any{
				"totalAllocated": stats.MemoryStats.TotalAllocated,
				"totalFreed":     stats.MemoryStats.TotalFreed,
				"currentUsage":   stats.MemoryStats.CurrentUsage,
				"peakUsage":      stats.MemoryStats.PeakUsage,
			},
			"window": map[string]any{
				"windowSize":  window.Seconds(),
				"requestRate": windowStats.RequestRate,
				"errorRate":   windowStats.ErrorRate,
				"avgLatency":  windowStats.AvgLatency,
				"p95Latency":  windowStats.P95Latency,
			},
			"byFunction": convertFunctionStats(stats.ByFunction),
			"byRuntime":  convertRuntimeStats(stats.ByRuntime),
		}

		return re.JSON(http.StatusOK, resp)
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

		// 转换 ES6 模块语法为 QuickJS 兼容格式
		method := re.Request.Method
		userCode := transpileES6ToQuickJS(string(code))

		// 构建执行代码
		execCode := fmt.Sprintf(`
(function() {
	// Response 类
	function Response(body, init) {
		init = init || {};
		this.body = body;
		this.status = init.status || 200;
		this.headers = init.headers || {};
	}
	Response.json = function(data, init) {
		init = init || {};
		var headers = init.headers || {};
		headers['Content-Type'] = 'application/json';
		return new Response(JSON.stringify(data), {
			status: init.status || 200,
			headers: headers
		});
	};

	// 用户代码模块
	var __exports = {};
	%s

	// 获取处理函数
	var handler = __exports['%s'] || __exports['default'];
	if (typeof handler !== 'function') {
		return JSON.stringify({ status: 405, body: 'Method not allowed' });
	}

	// 构建请求对象
	var request = %s;

	// 执行处理函数
	var result = handler(request);

	// 处理 Response 对象
	if (result instanceof Response) {
		return JSON.stringify({
			status: result.status,
			headers: result.headers,
			body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
		});
	}

	// 处理普通对象
	if (result && typeof result === 'object') {
		return JSON.stringify({
			status: result.status || 200,
			headers: result.headers || {},
			body: result.body || JSON.stringify(result)
		});
	}

	return JSON.stringify({ status: 200, body: String(result) });
})()
`, userCode, method, jsReq.ToJSON())

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

// transpileES6ToQuickJS 将 ES6/TypeScript 模块语法转换为 QuickJS 兼容格式
// 支持的转换:
//   - export function NAME(...) -> __exports['NAME'] = function(...)
//   - export default function(...) -> __exports['default'] = function(...)
//   - export const NAME = ... -> __exports['NAME'] = ...
//   - 移除 TypeScript 类型注解
func transpileES6ToQuickJS(code string) string {
	lines := strings.Split(code, "\n")
	result := make([]string, 0, len(lines))

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 跳过纯注释行
		if strings.HasPrefix(trimmed, "//") {
			result = append(result, line)
			continue
		}

		// 转换 export function NAME
		if strings.HasPrefix(trimmed, "export function ") {
			// export function GET(request: Request): Response {
			// -> __exports['GET'] = function(request) {
			rest := strings.TrimPrefix(trimmed, "export function ")
			// 提取函数名
			parenIdx := strings.Index(rest, "(")
			if parenIdx > 0 {
				funcName := rest[:parenIdx]
				// 移除类型注解
				params := extractParams(rest[parenIdx:])
				result = append(result, fmt.Sprintf("__exports['%s'] = function%s {", funcName, params))
				continue
			}
		}

		// 转换 export async function NAME
		if strings.HasPrefix(trimmed, "export async function ") {
			rest := strings.TrimPrefix(trimmed, "export async function ")
			parenIdx := strings.Index(rest, "(")
			if parenIdx > 0 {
				funcName := rest[:parenIdx]
				params := extractParams(rest[parenIdx:])
				result = append(result, fmt.Sprintf("__exports['%s'] = function%s {", funcName, params))
				continue
			}
		}

		// 转换 export default function
		if strings.HasPrefix(trimmed, "export default function") {
			rest := strings.TrimPrefix(trimmed, "export default function")
			params := extractParams(rest)
			result = append(result, fmt.Sprintf("__exports['default'] = function%s {", params))
			continue
		}

		// 转换 export const NAME = ...
		if strings.HasPrefix(trimmed, "export const ") {
			rest := strings.TrimPrefix(trimmed, "export const ")
			eqIdx := strings.Index(rest, "=")
			if eqIdx > 0 {
				varName := strings.TrimSpace(rest[:eqIdx])
				// 移除类型注解
				colonIdx := strings.Index(varName, ":")
				if colonIdx > 0 {
					varName = strings.TrimSpace(varName[:colonIdx])
				}
				value := strings.TrimSpace(rest[eqIdx+1:])
				result = append(result, fmt.Sprintf("__exports['%s'] = %s", varName, value))
				continue
			}
		}

		// 移除 TypeScript 类型注解（简单处理）
		line = removeTypeAnnotations(line)

		result = append(result, line)
	}

	return strings.Join(result, "\n")
}

// extractParams 提取函数参数，移除类型注解
// 输入: "(request: Request): Response {"
// 输出: "(request)"
func extractParams(s string) string {
	// 找到参数部分
	start := strings.Index(s, "(")
	end := strings.Index(s, ")")
	if start < 0 || end < 0 || end <= start {
		return "()"
	}

	paramsStr := s[start+1 : end]
	if paramsStr == "" {
		return "()"
	}

	// 分割参数
	params := strings.Split(paramsStr, ",")
	cleanParams := make([]string, 0, len(params))

	for _, p := range params {
		p = strings.TrimSpace(p)

		// 检查是否有默认值
		eqIdx := strings.Index(p, "=")
		var defaultValue string
		if eqIdx > 0 {
			defaultValue = strings.TrimSpace(p[eqIdx+1:])
			p = strings.TrimSpace(p[:eqIdx])
		}

		// 移除类型注解
		colonIdx := strings.Index(p, ":")
		if colonIdx > 0 {
			p = strings.TrimSpace(p[:colonIdx])
		}

		// 重新添加默认值
		if defaultValue != "" {
			p = p + " = " + defaultValue
		}

		if p != "" {
			cleanParams = append(cleanParams, p)
		}
	}

	return "(" + strings.Join(cleanParams, ", ") + ")"
}

// removeTypeAnnotations 移除行内的 TypeScript 类型注解
func removeTypeAnnotations(line string) string {
	// 移除变量声明中的类型注解: let x: number = 1 -> let x = 1
	// 简单处理，不处理复杂情况

	// 移除 as 类型断言
	if strings.Contains(line, " as ") {
		// 简单处理：移除 as TYPE 部分
		parts := strings.Split(line, " as ")
		if len(parts) >= 2 {
			// 保留第一部分，移除类型断言
			line = parts[0]
			// 如果后面还有代码，保留
			for i := 1; i < len(parts); i++ {
				// 找到类型结束的位置（通常是空格、分号、逗号等）
				rest := parts[i]
				for j, c := range rest {
					if c == ';' || c == ',' || c == ')' || c == '}' {
						line += rest[j:]
						break
					}
				}
			}
		}
	}

	return line
}

// calculateAvgLatency 计算平均延迟
func calculateAvgLatency(sum float64, count int64) float64 {
	if count == 0 {
		return 0
	}
	return sum / float64(count)
}

// convertFunctionStats 转换函数统计
func convertFunctionStats(stats map[string]*metrics.FunctionStats) map[string]any {
	result := make(map[string]any)
	for name, fs := range stats {
		result[name] = map[string]any{
			"totalRequests":   fs.TotalRequests,
			"successRequests": fs.SuccessRequests,
			"errorRequests":   fs.ErrorRequests,
			"avgLatency":      fs.AvgLatency,
			"p50Latency":      fs.P50Latency,
			"p95Latency":      fs.P95Latency,
			"p99Latency":      fs.P99Latency,
		}
	}
	return result
}

// convertRuntimeStats 转换运行时统计
func convertRuntimeStats(stats map[string]*metrics.RuntimeStats) map[string]any {
	result := make(map[string]any)
	for name, rs := range stats {
		result[name] = map[string]any{
			"totalRequests": rs.TotalRequests,
			"avgLatency":    rs.AvgLatency,
			"avgMemory":     rs.AvgMemory,
		}
	}
	return result
}

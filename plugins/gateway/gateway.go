// Package gateway 提供 API Gateway 插件功能
// 支持代理转发、协议归一化（ReverseProxy）、访问控制等特性
//
// 使用方式：
//
//	gateway.MustRegister(app, gateway.Config{})
//
// 核心特性：
// - 使用 httputil.ReverseProxy 统一代理本地 Sidecar 和外部 LLM
// - "暴力归一化" 策略解决 Body Size Mismatch 问题
// - 支持 SSE 流式响应
// - Hot Reload 支持
// - Gateway Hardening (020-gateway-hardening)
//   - HardenedTransport 精细化超时控制
//   - ConcurrencyLimiter 并发限制
//   - CircuitBreaker 熔断保护
//   - BytesPool 内存池优化
//   - MetricsCollector 可观测性
package gateway

import (
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// DefaultFlushInterval SSE 流式响应的默认刷新间隔
const DefaultFlushInterval = 100 * time.Millisecond

// Config 插件配置
type Config struct {
	// Disabled 禁用插件
	Disabled bool

	// EnableMetrics 启用 Prometheus 指标收集
	// T052: 初始化全局 MetricsCollector
	EnableMetrics bool

	// TransportConfig 自定义 Transport 配置（可选）
	// 默认使用 DefaultTransportConfig()
	TransportConfig *TransportConfig
}

// gatewayPlugin 插件实例
type gatewayPlugin struct {
	app     core.App
	config  Config
	manager *Manager
}

// MustRegister 注册 Gateway 插件（panic on error）
// 应在 app.Start() 之前调用
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 Gateway 插件
func Register(app core.App, config Config) error {
	if config.Disabled {
		return nil
	}

	p := &gatewayPlugin{
		app:    app,
		config: config,
	}

	return p.register()
}

// register 执行插件注册
// T052: 初始化全局 BytesPool 和 MetricsCollector
func (p *gatewayPlugin) register() error {
	// 1. 在 Bootstrap 完成后初始化 Manager 并加载代理
	// 注意：必须在 e.Next() 之后执行，此时数据库才已初始化
	p.app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		// 先执行核心 Bootstrap（数据库初始化等）
		if err := e.Next(); err != nil {
			return err
		}

		// T052: 构建 ManagerConfig
		managerConfig := ManagerConfig{
			// T035, T052: 使用全局 BytesPool
			BufferPool: DefaultBytesPool(),
		}

		// 配置 Transport
		if p.config.TransportConfig != nil {
			managerConfig.TransportConfig = *p.config.TransportConfig
		} else {
			managerConfig.TransportConfig = DefaultTransportConfig()
		}

		// T052: 启用 Metrics
		if p.config.EnableMetrics {
			managerConfig.Metrics = NewMetricsCollector()
		}

		// 创建 Manager
		p.manager = NewManagerWithConfig(p.app, managerConfig)

		// 加载代理配置
		if err := p.loadProxies(); err != nil {
			p.app.Logger().Warn("failed to load proxies", "error", err)
		}

		return nil
	})

	// 2. 注册 Hot Reload Hooks
	p.registerHooks()

	// 3. 注册路由
	p.app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		p.registerRoutes(e)
		return e.Next()
	})

	return nil
}

// loadProxies 从数据库加载代理配置
// 包含 Gateway Hardening 扩展字段
func (p *gatewayPlugin) loadProxies() error {
	if p.manager == nil {
		return nil
	}

	records, err := p.app.FindAllRecords(CollectionNameProxies)
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

		// T031: 加载 Gateway Hardening 扩展字段
		// maxConcurrent
		config.MaxConcurrent = record.GetInt(core.ProxyFieldMaxConcurrent)

		// circuitBreaker JSON
		var cbConfig CircuitBreakerConfig
		if err := record.UnmarshalJSONField(core.ProxyFieldCircuitBreaker, &cbConfig); err == nil {
			if cbConfig.Enabled {
				config.CircuitBreaker = &cbConfig
			}
		}

		// timeoutConfig JSON
		var tcConfig TimeoutConfig
		if err := record.UnmarshalJSONField(core.ProxyFieldTimeoutConfig, &tcConfig); err == nil {
			config.TimeoutConfig = &tcConfig
		}

		configs = append(configs, config)
	}

	p.manager.SetProxies(configs)
	return nil
}

// GetManager 获取 Manager 实例（用于外部访问）
func (p *gatewayPlugin) GetManager() *Manager {
	return p.manager
}

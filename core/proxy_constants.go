package core

// _proxies collection 名称和字段名常量
// 用于 Gateway Plugin 和系统迁移

const (
	// CollectionNameProxies 是代理配置 Collection 的名称
	CollectionNameProxies = "_proxies"

	// 代理配置字段名
	ProxyFieldPath       = "path"       // 拦截路径 (必填, 唯一)
	ProxyFieldUpstream   = "upstream"   // 目标服务地址 (必填)
	ProxyFieldStripPath  = "stripPath"  // 转发时是否移除匹配的前缀
	ProxyFieldAccessRule = "accessRule" // 访问控制规则
	ProxyFieldHeaders    = "headers"    // 注入的请求头配置 (JSON)
	ProxyFieldTimeout    = "timeout"    // 超时时间 (秒)
	ProxyFieldActive     = "active"     // 是否启用

	// Gateway Hardening 扩展字段 (020-gateway-hardening)
	ProxyFieldMaxConcurrent  = "maxConcurrent"  // 最大并发数 (FR-008)
	ProxyFieldCircuitBreaker = "circuitBreaker" // 熔断器配置 (FR-012)
	ProxyFieldTimeoutConfig  = "timeoutConfig"  // 精细超时配置
)

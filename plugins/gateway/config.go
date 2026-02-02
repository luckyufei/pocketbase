// Package gateway 提供 API Gateway 插件功能
// 支持代理转发、协议归一化、访问控制等特性
package gateway

import (
	"errors"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// 从 core 包导出常量（保持兼容性）
const (
	CollectionNameProxies = core.CollectionNameProxies
	ProxyFieldPath        = core.ProxyFieldPath
	ProxyFieldUpstream    = core.ProxyFieldUpstream
	ProxyFieldStripPath   = core.ProxyFieldStripPath
	ProxyFieldAccessRule  = core.ProxyFieldAccessRule
	ProxyFieldHeaders     = core.ProxyFieldHeaders
	ProxyFieldTimeout     = core.ProxyFieldTimeout
	ProxyFieldActive      = core.ProxyFieldActive
)

// DefaultTimeout 默认超时时间（秒）
const DefaultTimeout = 30

// ProxyConfig 代理配置（内存中的路由表项）
type ProxyConfig struct {
	ID         string            // 记录 ID
	Path       string            // 拦截路径（如 /-/openai）
	Upstream   string            // 上游服务地址（如 https://api.openai.com）
	StripPath  bool              // 是否移除匹配的前缀
	AccessRule string            // 访问控制规则
	Headers    map[string]string // 注入的请求头
	Timeout    int               // 超时时间（秒）
	Active     bool              // 是否启用

	// --- Gateway Hardening 扩展字段 (020-gateway-hardening) ---

	// MaxConcurrent 最大并发数
	// 0 或负数表示不限制
	// FR-008
	MaxConcurrent int `json:"max_concurrent"`

	// CircuitBreaker 熔断器配置
	// nil 表示不启用熔断
	// FR-012
	CircuitBreaker *CircuitBreakerConfig `json:"circuit_breaker"`

	// TimeoutConfig 精细超时配置
	// nil 表示使用默认值
	TimeoutConfig *TimeoutConfig `json:"timeout_config"`
}

// NewProxyConfig 创建一个带默认值的代理配置
func NewProxyConfig() *ProxyConfig {
	return &ProxyConfig{
		StripPath: true,
		Timeout:   DefaultTimeout,
		Active:    true,
		Headers:   make(map[string]string),
	}
}

// ValidateProxyPath 验证代理路径是否合法
// 禁止以 /api/ 或 /_/ 开头的路径，以保护核心 API 和 Admin UI
func ValidateProxyPath(path string) error {
	if path == "" {
		return errors.New("path cannot be empty")
	}

	if !strings.HasPrefix(path, "/") {
		return errors.New("path must start with /")
	}

	if path == "/" {
		return errors.New("path cannot be root /")
	}

	if strings.HasPrefix(path, "/api/") || path == "/api" {
		return errors.New("path cannot start with /api/ (reserved for data API)")
	}

	if strings.HasPrefix(path, "/_/") || path == "/_" {
		return errors.New("path cannot start with /_/ (reserved for admin UI)")
	}

	return nil
}

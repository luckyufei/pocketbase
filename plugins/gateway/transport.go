// Package gateway 提供 API Gateway 插件功能
package gateway

import (
	"net"
	"net/http"
	"time"
)

// TransportConfig 定义 HTTP Transport 的配置参数
// 所有时间字段单位为秒，便于 JSON 配置
type TransportConfig struct {
	// DialTimeout 建连超时（秒），默认 2
	// 内网环境下建连应该极快，2 秒足够
	// FR-001
	DialTimeout int `json:"dial_timeout"`

	// DialKeepAlive TCP KeepAlive 间隔（秒），默认 30
	DialKeepAlive int `json:"dial_keep_alive"`

	// ResponseHeaderTimeout 首字节超时（秒），默认 30
	// 对于 AI 场景，设为 0 表示不限制
	// FR-002, FR-004
	ResponseHeaderTimeout int `json:"response_header_timeout"`

	// IdleConnTimeout 空闲连接超时（秒），默认 90
	// FR-003
	IdleConnTimeout int `json:"idle_conn_timeout"`

	// MaxIdleConns 总连接池大小，默认 1000
	// FR-005
	MaxIdleConns int `json:"max_idle_conns"`

	// MaxIdleConnsPerHost 单上游连接池大小，默认 100
	// 这是关键配置，Go 默认只有 2
	// FR-006
	MaxIdleConnsPerHost int `json:"max_idle_conns_per_host"`

	// TLSHandshakeTimeout TLS 握手超时（秒），默认 5
	TLSHandshakeTimeout int `json:"tls_handshake_timeout"`

	// ExpectContinueTimeout Expect: 100-continue 超时（秒），默认 1
	// T010a
	ExpectContinueTimeout int `json:"expect_continue_timeout"`
}

// TimeoutConfig 是用户可配置的超时设置子集
// 用于 ProxyConfig 中的 timeout_config 字段
// T011
type TimeoutConfig struct {
	// Dial 建连超时（秒），默认 2
	Dial int `json:"dial"`

	// ResponseHeader 首字节超时（秒），默认 30，0=不限制
	ResponseHeader int `json:"response_header"`

	// Idle 空闲超时（秒），默认 90
	Idle int `json:"idle"`
}

// DefaultTransportConfig 返回带默认值的 TransportConfig
// 默认值基于 spec.md 的要求设计
func DefaultTransportConfig() TransportConfig {
	return TransportConfig{
		DialTimeout:           2,    // FR-001: 内网快速建连
		DialKeepAlive:         30,   // TCP KeepAlive
		ResponseHeaderTimeout: 30,   // FR-002: 默认 30 秒
		IdleConnTimeout:       90,   // FR-003: 空闲回收
		MaxIdleConns:          1000, // FR-005: 总连接池
		MaxIdleConnsPerHost:   100,  // FR-006: 单上游连接池（关键！）
		TLSHandshakeTimeout:   5,    // TLS 握手
		ExpectContinueTimeout: 1,    // T010a: 100-continue
	}
}

// DefaultTimeoutConfig 返回带默认值的 TimeoutConfig
func DefaultTimeoutConfig() TimeoutConfig {
	return TimeoutConfig{
		Dial:           2,
		ResponseHeader: 30,
		Idle:           90,
	}
}

// ToTransportConfig 将 TimeoutConfig 转换为完整的 TransportConfig
// 非超时配置使用默认值
func (tc TimeoutConfig) ToTransportConfig() TransportConfig {
	config := DefaultTransportConfig()
	config.DialTimeout = tc.Dial
	config.ResponseHeaderTimeout = tc.ResponseHeader
	config.IdleConnTimeout = tc.Idle
	return config
}

// NewHardenedTransport 创建生产级 HTTP Transport
// 相比默认配置，提供：
// - 精细化超时控制（防止 Goroutine 堆积）
// - 优化的连接池（提高复用率）
// - HTTP/2 支持
// - 系统代理支持
//
// 参考：Nginx 的连接管理策略
func NewHardenedTransport(config TransportConfig) *http.Transport {
	// 处理无效配置
	if config.DialTimeout < 0 {
		config.DialTimeout = 0
	}
	if config.DialKeepAlive < 0 {
		config.DialKeepAlive = 0
	}
	if config.MaxIdleConns <= 0 {
		config.MaxIdleConns = DefaultTransportConfig().MaxIdleConns
	}
	if config.MaxIdleConnsPerHost <= 0 {
		config.MaxIdleConnsPerHost = DefaultTransportConfig().MaxIdleConnsPerHost
	}
	if config.IdleConnTimeout < 0 {
		config.IdleConnTimeout = 0
	}
	if config.TLSHandshakeTimeout < 0 {
		config.TLSHandshakeTimeout = 0
	}
	if config.ExpectContinueTimeout < 0 {
		config.ExpectContinueTimeout = 0
	}

	// 构建 Transport
	transport := &http.Transport{
		// T010b: 支持系统代理
		Proxy: http.ProxyFromEnvironment,

		// FR-001, FR-003: 建连超时和 KeepAlive
		DialContext: (&net.Dialer{
			Timeout:   time.Duration(config.DialTimeout) * time.Second,
			KeepAlive: time.Duration(config.DialKeepAlive) * time.Second,
		}).DialContext,

		// FR-007: HTTP/2 优化
		ForceAttemptHTTP2: true,

		// FR-005, FR-006: 连接池配置（关键！）
		MaxIdleConns:        config.MaxIdleConns,
		MaxIdleConnsPerHost: config.MaxIdleConnsPerHost,

		// FR-003: 空闲连接超时
		IdleConnTimeout: time.Duration(config.IdleConnTimeout) * time.Second,

		// TLS 握手超时
		TLSHandshakeTimeout: time.Duration(config.TLSHandshakeTimeout) * time.Second,

		// T010a: Expect: 100-continue 超时
		ExpectContinueTimeout: time.Duration(config.ExpectContinueTimeout) * time.Second,
	}

	// FR-002, FR-004: 首字节超时
	// 0 表示不限制（AI 场景）
	if config.ResponseHeaderTimeout > 0 {
		transport.ResponseHeaderTimeout = time.Duration(config.ResponseHeaderTimeout) * time.Second
	}

	return transport
}

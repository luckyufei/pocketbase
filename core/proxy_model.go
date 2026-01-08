package core

import (
	"errors"
	"strings"
)

// CollectionNameProxies 是 _proxies 系统 Collection 的名称常量
const CollectionNameProxies = "_proxies"

// Proxy 字段名常量
const (
	ProxyFieldPath       = "path"
	ProxyFieldUpstream   = "upstream"
	ProxyFieldStripPath  = "stripPath"
	ProxyFieldAccessRule = "accessRule"
	ProxyFieldHeaders    = "headers"
	ProxyFieldTimeout    = "timeout"
	ProxyFieldActive     = "active"
)

// Proxy 代理配置模型
// 实现 RecordProxy 接口，用于将 API 请求代理到上游服务
type Proxy struct {
	*Record
}

// NewProxy 创建一个新的 Proxy 实例
func NewProxy(app App) *Proxy {
	m := &Proxy{}

	c, err := app.FindCachedCollectionByNameOrId(CollectionNameProxies)
	if err != nil {
		// 如果 collection 不存在，创建一个占位 collection
		c = NewBaseCollection("__proxy_placeholder__")
	}

	m.Record = NewRecord(c)

	// 设置默认值
	m.SetStripPath(true)
	m.SetTimeout(30)
	m.SetActive(true)

	return m
}

// ProxyRecord 实现 RecordProxy 接口
func (m *Proxy) ProxyRecord() *Record {
	return m.Record
}

// SetProxyRecord 实现 RecordProxy 接口
func (m *Proxy) SetProxyRecord(record *Record) {
	m.Record = record
}

// TableName 返回表名
func (m *Proxy) TableName() string {
	return CollectionNameProxies
}

// -------------------------------------------------------------------
// Getters
// -------------------------------------------------------------------

// Path 返回代理拦截路径
func (m *Proxy) Path() string {
	return m.GetString(ProxyFieldPath)
}

// Upstream 返回目标服务地址
func (m *Proxy) Upstream() string {
	return m.GetString(ProxyFieldUpstream)
}

// StripPath 返回是否移除匹配的前缀
func (m *Proxy) StripPath() bool {
	return m.GetBool(ProxyFieldStripPath)
}

// AccessRule 返回访问控制规则
func (m *Proxy) AccessRule() string {
	return m.GetString(ProxyFieldAccessRule)
}

// Headers 返回注入的请求头配置
func (m *Proxy) Headers() map[string]string {
	result := make(map[string]string)
	m.UnmarshalJSONField(ProxyFieldHeaders, &result)
	return result
}

// Timeout 返回超时时间（秒）
func (m *Proxy) Timeout() int {
	return m.GetInt(ProxyFieldTimeout)
}

// Active 返回是否启用
func (m *Proxy) Active() bool {
	return m.GetBool(ProxyFieldActive)
}

// -------------------------------------------------------------------
// Setters
// -------------------------------------------------------------------

// SetPath 设置代理拦截路径
func (m *Proxy) SetPath(path string) {
	m.Set(ProxyFieldPath, path)
}

// SetUpstream 设置目标服务地址
func (m *Proxy) SetUpstream(upstream string) {
	m.Set(ProxyFieldUpstream, upstream)
}

// SetStripPath 设置是否移除匹配的前缀
func (m *Proxy) SetStripPath(stripPath bool) {
	m.Set(ProxyFieldStripPath, stripPath)
}

// SetAccessRule 设置访问控制规则
func (m *Proxy) SetAccessRule(rule string) {
	m.Set(ProxyFieldAccessRule, rule)
}

// SetHeaders 设置注入的请求头配置
func (m *Proxy) SetHeaders(headers map[string]string) {
	m.Set(ProxyFieldHeaders, headers)
}

// SetTimeout 设置超时时间（秒）
func (m *Proxy) SetTimeout(timeout int) {
	m.Set(ProxyFieldTimeout, timeout)
}

// SetActive 设置是否启用
func (m *Proxy) SetActive(active bool) {
	m.Set(ProxyFieldActive, active)
}

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------

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

// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"errors"
	"net/url"
	"strings"
	"sync"
)

// NetworkWhitelist 网络白名单
type NetworkWhitelist struct {
	domains  map[string]bool
	patterns []string // 通配符模式
	allowAll bool
	mu       sync.RWMutex
}

// NewNetworkWhitelist 创建网络白名单
func NewNetworkWhitelist() *NetworkWhitelist {
	return &NetworkWhitelist{
		domains:  make(map[string]bool),
		patterns: make([]string, 0),
	}
}

// AddDomain 添加域名到白名单
func (wl *NetworkWhitelist) AddDomain(domain string) {
	wl.mu.Lock()
	defer wl.mu.Unlock()

	if strings.HasPrefix(domain, "*.") {
		wl.patterns = append(wl.patterns, domain)
	} else if domain == "*" {
		wl.allowAll = true
	} else {
		wl.domains[domain] = true
	}
}

// RemoveDomain 从白名单移除域名
func (wl *NetworkWhitelist) RemoveDomain(domain string) {
	wl.mu.Lock()
	defer wl.mu.Unlock()

	if strings.HasPrefix(domain, "*.") {
		// 移除通配符模式
		newPatterns := make([]string, 0, len(wl.patterns))
		for _, p := range wl.patterns {
			if p != domain {
				newPatterns = append(newPatterns, p)
			}
		}
		wl.patterns = newPatterns
	} else if domain == "*" {
		wl.allowAll = false
	} else {
		delete(wl.domains, domain)
	}
}

// IsAllowed 检查域名是否在白名单中
func (wl *NetworkWhitelist) IsAllowed(host string) bool {
	// localhost 和 127.0.0.1 始终允许
	if host == "localhost" || host == "127.0.0.1" || strings.HasPrefix(host, "192.168.") {
		return true
	}

	wl.mu.RLock()
	defer wl.mu.RUnlock()

	// 全通配符
	if wl.allowAll {
		return true
	}

	// 精确匹配
	if wl.domains[host] {
		return true
	}

	// 通配符匹配
	for _, pattern := range wl.patterns {
		if matchWildcard(pattern, host) {
			return true
		}
	}

	return false
}

// matchWildcard 匹配通配符模式
func matchWildcard(pattern, host string) bool {
	if !strings.HasPrefix(pattern, "*.") {
		return false
	}

	suffix := pattern[1:] // 移除 *，保留 .domain.com
	return strings.HasSuffix(host, suffix)
}

// AllowAll 允许所有域名
func (wl *NetworkWhitelist) AllowAll() {
	wl.mu.Lock()
	defer wl.mu.Unlock()
	wl.allowAll = true
}

// DenyAll 拒绝所有域名（localhost 除外）
func (wl *NetworkWhitelist) DenyAll() {
	wl.mu.Lock()
	defer wl.mu.Unlock()
	wl.allowAll = false
	wl.domains = make(map[string]bool)
	wl.patterns = make([]string, 0)
}

// GetDomains 获取所有白名单域名
func (wl *NetworkWhitelist) GetDomains() []string {
	wl.mu.RLock()
	defer wl.mu.RUnlock()

	result := make([]string, 0, len(wl.domains)+len(wl.patterns))
	for domain := range wl.domains {
		result = append(result, domain)
	}
	result = append(result, wl.patterns...)
	return result
}

// ValidateURL 验证 URL 是否允许访问
func (wl *NetworkWhitelist) ValidateURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return errors.New("invalid URL")
	}

	// 只允许 HTTP 和 HTTPS
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("unsupported protocol: " + parsed.Scheme)
	}

	host := parsed.Hostname()
	if !wl.IsAllowed(host) {
		return errors.New("host not in whitelist: " + host)
	}

	return nil
}

// DefaultWhitelist 返回默认白名单
func DefaultWhitelist() *NetworkWhitelist {
	wl := NewNetworkWhitelist()

	// 常用 AI API
	wl.AddDomain("api.openai.com")
	wl.AddDomain("api.anthropic.com")
	wl.AddDomain("generativelanguage.googleapis.com")
	wl.AddDomain("api.groq.com")
	wl.AddDomain("api.mistral.ai")
	wl.AddDomain("api.cohere.ai")

	// 云服务
	wl.AddDomain("*.amazonaws.com")
	wl.AddDomain("*.googleapis.com")
	wl.AddDomain("*.azure.com")

	// 常用服务
	wl.AddDomain("api.github.com")
	wl.AddDomain("api.stripe.com")
	wl.AddDomain("api.sendgrid.com")
	wl.AddDomain("api.twilio.com")

	return wl
}

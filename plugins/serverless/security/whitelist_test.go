// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"testing"
)

func TestNetworkWhitelist_New(t *testing.T) {
	wl := NewNetworkWhitelist()
	if wl == nil {
		t.Fatal("NewNetworkWhitelist() returned nil")
	}
}

func TestNetworkWhitelist_AddDomain(t *testing.T) {
	wl := NewNetworkWhitelist()

	wl.AddDomain("api.openai.com")
	wl.AddDomain("*.googleapis.com")

	if !wl.IsAllowed("api.openai.com") {
		t.Error("IsAllowed() should return true for added domain")
	}

	if !wl.IsAllowed("storage.googleapis.com") {
		t.Error("IsAllowed() should return true for wildcard match")
	}
}

func TestNetworkWhitelist_RemoveDomain(t *testing.T) {
	wl := NewNetworkWhitelist()

	wl.AddDomain("api.openai.com")
	wl.RemoveDomain("api.openai.com")

	if wl.IsAllowed("api.openai.com") {
		t.Error("IsAllowed() should return false for removed domain")
	}
}

func TestNetworkWhitelist_IsAllowed(t *testing.T) {
	tests := []struct {
		name     string
		domains  []string
		host     string
		expected bool
	}{
		{
			name:     "精确匹配",
			domains:  []string{"api.openai.com"},
			host:     "api.openai.com",
			expected: true,
		},
		{
			name:     "不匹配",
			domains:  []string{"api.openai.com"},
			host:     "api.anthropic.com",
			expected: false,
		},
		{
			name:     "通配符匹配",
			domains:  []string{"*.openai.com"},
			host:     "api.openai.com",
			expected: true,
		},
		{
			name:     "通配符不匹配",
			domains:  []string{"*.openai.com"},
			host:     "openai.com",
			expected: false,
		},
		{
			name:     "多级通配符",
			domains:  []string{"*.googleapis.com"},
			host:     "storage.googleapis.com",
			expected: true,
		},
		{
			name:     "localhost 始终允许",
			domains:  []string{},
			host:     "localhost",
			expected: true,
		},
		{
			name:     "127.0.0.1 始终允许",
			domains:  []string{},
			host:     "127.0.0.1",
			expected: true,
		},
		{
			name:     "空白名单拒绝外部",
			domains:  []string{},
			host:     "api.openai.com",
			expected: false,
		},
		{
			name:     "全通配符",
			domains:  []string{"*"},
			host:     "any.domain.com",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wl := NewNetworkWhitelist()
			for _, d := range tt.domains {
				wl.AddDomain(d)
			}

			if got := wl.IsAllowed(tt.host); got != tt.expected {
				t.Errorf("IsAllowed(%q) = %v, want %v", tt.host, got, tt.expected)
			}
		})
	}
}

func TestNetworkWhitelist_AllowAll(t *testing.T) {
	wl := NewNetworkWhitelist()
	wl.AllowAll()

	if !wl.IsAllowed("any.domain.com") {
		t.Error("IsAllowed() should return true after AllowAll()")
	}
}

func TestNetworkWhitelist_DenyAll(t *testing.T) {
	wl := NewNetworkWhitelist()
	wl.AddDomain("api.openai.com")
	wl.DenyAll()

	// localhost 仍然允许
	if !wl.IsAllowed("localhost") {
		t.Error("IsAllowed(localhost) should still be true after DenyAll()")
	}

	// 其他域名被拒绝
	if wl.IsAllowed("api.openai.com") {
		t.Error("IsAllowed() should return false after DenyAll()")
	}
}

func TestNetworkWhitelist_GetDomains(t *testing.T) {
	wl := NewNetworkWhitelist()
	wl.AddDomain("api.openai.com")
	wl.AddDomain("api.anthropic.com")

	domains := wl.GetDomains()
	if len(domains) != 2 {
		t.Errorf("GetDomains() returned %d domains, want 2", len(domains))
	}
}

func TestNetworkWhitelist_ValidateURL(t *testing.T) {
	wl := NewNetworkWhitelist()
	wl.AddDomain("api.openai.com")

	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{
			name:    "有效 HTTPS URL",
			url:     "https://api.openai.com/v1/chat",
			wantErr: false,
		},
		{
			name:    "有效 HTTP URL",
			url:     "http://api.openai.com/v1/chat",
			wantErr: false,
		},
		{
			name:    "不在白名单",
			url:     "https://api.anthropic.com/v1/chat",
			wantErr: true,
		},
		{
			name:    "无效 URL",
			url:     "not-a-url",
			wantErr: true,
		},
		{
			name:    "不支持的协议",
			url:     "ftp://api.openai.com/file",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := wl.ValidateURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateURL(%q) error = %v, wantErr %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestDefaultWhitelist(t *testing.T) {
	wl := DefaultWhitelist()

	// 默认白名单应包含常用 API
	expectedDomains := []string{
		"api.openai.com",
		"api.anthropic.com",
	}

	for _, domain := range expectedDomains {
		if !wl.IsAllowed(domain) {
			t.Errorf("DefaultWhitelist() should allow %s", domain)
		}
	}
}

package gateway

import (
	"testing"
)

// TestValidateProxyPath 测试路径验证
func TestValidateProxyPath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"empty path", "", true},
		{"root path", "/", true},
		{"no leading slash", "test", true},
		{"api prefix", "/api/test", true},
		{"api only", "/api", true},
		{"admin prefix", "/_/test", true},
		{"admin only", "/_", true},
		{"valid path", "/proxy/test", false},
		{"gateway prefix", "/-/openai", false},
		{"simple path", "/test", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateProxyPath(tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateProxyPath(%q) error = %v, wantErr %v", tt.path, err, tt.wantErr)
			}
		})
	}
}

// TestProxyConfigDefaults 测试代理配置默认值
func TestProxyConfigDefaults(t *testing.T) {
	cfg := NewProxyConfig()

	if cfg.Timeout != DefaultTimeout {
		t.Errorf("default Timeout = %d, want %d", cfg.Timeout, DefaultTimeout)
	}
	if !cfg.Active {
		t.Error("default Active = false, want true")
	}
	if !cfg.StripPath {
		t.Error("default StripPath = false, want true")
	}
}

// TestProxyConfigFields 测试代理配置字段常量
func TestProxyConfigFields(t *testing.T) {
	// 验证常量定义
	if ProxyFieldPath != "path" {
		t.Errorf("ProxyFieldPath = %q, want %q", ProxyFieldPath, "path")
	}
	if ProxyFieldUpstream != "upstream" {
		t.Errorf("ProxyFieldUpstream = %q, want %q", ProxyFieldUpstream, "upstream")
	}
	if ProxyFieldStripPath != "stripPath" {
		t.Errorf("ProxyFieldStripPath = %q, want %q", ProxyFieldStripPath, "stripPath")
	}
	if ProxyFieldAccessRule != "accessRule" {
		t.Errorf("ProxyFieldAccessRule = %q, want %q", ProxyFieldAccessRule, "accessRule")
	}
	if ProxyFieldHeaders != "headers" {
		t.Errorf("ProxyFieldHeaders = %q, want %q", ProxyFieldHeaders, "headers")
	}
	if ProxyFieldTimeout != "timeout" {
		t.Errorf("ProxyFieldTimeout = %q, want %q", ProxyFieldTimeout, "timeout")
	}
	if ProxyFieldActive != "active" {
		t.Errorf("ProxyFieldActive = %q, want %q", ProxyFieldActive, "active")
	}
}

// TestCollectionNameProxies 测试 Collection 名称常量
func TestCollectionNameProxies(t *testing.T) {
	if CollectionNameProxies != "_proxies" {
		t.Errorf("CollectionNameProxies = %q, want %q", CollectionNameProxies, "_proxies")
	}
}

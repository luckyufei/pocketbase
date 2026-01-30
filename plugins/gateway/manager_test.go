package gateway

import (
	"testing"
)

// TestManagerMatchProxy 测试路径匹配
func TestManagerMatchProxy(t *testing.T) {
	m := NewManager(nil)

	// 设置代理配置
	proxies := []*ProxyConfig{
		{ID: "1", Path: "/-/openai", Upstream: "https://api.openai.com", Active: true},
		{ID: "2", Path: "/-/openai/v1", Upstream: "https://api.openai.com/v1", Active: true},
		{ID: "3", Path: "/-/local", Upstream: "http://127.0.0.1:8001", Active: true},
		{ID: "4", Path: "/-/disabled", Upstream: "http://disabled.com", Active: false},
	}
	m.SetProxies(proxies)

	tests := []struct {
		name       string
		path       string
		wantMatch  bool
		wantID     string
	}{
		{"exact match", "/-/openai", true, "1"},
		{"longer prefix match", "/-/openai/v1/chat", true, "2"},
		{"with suffix", "/-/openai/chat", true, "1"},
		{"local match", "/-/local/api", true, "3"},
		{"no match", "/api/test", false, ""},
		{"disabled not match", "/-/disabled", false, ""},
		{"partial no match", "/-/openaiextra", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			proxy := m.MatchProxy(tt.path)
			if tt.wantMatch {
				if proxy == nil {
					t.Errorf("MatchProxy(%q) = nil, want match", tt.path)
				} else if proxy.ID != tt.wantID {
					t.Errorf("MatchProxy(%q).ID = %q, want %q", tt.path, proxy.ID, tt.wantID)
				}
			} else {
				if proxy != nil {
					t.Errorf("MatchProxy(%q) = %+v, want nil", tt.path, proxy)
				}
			}
		})
	}
}

// TestManagerBuildUpstreamURL 测试上游 URL 构建
func TestManagerBuildUpstreamURL(t *testing.T) {
	m := NewManager(nil)

	tests := []struct {
		name        string
		proxy       *ProxyConfig
		requestPath string
		want        string
	}{
		{
			"strip path",
			&ProxyConfig{Path: "/-/openai", Upstream: "https://api.openai.com", StripPath: true},
			"/-/openai/v1/chat",
			"https://api.openai.com/v1/chat",
		},
		{
			"no strip path",
			&ProxyConfig{Path: "/-/local", Upstream: "http://127.0.0.1:8001", StripPath: false},
			"/-/local/api",
			"http://127.0.0.1:8001/-/local/api",
		},
		{
			"with query string",
			&ProxyConfig{Path: "/-/openai", Upstream: "https://api.openai.com", StripPath: true},
			"/-/openai/v1/chat?model=gpt-4",
			"https://api.openai.com/v1/chat?model=gpt-4",
		},
		{
			"exact path strip",
			&ProxyConfig{Path: "/-/openai", Upstream: "https://api.openai.com", StripPath: true},
			"/-/openai",
			"https://api.openai.com",
		},
		{
			"upstream with trailing slash",
			&ProxyConfig{Path: "/-/test", Upstream: "http://test.com/", StripPath: true},
			"/-/test/api",
			"http://test.com/api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := m.BuildUpstreamURL(tt.proxy, tt.requestPath)
			if got != tt.want {
				t.Errorf("BuildUpstreamURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestManagerSetProxies 测试设置代理配置
func TestManagerSetProxies(t *testing.T) {
	m := NewManager(nil)

	proxies := []*ProxyConfig{
		{ID: "1", Path: "/short", Active: true},
		{ID: "2", Path: "/medium/path", Active: true},
		{ID: "3", Path: "/longest/path/here", Active: true},
		{ID: "4", Path: "/inactive", Active: false},
	}

	m.SetProxies(proxies)

	// 验证按长度排序（最长优先）
	// 且不包含 inactive 的配置
	if m.MatchProxy("/longest/path/here/test") == nil {
		t.Error("expected longest path to match")
	}
	if m.MatchProxy("/inactive") != nil {
		t.Error("inactive proxy should not match")
	}
}

// TestManagerConcurrentAccess 测试并发访问安全性
func TestManagerConcurrentAccess(t *testing.T) {
	m := NewManager(nil)
	proxies := []*ProxyConfig{
		{ID: "1", Path: "/-/test", Upstream: "http://test.com", Active: true},
	}
	m.SetProxies(proxies)

	done := make(chan bool)

	// 并发读取
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				m.MatchProxy("/-/test/api")
			}
			done <- true
		}()
	}

	// 并发写入
	go func() {
		for j := 0; j < 100; j++ {
			m.SetProxies(proxies)
		}
		done <- true
	}()

	// 等待所有 goroutine 完成
	for i := 0; i < 11; i++ {
		<-done
	}
}

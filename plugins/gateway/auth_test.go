package gateway

import (
	"testing"
)

// TestEvaluateAccessRule 测试访问规则评估
func TestEvaluateAccessRule(t *testing.T) {
	tests := []struct {
		name        string
		rule        string
		isSuperuser bool
		hasAuth     bool
		authID      string
		want        bool
	}{
		// 空规则 = 仅 Superuser
		{"empty rule superuser", "", true, false, "", true},
		{"empty rule normal", "", false, false, "", false},

		// "true" = 公开访问
		{"true rule", "true", false, false, "", true},

		// "false" = 禁止访问
		{"false rule", "false", true, true, "123", false},

		// @request.auth.id != '' = 需要登录
		{"auth required with auth", "@request.auth.id != ''", false, true, "user123", true},
		{"auth required no auth", "@request.auth.id != ''", false, false, "", false},
		{"auth required empty id", "@request.auth.id != ''", false, true, "", false},

		// @request.auth.id = '' = 必须未登录
		{"no auth required", "@request.auth.id = ''", false, false, "", true},
		{"no auth but has auth", "@request.auth.id = ''", false, true, "user123", false},

		// 复杂规则（保守策略：有认证则允许）
		{"complex rule with auth", "@request.auth.role = 'admin'", false, true, "user123", true},
		{"complex rule no auth", "@request.auth.role = 'admin'", false, false, "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建模拟的认证信息
			var authInfo *AuthInfo
			if tt.hasAuth {
				authInfo = &AuthInfo{ID: tt.authID}
			}

			got := EvaluateAccessRule(tt.rule, tt.isSuperuser, authInfo)
			if got != tt.want {
				t.Errorf("EvaluateAccessRule(%q, superuser=%v, auth=%v) = %v, want %v",
					tt.rule, tt.isSuperuser, authInfo, got, tt.want)
			}
		})
	}
}

// TestCheckProxyAccess 测试代理访问检查
func TestCheckProxyAccess(t *testing.T) {
	tests := []struct {
		name        string
		proxy       *ProxyConfig
		isSuperuser bool
		authInfo    *AuthInfo
		want        bool
	}{
		{
			"public access",
			&ProxyConfig{AccessRule: "true"},
			false, nil, true,
		},
		{
			"superuser only - superuser",
			&ProxyConfig{AccessRule: ""},
			true, nil, true,
		},
		{
			"superuser only - normal",
			&ProxyConfig{AccessRule: ""},
			false, &AuthInfo{ID: "user123"}, false,
		},
		{
			"auth required - authenticated",
			&ProxyConfig{AccessRule: "@request.auth.id != ''"},
			false, &AuthInfo{ID: "user123"}, true,
		},
		{
			"auth required - anonymous",
			&ProxyConfig{AccessRule: "@request.auth.id != ''"},
			false, nil, false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CheckProxyAccess(tt.proxy, tt.isSuperuser, tt.authInfo)
			if got != tt.want {
				t.Errorf("CheckProxyAccess() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestAuthInfo 测试 AuthInfo 结构体
func TestAuthInfo(t *testing.T) {
	// 测试空 AuthInfo
	var nilAuth *AuthInfo
	if nilAuth != nil {
		t.Error("nil AuthInfo should be nil")
	}

	// 测试有 ID 的 AuthInfo
	auth := &AuthInfo{ID: "user123"}
	if auth.ID != "user123" {
		t.Errorf("AuthInfo.ID = %q, want %q", auth.ID, "user123")
	}

	// 测试 GetField
	auth.Fields = map[string]any{
		"email": "test@example.com",
		"role":  "admin",
	}
	if auth.GetField("email") != "test@example.com" {
		t.Errorf("GetField('email') = %v, want 'test@example.com'", auth.GetField("email"))
	}
	if auth.GetField("nonexistent") != nil {
		t.Errorf("GetField('nonexistent') = %v, want nil", auth.GetField("nonexistent"))
	}
}

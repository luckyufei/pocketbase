package gateway

import (
	"os"
	"testing"
)

// TestParseHeaderTemplate 测试请求头模板解析
func TestParseHeaderTemplate(t *testing.T) {
	// 设置测试环境变量
	os.Setenv("TEST_API_KEY", "sk-test-12345")
	os.Setenv("TEST_SECRET", "secret-value")
	defer func() {
		os.Unsetenv("TEST_API_KEY")
		os.Unsetenv("TEST_SECRET")
	}()

	// 创建一个模拟的 secret getter
	secretGetter := func(name string) (string, error) {
		secrets := map[string]string{
			"OPENAI_KEY": "sk-openai-from-secrets",
		}
		if v, ok := secrets[name]; ok {
			return v, nil
		}
		return "", nil // 找不到时返回空
	}

	tests := []struct {
		name     string
		template string
		authInfo *AuthInfo
		want     string
		wantErr  bool
	}{
		// 空模板
		{"empty template", "", nil, "", false},

		// 环境变量
		{"env var", "{env.TEST_API_KEY}", nil, "sk-test-12345", false},
		{"env var in bearer", "Bearer {env.TEST_API_KEY}", nil, "Bearer sk-test-12345", false},
		{"missing env var", "{env.NONEXISTENT_VAR}", nil, "", true},

		// Secret 变量（使用环境变量回退）
		{"secret from env", "{secret.TEST_SECRET}", nil, "secret-value", false},

		// Auth 变量
		{"auth id", "@request.auth.id", &AuthInfo{ID: "user123"}, "user123", false},
		{"auth field", "@request.auth.email", &AuthInfo{
			ID:     "user123",
			Fields: map[string]any{"email": "test@example.com"},
		}, "test@example.com", false},
		{"auth no record", "@request.auth.id", nil, "", false},
		{"auth missing field", "@request.auth.unknown", &AuthInfo{ID: "user123"}, "", false},

		// 复合模板
		{"composite", "Bearer {env.TEST_API_KEY} User:@request.auth.id", &AuthInfo{ID: "user123"},
			"Bearer sk-test-12345 User:user123", false},

		// 纯文本
		{"plain text", "application/json", nil, "application/json", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseHeaderTemplate(tt.template, tt.authInfo, secretGetter)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseHeaderTemplate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseHeaderTemplate() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestBuildProxyHeaders 测试构建代理请求头
func TestBuildProxyHeaders(t *testing.T) {
	os.Setenv("TEST_KEY", "test-key-value")
	defer os.Unsetenv("TEST_KEY")

	secretGetter := func(name string) (string, error) {
		return "", nil // 测试中不使用 secrets
	}

	headers := map[string]string{
		"Authorization": "Bearer {env.TEST_KEY}",
		"Content-Type":  "application/json",
		"X-User-ID":     "@request.auth.id",
	}

	authInfo := &AuthInfo{ID: "user-abc"}

	result, err := BuildProxyHeaders(headers, authInfo, secretGetter)
	if err != nil {
		t.Fatalf("BuildProxyHeaders() error = %v", err)
	}

	expected := map[string]string{
		"Authorization": "Bearer test-key-value",
		"Content-Type":  "application/json",
		"X-User-ID":     "user-abc",
	}

	for k, want := range expected {
		if got := result[k]; got != want {
			t.Errorf("BuildProxyHeaders()[%q] = %q, want %q", k, got, want)
		}
	}
}

// TestReplaceEnvVars 测试环境变量替换
func TestReplaceEnvVars(t *testing.T) {
	os.Setenv("VAR1", "value1")
	os.Setenv("VAR2", "value2")
	defer func() {
		os.Unsetenv("VAR1")
		os.Unsetenv("VAR2")
	}()

	tests := []struct {
		template string
		want     string
		wantErr  bool
	}{
		{"{env.VAR1}", "value1", false},
		{"{env.VAR1}-{env.VAR2}", "value1-value2", false},
		{"prefix-{env.VAR1}-suffix", "prefix-value1-suffix", false},
		{"{env.MISSING}", "", true},
		{"no env vars", "no env vars", false},
	}

	for _, tt := range tests {
		t.Run(tt.template, func(t *testing.T) {
			got, err := replaceEnvVars(tt.template)
			if (err != nil) != tt.wantErr {
				t.Errorf("replaceEnvVars(%q) error = %v, wantErr %v", tt.template, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("replaceEnvVars(%q) = %q, want %q", tt.template, got, tt.want)
			}
		})
	}
}

// TestReplaceAuthVars 测试认证变量替换
func TestReplaceAuthVars(t *testing.T) {
	tests := []struct {
		name     string
		template string
		authInfo *AuthInfo
		want     string
	}{
		{"nil auth", "@request.auth.id", nil, ""},
		{"auth id", "@request.auth.id", &AuthInfo{ID: "user123"}, "user123"},
		{"auth field string", "@request.auth.email", &AuthInfo{
			ID:     "user123",
			Fields: map[string]any{"email": "test@example.com"},
		}, "test@example.com"},
		{"auth field int", "@request.auth.count", &AuthInfo{
			ID:     "user123",
			Fields: map[string]any{"count": 42},
		}, "42"},
		{"missing field", "@request.auth.missing", &AuthInfo{ID: "user123"}, ""},
		{"multiple vars", "@request.auth.id-@request.auth.email", &AuthInfo{
			ID:     "user123",
			Fields: map[string]any{"email": "test@example.com"},
		}, "user123-test@example.com"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := replaceAuthVars(tt.template, tt.authInfo)
			if got != tt.want {
				t.Errorf("replaceAuthVars(%q) = %q, want %q", tt.template, got, tt.want)
			}
		})
	}
}

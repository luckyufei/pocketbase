// Package serverless 提供基于 WASM (QuickJS + wazero) 的 Serverless 运行时
package serverless

import (
	"testing"
)

// T001-T004: Setup 阶段测试

func TestPluginConfig(t *testing.T) {
	t.Run("默认配置应有合理默认值", func(t *testing.T) {
		cfg := DefaultConfig()

		if cfg.MaxMemoryMB <= 0 {
			t.Errorf("MaxMemoryMB 应大于 0, got %d", cfg.MaxMemoryMB)
		}
		if cfg.TimeoutSeconds <= 0 {
			t.Errorf("TimeoutSeconds 应大于 0, got %d", cfg.TimeoutSeconds)
		}
		if cfg.PoolSize <= 0 {
			t.Errorf("PoolSize 应大于 0, got %d", cfg.PoolSize)
		}
		if cfg.FunctionsDir == "" {
			t.Error("FunctionsDir 不应为空")
		}
		if cfg.CronTimeoutMinutes <= 0 {
			t.Errorf("CronTimeoutMinutes 应大于 0, got %d", cfg.CronTimeoutMinutes)
		}
		if !cfg.EnableBytecodeCache {
			t.Error("EnableBytecodeCache 默认应为 true")
		}
	})

	t.Run("配置可自定义", func(t *testing.T) {
		cfg := Config{
			MaxMemoryMB:         256,
			TimeoutSeconds:      60,
			CronTimeoutMinutes:  30,
			PoolSize:            10,
			FunctionsDir:        "/custom/path",
			NetworkWhitelist:    []string{"api.openai.com"},
			EnableBytecodeCache: false,
		}

		if cfg.MaxMemoryMB != 256 {
			t.Errorf("MaxMemoryMB = %d, want 256", cfg.MaxMemoryMB)
		}
		if cfg.TimeoutSeconds != 60 {
			t.Errorf("TimeoutSeconds = %d, want 60", cfg.TimeoutSeconds)
		}
		if cfg.CronTimeoutMinutes != 30 {
			t.Errorf("CronTimeoutMinutes = %d, want 30", cfg.CronTimeoutMinutes)
		}
		if len(cfg.NetworkWhitelist) != 1 {
			t.Errorf("NetworkWhitelist length = %d, want 1", len(cfg.NetworkWhitelist))
		}
	})
}

func TestMemoryProfiles(t *testing.T) {
	t.Run("GetMemoryProfile 应返回有效配置", func(t *testing.T) {
		profile := GetMemoryProfile()

		if profile.Name == "" {
			t.Error("profile.Name 不应为空")
		}
		if profile.PoolSize <= 0 {
			t.Errorf("profile.PoolSize 应大于 0, got %d", profile.PoolSize)
		}
		if profile.MaxMemoryMB <= 0 {
			t.Errorf("profile.MaxMemoryMB 应大于 0, got %d", profile.MaxMemoryMB)
		}
	})

	t.Run("ConfigForMemory 应根据内存返回正确配置", func(t *testing.T) {
		testCases := []struct {
			memoryMB       uint64
			expectedPool   int
			expectedMemory int
			expectedName   string
		}{
			{256, 1, 32, "minimal"},   // < 512MB
			{512, 2, 64, "low"},       // 512MB
			{768, 2, 64, "low"},       // < 1GB
			{1024, 3, 96, "medium"},   // 1GB
			{1536, 3, 96, "medium"},   // < 2GB
			{2048, 4, 128, "standard"}, // 2GB
			{4096, 6, 128, "high"},    // 4GB
			{8192, 8, 256, "enterprise"}, // 8GB
		}

		for _, tc := range testCases {
			cfg := ConfigForMemory(tc.memoryMB)
			if cfg.PoolSize != tc.expectedPool {
				t.Errorf("ConfigForMemory(%d).PoolSize = %d, want %d",
					tc.memoryMB, cfg.PoolSize, tc.expectedPool)
			}
			if cfg.MaxMemoryMB != tc.expectedMemory {
				t.Errorf("ConfigForMemory(%d).MaxMemoryMB = %d, want %d",
					tc.memoryMB, cfg.MaxMemoryMB, tc.expectedMemory)
			}
		}
	})

	t.Run("预设配置函数应返回正确值", func(t *testing.T) {
		// MinimalConfig
		minimal := MinimalConfig()
		if minimal.PoolSize != 1 || minimal.MaxMemoryMB != 32 {
			t.Errorf("MinimalConfig: PoolSize=%d, MaxMemoryMB=%d, want 1, 32",
				minimal.PoolSize, minimal.MaxMemoryMB)
		}

		// LowMemoryConfig
		low := LowMemoryConfig()
		if low.PoolSize != 2 || low.MaxMemoryMB != 64 {
			t.Errorf("LowMemoryConfig: PoolSize=%d, MaxMemoryMB=%d, want 2, 64",
				low.PoolSize, low.MaxMemoryMB)
		}

		// StandardConfig
		standard := StandardConfig()
		if standard.PoolSize != 4 || standard.MaxMemoryMB != 128 {
			t.Errorf("StandardConfig: PoolSize=%d, MaxMemoryMB=%d, want 4, 128",
				standard.PoolSize, standard.MaxMemoryMB)
		}

		// HighPerformanceConfig
		high := HighPerformanceConfig()
		if high.PoolSize != 6 || high.MaxMemoryMB != 128 {
			t.Errorf("HighPerformanceConfig: PoolSize=%d, MaxMemoryMB=%d, want 6, 128",
				high.PoolSize, high.MaxMemoryMB)
		}

		// EnterpriseConfig
		enterprise := EnterpriseConfig()
		if enterprise.PoolSize != 8 || enterprise.MaxMemoryMB != 256 {
			t.Errorf("EnterpriseConfig: PoolSize=%d, MaxMemoryMB=%d, want 8, 256",
				enterprise.PoolSize, enterprise.MaxMemoryMB)
		}
	})
}

func TestAutoConfig(t *testing.T) {
	t.Run("AutoConfig 启用时应自动设置值", func(t *testing.T) {
		cfg := Config{
			AutoConfig:   true,
			FunctionsDir: "pb_serverless",
		}
		p := NewPlugin(nil, cfg)

		if p.config.PoolSize <= 0 {
			t.Errorf("AutoConfig 后 PoolSize 应大于 0, got %d", p.config.PoolSize)
		}
		if p.config.MaxMemoryMB <= 0 {
			t.Errorf("AutoConfig 后 MaxMemoryMB 应大于 0, got %d", p.config.MaxMemoryMB)
		}
	})

	t.Run("手动设置值应覆盖自动配置", func(t *testing.T) {
		cfg := Config{
			AutoConfig:   true,
			PoolSize:     10,
			MaxMemoryMB:  256,
			FunctionsDir: "pb_serverless",
		}
		p := NewPlugin(nil, cfg)

		// 手动设置的值应保留
		if p.config.PoolSize != 10 {
			t.Errorf("手动设置的 PoolSize 应保留, got %d, want 10", p.config.PoolSize)
		}
		if p.config.MaxMemoryMB != 256 {
			t.Errorf("手动设置的 MaxMemoryMB 应保留, got %d, want 256", p.config.MaxMemoryMB)
		}
	})

	t.Run("零值配置应触发自动配置", func(t *testing.T) {
		cfg := Config{
			FunctionsDir: "pb_serverless",
			// PoolSize 和 MaxMemoryMB 都是零值
		}
		p := NewPlugin(nil, cfg)

		if p.config.PoolSize <= 0 {
			t.Errorf("零值配置应触发自动配置, PoolSize = %d", p.config.PoolSize)
		}
		if p.config.MaxMemoryMB <= 0 {
			t.Errorf("零值配置应触发自动配置, MaxMemoryMB = %d", p.config.MaxMemoryMB)
		}
	})
}

func TestPluginEntry(t *testing.T) {
	t.Run("Plugin 结构体应正确初始化", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)

		if p == nil {
			t.Fatal("NewPlugin 返回 nil")
		}
		if p.config.MaxMemoryMB != cfg.MaxMemoryMB {
			t.Errorf("config.MaxMemoryMB = %d, want %d", p.config.MaxMemoryMB, cfg.MaxMemoryMB)
		}
	})

	t.Run("Register 不应 panic", func(t *testing.T) {
		cfg := DefaultConfig()
		err := Register(nil, cfg)
		if err != nil {
			t.Errorf("Register() error = %v", err)
		}
	})

	t.Run("MustRegister 不应 panic", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("MustRegister() panicked: %v", r)
			}
		}()

		cfg := DefaultConfig()
		MustRegister(nil, cfg)
	})
}

func TestPluginRegister(t *testing.T) {
	t.Run("register 内部方法", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)

		err := p.register()
		if err != nil {
			t.Errorf("register() error = %v", err)
		}
	})
}

func TestGetSystemMemoryMB(t *testing.T) {
	t.Run("应返回正整数", func(t *testing.T) {
		// getSystemMemoryMB 是内部函数，通过 GetMemoryProfile 间接测试
		profile := GetMemoryProfile()
		// 确保返回的配置是有效的
		if profile.MaxMemoryMB <= 0 {
			t.Errorf("MaxMemoryMB 应大于 0, got %d", profile.MaxMemoryMB)
		}
	})

	t.Run("ConfigForMemory 边界值测试", func(t *testing.T) {
		// 测试边界值
		testCases := []struct {
			memoryMB     uint64
			expectedName string
		}{
			{0, "minimal"},      // 极小值
			{100, "minimal"},    // < 512
			{511, "minimal"},    // 边界
			{512, "low"},        // 刚好 512
			{513, "low"},        // > 512
			{1023, "low"},       // < 1024
			{1024, "medium"},    // 刚好 1GB
			{2047, "medium"},    // < 2GB
			{2048, "standard"},  // 刚好 2GB
			{4095, "standard"},  // < 4GB
			{4096, "high"},      // 刚好 4GB
			{8191, "high"},      // < 8GB
			{8192, "enterprise"}, // 刚好 8GB
			{16384, "enterprise"}, // > 8GB
		}

		for _, tc := range testCases {
			cfg := ConfigForMemory(tc.memoryMB)
			// 验证返回的配置是有效的
			if cfg.PoolSize <= 0 {
				t.Errorf("ConfigForMemory(%d).PoolSize 应大于 0", tc.memoryMB)
			}
			if cfg.MaxMemoryMB <= 0 {
				t.Errorf("ConfigForMemory(%d).MaxMemoryMB 应大于 0", tc.memoryMB)
			}
		}
	})
}

func TestPluginWithNilApp(t *testing.T) {
	t.Run("NewPlugin 应处理 nil app", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)
		if p == nil {
			t.Fatal("NewPlugin 不应返回 nil")
		}
		if p.app != nil {
			t.Error("app 应为 nil")
		}
	})

	t.Run("register 应处理 nil app", func(t *testing.T) {
		cfg := DefaultConfig()
		p := NewPlugin(nil, cfg)
		err := p.register()
		if err != nil {
			t.Errorf("register() 应成功处理 nil app, got error: %v", err)
		}
	})
}

func TestConfigValidation(t *testing.T) {
	t.Run("零值 TimeoutSeconds 应使用默认值", func(t *testing.T) {
		cfg := Config{
			FunctionsDir: "pb_serverless",
		}
		p := NewPlugin(nil, cfg)
		if p.config.TimeoutSeconds <= 0 {
			t.Errorf("TimeoutSeconds 应有默认值, got %d", p.config.TimeoutSeconds)
		}
	})

	t.Run("零值 CronTimeoutMinutes 应使用默认值", func(t *testing.T) {
		cfg := Config{
			FunctionsDir: "pb_serverless",
		}
		p := NewPlugin(nil, cfg)
		if p.config.CronTimeoutMinutes <= 0 {
			t.Errorf("CronTimeoutMinutes 应有默认值, got %d", p.config.CronTimeoutMinutes)
		}
	})

	t.Run("空 FunctionsDir 应使用默认值", func(t *testing.T) {
		cfg := Config{}
		p := NewPlugin(nil, cfg)
		if p.config.FunctionsDir == "" {
			t.Error("FunctionsDir 应有默认值")
		}
	})
}

// ============================================================================
// transpileES6ToQuickJS 测试
// ============================================================================

func TestTranspileES6ToQuickJS(t *testing.T) {
	t.Run("转换 export function 为 __exports", func(t *testing.T) {
		input := `export function GET(request: Request): Response {
  return Response.json({ message: "hello" });
}`
		expected := `__exports['GET'] = function(request) {
  return Response.json({ message: "hello" });
}`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("转换 export async function", func(t *testing.T) {
		input := `export async function POST(request: Request): Promise<Response> {
  const data = await request.json();
  return Response.json(data);
}`
		expected := `__exports['POST'] = function(request) {
  const data = await request.json();
  return Response.json(data);
}`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("转换 export default function", func(t *testing.T) {
		input := `export default function(request: Request): Response {
  return Response.json({ ok: true });
}`
		expected := `__exports['default'] = function(request) {
  return Response.json({ ok: true });
}`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("转换 export const", func(t *testing.T) {
		input := `export const handler = (req) => Response.json({ ok: true });`
		expected := `__exports['handler'] = (req) => Response.json({ ok: true });`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("转换带类型注解的 export const", func(t *testing.T) {
		input := `export const GET: Handler = (req) => Response.json({ ok: true });`
		expected := `__exports['GET'] = (req) => Response.json({ ok: true });`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("保留注释行", func(t *testing.T) {
		input := `// This is a comment
export function GET(request: Request): Response {
  return Response.json({ message: "hello" });
}`
		result := transpileES6ToQuickJS(input)
		if !contains(result, "// This is a comment") {
			t.Errorf("注释应该被保留\n结果:\n%s", result)
		}
	})

	t.Run("保留普通代码行", func(t *testing.T) {
		input := `const helper = () => "test";
export function GET(request: Request): Response {
  return Response.json({ message: helper() });
}`
		result := transpileES6ToQuickJS(input)
		if !contains(result, `const helper = () => "test";`) {
			t.Errorf("普通代码行应该被保留\n结果:\n%s", result)
		}
	})

	t.Run("处理多参数函数", func(t *testing.T) {
		input := `export function handler(req: Request, ctx: Context): Response {
  return Response.json({ ok: true });
}`
		expected := `__exports['handler'] = function(req, ctx) {
  return Response.json({ ok: true });
}`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("处理无参数函数", func(t *testing.T) {
		input := `export function health(): Response {
  return Response.json({ status: "ok" });
}`
		expected := `__exports['health'] = function() {
  return Response.json({ status: "ok" });
}`
		result := transpileES6ToQuickJS(input)
		if result != expected {
			t.Errorf("转换失败\n输入:\n%s\n期望:\n%s\n实际:\n%s", input, expected, result)
		}
	})

	t.Run("处理空输入", func(t *testing.T) {
		input := ""
		result := transpileES6ToQuickJS(input)
		if result != "" {
			t.Errorf("空输入应返回空字符串, got: %s", result)
		}
	})

	t.Run("处理纯 JavaScript 代码（无 export）", func(t *testing.T) {
		input := `function helper() {
  return "test";
}
const x = 1;`
		result := transpileES6ToQuickJS(input)
		if result != input {
			t.Errorf("无 export 的代码应保持不变\n输入:\n%s\n实际:\n%s", input, result)
		}
	})
}

func TestExtractParams(t *testing.T) {
	t.Run("提取单个参数并移除类型", func(t *testing.T) {
		input := "(request: Request): Response {"
		expected := "(request)"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("提取多个参数", func(t *testing.T) {
		input := "(req: Request, ctx: Context): Response {"
		expected := "(req, ctx)"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("处理无参数", func(t *testing.T) {
		input := "(): Response {"
		expected := "()"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("处理带默认值的参数", func(t *testing.T) {
		input := "(name: string = 'default'): Response {"
		expected := "(name = 'default')"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("处理无括号的输入", func(t *testing.T) {
		input := "invalid input"
		expected := "()"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("处理只有左括号", func(t *testing.T) {
		input := "(request"
		expected := "()"
		result := extractParams(input)
		if result != expected {
			t.Errorf("extractParams(%q) = %q, want %q", input, result, expected)
		}
	})
}

func TestRemoveTypeAnnotations(t *testing.T) {
	t.Run("移除 as 类型断言", func(t *testing.T) {
		input := "const data = value as string;"
		expected := "const data = value;"
		result := removeTypeAnnotations(input)
		if result != expected {
			t.Errorf("removeTypeAnnotations(%q) = %q, want %q", input, result, expected)
		}
	})

	t.Run("保留无类型断言的代码", func(t *testing.T) {
		input := "const x = 1;"
		result := removeTypeAnnotations(input)
		if result != input {
			t.Errorf("removeTypeAnnotations(%q) = %q, want %q", input, result, input)
		}
	})

	t.Run("移除 as 类型断言并保留后续代码", func(t *testing.T) {
		input := "const data = value as string, other = 1;"
		result := removeTypeAnnotations(input)
		if !contains(result, "const data = value") {
			t.Errorf("应保留 value 部分, got: %s", result)
		}
	})
}

// 辅助函数
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

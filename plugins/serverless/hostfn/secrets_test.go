// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"testing"
)

// Phase 9: US6 Secrets Access 测试

func TestSecretService(t *testing.T) {
	t.Run("获取 Secret", func(t *testing.T) {
		ss := NewSecretService(nil)

		// 模拟设置 Secret
		ss.MockSecret("OPENAI_API_KEY", "sk-test-key-123")

		val := ss.Get("OPENAI_API_KEY")
		if val != "sk-test-key-123" {
			t.Errorf("Get() = %s, want sk-test-key-123", val)
		}
	})

	t.Run("不存在的 Secret", func(t *testing.T) {
		ss := NewSecretService(nil)

		val := ss.Get("NONEXISTENT")
		if val != "" {
			t.Errorf("Get() = %s, want empty string", val)
		}
	})

	t.Run("日志脱敏", func(t *testing.T) {
		ss := NewSecretService(nil)
		ss.MockSecret("API_KEY", "secret-value-12345")

		// 获取脱敏后的值用于日志
		masked := ss.GetMasked("API_KEY")
		if masked == "secret-value-12345" {
			t.Error("GetMasked() 不应返回原始值")
		}

		// 应该返回类似 "sec***345" 的格式
		if len(masked) == 0 {
			t.Error("GetMasked() 不应返回空字符串")
		}
	})

	t.Run("Secret 名称验证", func(t *testing.T) {
		ss := NewSecretService(nil)

		// 有效名称
		if !ss.IsValidName("OPENAI_API_KEY") {
			t.Error("IsValidName() 应该接受 OPENAI_API_KEY")
		}

		// 无效名称（包含特殊字符）
		if ss.IsValidName("my-secret") {
			t.Error("IsValidName() 不应接受包含连字符的名称")
		}

		// 无效名称（小写）
		if ss.IsValidName("lowercase") {
			t.Error("IsValidName() 不应接受小写名称")
		}
	})
}

func TestSecretServiceHostFunction(t *testing.T) {
	t.Run("Host Function 调用", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		// 模拟 Secret
		hf.MockSecret("TEST_SECRET", "test-value")

		val := hf.SecretGet("TEST_SECRET")
		if val != "test-value" {
			t.Errorf("SecretGet() = %s, want test-value", val)
		}
	})

	t.Run("不存在的 Secret 返回空", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		val := hf.SecretGet("NONEXISTENT")
		if val != "" {
			t.Errorf("SecretGet() = %s, want empty", val)
		}
	})
}

func TestSecretMasking(t *testing.T) {
	t.Run("短值脱敏", func(t *testing.T) {
		masked := MaskSecret("abc")
		if masked != "***" {
			t.Errorf("MaskSecret() = %s, want ***", masked)
		}
	})

	t.Run("长值脱敏", func(t *testing.T) {
		masked := MaskSecret("sk-test-key-123456789")
		// 应该保留前3和后3个字符
		if masked != "sk-***789" {
			t.Errorf("MaskSecret() = %s, want sk-***789", masked)
		}
	})

	t.Run("空值脱敏", func(t *testing.T) {
		masked := MaskSecret("")
		if masked != "" {
			t.Errorf("MaskSecret() = %s, want empty", masked)
		}
	})
}

// 新增测试用例覆盖桥接功能

func TestSecretService_GetWithDefault(t *testing.T) {
	ss := NewSecretService(nil)

	// 不存在时返回默认值
	val := ss.GetWithDefault("NONEXISTENT", "default-value")
	if val != "default-value" {
		t.Errorf("GetWithDefault() = %s, want default-value", val)
	}

	// 存在时返回实际值
	ss.MockSecret("EXISTING_KEY", "actual-value")
	val = ss.GetWithDefault("EXISTING_KEY", "default-value")
	if val != "actual-value" {
		t.Errorf("GetWithDefault() = %s, want actual-value", val)
	}
}

func TestSecretService_Exists(t *testing.T) {
	ss := NewSecretService(nil)

	// 不存在
	exists, err := ss.Exists("NONEXISTENT")
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if exists {
		t.Error("Exists() = true, want false")
	}

	// 存在
	ss.MockSecret("EXISTING", "value")
	exists, err = ss.Exists("EXISTING")
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if !exists {
		t.Error("Exists() = false, want true")
	}
}

func TestSecretService_GetForEnv(t *testing.T) {
	ss := NewSecretService(nil)

	// 不存在
	_, err := ss.GetForEnv("NONEXISTENT", "production")
	if err == nil {
		t.Error("GetForEnv() should return error for nonexistent key")
	}

	// 存在（fallback 不支持环境区分，直接返回值）
	ss.MockSecret("ENV_SECRET", "value")
	val, err := ss.GetForEnv("ENV_SECRET", "production")
	if err != nil {
		t.Fatalf("GetForEnv() error = %v", err)
	}
	if val != "value" {
		t.Errorf("GetForEnv() = %s, want value", val)
	}
}

func TestSecretServiceHostFunction_Extended(t *testing.T) {
	hf := NewHostFunctions(nil)

	t.Run("SecretGetWithDefault", func(t *testing.T) {
		val := hf.SecretGetWithDefault("NONEXISTENT", "default")
		if val != "default" {
			t.Errorf("SecretGetWithDefault() = %s, want default", val)
		}
	})

	t.Run("SecretExists", func(t *testing.T) {
		exists, err := hf.SecretExists("NONEXISTENT")
		if err != nil {
			t.Fatalf("SecretExists() error = %v", err)
		}
		if exists {
			t.Error("SecretExists() = true, want false")
		}

		hf.MockSecret("EXISTING", "value")
		exists, err = hf.SecretExists("EXISTING")
		if err != nil {
			t.Fatalf("SecretExists() error = %v", err)
		}
		if !exists {
			t.Error("SecretExists() = false, want true")
		}
	})

	t.Run("SecretGetMasked", func(t *testing.T) {
		hf.MockSecret("MASKED_KEY", "secret-value-123")
		masked := hf.SecretGetMasked("MASKED_KEY")
		if masked == "secret-value-123" {
			t.Error("SecretGetMasked() should not return original value")
		}
		if masked != "sec***123" {
			t.Errorf("SecretGetMasked() = %s, want sec***123", masked)
		}
	})
}

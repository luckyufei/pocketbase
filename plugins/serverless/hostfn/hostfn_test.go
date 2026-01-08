// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func TestNewHostFunctions(t *testing.T) {
	t.Run("创建 HostFunctions", func(t *testing.T) {
		hf := NewHostFunctions(nil)
		if hf == nil {
			t.Fatal("NewHostFunctions() returned nil")
		}

		if hf.txMgr == nil {
			t.Error("txMgr should not be nil")
		}
	})

	t.Run("使用 TestApp 创建", func(t *testing.T) {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Skipf("无法创建 TestApp: %v", err)
			return
		}
		defer app.Cleanup()

		hf := NewHostFunctions(app)
		if hf == nil {
			t.Fatal("NewHostFunctions() returned nil")
		}
	})
}

func TestHostFunctionsFetch(t *testing.T) {
	t.Run("获取 Fetch 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		fetch := hf.Fetch()
		if fetch == nil {
			t.Error("Fetch() returned nil")
		}

		// 再次调用应该返回同一个实例
		fetch2 := hf.Fetch()
		if fetch != fetch2 {
			t.Error("Fetch() should return the same instance")
		}
	})
}

func TestHostFunctionsConsole(t *testing.T) {
	t.Run("获取 Console 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		console := hf.Console()
		if console == nil {
			t.Error("Console() returned nil")
		}

		// 再次调用应该返回同一个实例
		console2 := hf.Console()
		if console != console2 {
			t.Error("Console() should return the same instance")
		}
	})
}

func TestHostFunctionsTransactionManager(t *testing.T) {
	t.Run("获取 TransactionManager", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		txMgr := hf.TransactionManager()
		if txMgr == nil {
			t.Error("TransactionManager() returned nil")
		}
	})
}

func TestHostFunctionsKV(t *testing.T) {
	t.Run("获取 KV 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		kv := hf.KV()
		if kv == nil {
			t.Error("KV() returned nil")
		}

		// 再次调用应该返回同一个实例
		kv2 := hf.KV()
		if kv != kv2 {
			t.Error("KV() should return the same instance")
		}
	})
}

func TestHostFunctionsFiles(t *testing.T) {
	t.Run("获取 Files 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		files := hf.Files()
		if files == nil {
			t.Error("Files() returned nil")
		}

		// 再次调用应该返回同一个实例
		files2 := hf.Files()
		if files != files2 {
			t.Error("Files() should return the same instance")
		}
	})
}

func TestHostFunctionsSecrets(t *testing.T) {
	t.Run("获取 Secrets 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		secrets := hf.Secrets()
		if secrets == nil {
			t.Error("Secrets() returned nil")
		}

		// 再次调用应该返回同一个实例
		secrets2 := hf.Secrets()
		if secrets != secrets2 {
			t.Error("Secrets() should return the same instance")
		}
	})
}

func TestHostFunctionsJobs(t *testing.T) {
	t.Run("获取 Jobs 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		jobs := hf.Jobs()
		if jobs == nil {
			t.Error("Jobs() returned nil")
		}

		// 再次调用应该返回同一个实例
		jobs2 := hf.Jobs()
		if jobs != jobs2 {
			t.Error("Jobs() should return the same instance")
		}
	})
}

func TestHostFunctionsVector(t *testing.T) {
	t.Run("获取 Vector 服务", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		vector := hf.Vector()
		if vector == nil {
			t.Error("Vector() returned nil")
		}

		// 再次调用应该返回同一个实例
		vector2 := hf.Vector()
		if vector != vector2 {
			t.Error("Vector() should return the same instance")
		}
	})
}

func TestLogCollectorClear(t *testing.T) {
	t.Run("清空日志", func(t *testing.T) {
		collector := NewLogCollector()

		// 添加一些日志
		collector.Add(LogEntry{Level: "log", Message: "test1"})
		collector.Add(LogEntry{Level: "warn", Message: "test2"})
		collector.Add(LogEntry{Level: "error", Message: "test3"})

		logs := collector.Logs()
		if len(logs) != 3 {
			t.Fatalf("expected 3 logs, got %d", len(logs))
		}

		// 清空日志
		collector.Clear()

		logs = collector.Logs()
		if len(logs) != 0 {
			t.Errorf("expected 0 logs after Clear(), got %d", len(logs))
		}
	})
}

func TestConsoleOutput(t *testing.T) {
	t.Run("Console 输出各级别日志", func(t *testing.T) {
		collector := NewLogCollector()
		console := NewConsole(ConsoleConfig{
			Collector: collector,
		})

		console.Log("log message")
		console.Warn("warn message")
		console.Error("error message")
		console.Info("info message")
		console.Debug("debug message")

		logs := collector.Logs()
		if len(logs) != 5 {
			t.Fatalf("expected 5 logs, got %d", len(logs))
		}

		expectedLevels := []string{"log", "warn", "error", "info", "debug"}
		for i, expected := range expectedLevels {
			if logs[i].Level != expected {
				t.Errorf("logs[%d].Level = %s, want %s", i, logs[i].Level, expected)
			}
		}
	})
}

func TestHostFunctionsUtils(t *testing.T) {
	t.Run("UtilUUID", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		uuid := hf.UtilUUID()
		if uuid == "" {
			t.Error("UtilUUID() returned empty string")
		}

		// UUID 格式验证
		if len(uuid) != 36 {
			t.Errorf("UtilUUID() length = %d, want 36", len(uuid))
		}
	})

	t.Run("UtilHash", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		hash := hf.UtilHash("test")
		if hash == "" {
			t.Error("UtilHash() returned empty string")
		}

		// SHA256 哈希长度为 64
		if len(hash) != 64 {
			t.Errorf("UtilHash() length = %d, want 64", len(hash))
		}
	})

	t.Run("UtilRandomString", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		str := hf.UtilRandomString(10)
		if len(str) != 10 {
			t.Errorf("UtilRandomString(10) length = %d, want 10", len(str))
		}
	})
}

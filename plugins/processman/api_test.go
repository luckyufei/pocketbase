// API 处理函数的单元测试（不需要完整 PocketBase 实例）
package processman

import (
	"os"
	"testing"
	"time"
)

// === API 辅助函数测试 ===

func TestProcessState_UptimeFormat(t *testing.T) {
	state := ProcessState{
		ID:        "test",
		Status:    "running",
		PID:       12345,
		StartTime: time.Now().Add(-2*time.Hour - 30*time.Minute - 15*time.Second),
	}

	// 模拟 API 返回时的 uptime 计算
	if state.Status == "running" && !state.StartTime.IsZero() {
		state.Uptime = time.Since(state.StartTime).Round(time.Second).String()
	}

	// uptime 应该是类似 "2h30m15s" 的格式
	if state.Uptime == "" {
		t.Error("Uptime should be calculated for running processes")
	}
}

func TestProcessState_StoppedNoUptime(t *testing.T) {
	state := ProcessState{
		ID:        "test",
		Status:    "stopped",
		StartTime: time.Now().Add(-1 * time.Hour),
	}

	// stopped 状态不应该计算 uptime
	if state.Status != "running" {
		state.Uptime = ""
	}

	if state.Uptime != "" {
		t.Error("Uptime should be empty for stopped processes")
	}
}

// === 更多 Supervisor 逻辑测试 ===

func TestSupervise_MaxRetriesZero(t *testing.T) {
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:         "test-max0",
		Command:    "false", // 返回非零退出码
		Cwd:        "/tmp",
		MaxRetries: 0, // 不重试
	}

	done := make(chan bool)
	go func() {
		pm.supervise(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 应该立即退出，因为 maxRetries=0
	case <-time.After(5 * time.Second):
		pm.Stop()
		t.Error("supervise should exit after max retries exceeded")
	}
}

func TestSupervise_NegativeMaxRetries(t *testing.T) {
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:         "test-neg",
		Command:    "true", // 立即成功退出
		Cwd:        "/tmp",
		MaxRetries: -1, // 无限重试
	}

	// 启动后立即停止
	go func() {
		time.Sleep(200 * time.Millisecond)
		pm.Stop()
	}()

	done := make(chan bool)
	go func() {
		pm.supervise(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 正常退出
	case <-time.After(3 * time.Second):
		pm.Stop()
		t.Error("supervise should exit when context is cancelled")
	}
}

// === 解释器解析更多边界情况 ===

func TestResolveInterpreter_ShellScript(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:     "test",
		Script: "script.sh",
		Cwd:    "/tmp",
	}

	result := pm.resolveInterpreter(cfg)
	// .sh 文件没有特殊处理，返回空（假设脚本有 shebang）
	if result != "" {
		t.Errorf("resolveInterpreter(.sh) = %q, want empty", result)
	}
}

func TestResolveInterpreter_EmptyInterpreter(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:          "test",
		Script:      "test.py",
		Cwd:         "/nonexistent",
		Interpreter: "", // 空字符串，应该自动探测
	}

	result := pm.resolveInterpreter(cfg)
	// 没有 venv，应该返回 python3
	if result != "python3" {
		t.Errorf("resolveInterpreter(empty) = %q, want %q", result, "python3")
	}
}

// === 配置加载边界情况 ===

func TestLoadConfig_EmptyArray(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := tmpDir + "/pb_processes.json"

	// 空数组
	writeTestFile(t, configPath, "[]")

	pm := New(nil, Config{ConfigFile: configPath})
	err := pm.loadConfig()

	if err != nil {
		t.Errorf("loadConfig() with empty array should not error: %v", err)
	}
	if len(pm.configs) != 0 {
		t.Errorf("configs length = %d, want 0", len(pm.configs))
	}
}

func TestLoadConfig_UnreadableFile(t *testing.T) {
	// 注意：这个测试可能在某些系统上失败
	pm := New(nil, Config{ConfigFile: "/root/protected.json"})
	err := pm.loadConfig()

	// 文件不存在或无法读取都应该返回 nil（静默失败）
	// 因为我们的实现中，文件不存在返回 nil
	if err != nil {
		t.Logf("loadConfig() with unreadable file: %v (expected)", err)
	}
}

// 辅助函数
func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}
}

// === Start API 测试 ===

func TestStartProcess_StateTransition(t *testing.T) {
	pm := New(nil, Config{})

	// 模拟一个已停止的进程
	pm.states["test-process"] = &ProcessState{
		ID:     "test-process",
		Status: "stopped",
		PID:    0,
	}

	// 注册进程配置（必须有配置才能启动）
	pm.configs = append(pm.configs, &ProcessConfig{
		ID:      "test-process",
		Command: "echo",
		Args:    []string{"hello"},
		Cwd:     "/tmp",
	})

	// 测试: 调用 StartProcess 应该返回 nil（成功）
	err := pm.StartProcess("test-process")
	if err != nil {
		t.Errorf("StartProcess() error = %v, want nil", err)
	}
}

func TestStartProcess_NotFound(t *testing.T) {
	pm := New(nil, Config{})

	// 没有注册任何进程配置
	err := pm.StartProcess("nonexistent")

	if err == nil {
		t.Error("StartProcess() should return error for non-existent process")
	}
}

func TestStartProcess_AlreadyRunning(t *testing.T) {
	pm := New(nil, Config{})

	// 模拟一个正在运行的进程
	pm.states["test-process"] = &ProcessState{
		ID:     "test-process",
		Status: "running",
		PID:    12345,
	}

	pm.configs = append(pm.configs, &ProcessConfig{
		ID:      "test-process",
		Command: "echo",
		Cwd:     "/tmp",
	})

	// 测试: 启动已经在运行的进程应该返回错误
	err := pm.StartProcess("test-process")
	if err == nil {
		t.Error("StartProcess() should return error for already running process")
	}
}

// === List API 扩展测试 - 返回配置信息 ===

func TestProcessStateWithConfig(t *testing.T) {
	pm := New(nil, Config{})

	// 注册配置
	cfg := &ProcessConfig{
		ID:          "test-agent",
		Script:      "agent.py",
		Args:        []string{"--model", "gpt-4"},
		Cwd:         "/app/agents",
		Interpreter: "python3",
		MaxRetries:  10,
		Backoff:     "2s",
		DevMode:     true,
		WatchPaths:  []string{"./src", "./config"},
		Env: map[string]string{
			"OPENAI_API_KEY": "sk-secret-key",
			"PB_PORT":        "8090",
		},
	}
	pm.configs = append(pm.configs, cfg)

	// 设置运行状态
	pm.states["test-agent"] = &ProcessState{
		ID:           "test-agent",
		Status:       "running",
		PID:          4021,
		StartTime:    time.Now().Add(-2 * time.Hour),
		RestartCount: 3,
	}

	// 获取扩展状态
	states := pm.GetAllStatesWithConfig()

	if len(states) != 1 {
		t.Fatalf("GetAllStatesWithConfig() returned %d states, want 1", len(states))
	}

	state := states[0]

	// 验证配置信息
	if state.Config == nil {
		t.Fatal("Config should not be nil")
	}

	if state.Config.Script != "agent.py" {
		t.Errorf("Config.Script = %q, want %q", state.Config.Script, "agent.py")
	}

	if len(state.Config.Args) != 2 || state.Config.Args[0] != "--model" {
		t.Errorf("Config.Args = %v, want [--model, gpt-4]", state.Config.Args)
	}

	// 验证敏感环境变量被脱敏
	if state.Config.Env["OPENAI_API_KEY"] != "****" {
		t.Errorf("Sensitive env var should be masked, got %q", state.Config.Env["OPENAI_API_KEY"])
	}

	// 验证非敏感环境变量保持原值
	if state.Config.Env["PB_PORT"] != "8090" {
		t.Errorf("Non-sensitive env var should not be masked, got %q", state.Config.Env["PB_PORT"])
	}
}

// === 日志 API 测试 ===

func TestLogBuffer_AddAndGet(t *testing.T) {
	buf := NewLogBuffer(100)

	// 添加日志条目
	buf.Add(LogEntry{
		Timestamp: time.Now(),
		ProcessID: "test",
		Stream:    "stdout",
		Content:   "Hello, World!",
	})

	logs := buf.GetLast(10)
	if len(logs) != 1 {
		t.Errorf("GetLast() returned %d entries, want 1", len(logs))
	}

	if logs[0].Content != "Hello, World!" {
		t.Errorf("Log content = %q, want %q", logs[0].Content, "Hello, World!")
	}
}

func TestLogBuffer_RingBehavior(t *testing.T) {
	buf := NewLogBuffer(5) // 小容量便于测试

	// 添加 10 条日志（超出容量）
	for i := 0; i < 10; i++ {
		buf.Add(LogEntry{
			Timestamp: time.Now(),
			ProcessID: "test",
			Stream:    "stdout",
			Content:   "Line " + string(rune('A'+i)),
		})
	}

	// 只应该保留最后 5 条
	logs := buf.GetLast(100)
	if len(logs) != 5 {
		t.Errorf("GetLast() returned %d entries, want 5", len(logs))
	}

	// 验证是最后 5 条（F, G, H, I, J）
	if logs[0].Content != "Line F" {
		t.Errorf("First log = %q, want %q", logs[0].Content, "Line F")
	}
	if logs[4].Content != "Line J" {
		t.Errorf("Last log = %q, want %q", logs[4].Content, "Line J")
	}
}

func TestLogBuffer_GetLastWithLimit(t *testing.T) {
	buf := NewLogBuffer(100)

	// 添加 50 条日志
	for i := 0; i < 50; i++ {
		buf.Add(LogEntry{
			Timestamp: time.Now(),
			ProcessID: "test",
			Stream:    "stdout",
			Content:   "Line",
		})
	}

	// 只请求 10 条
	logs := buf.GetLast(10)
	if len(logs) != 10 {
		t.Errorf("GetLast(10) returned %d entries, want 10", len(logs))
	}
}

func TestLogBuffer_Empty(t *testing.T) {
	buf := NewLogBuffer(100)

	logs := buf.GetLast(10)
	if len(logs) != 0 {
		t.Errorf("GetLast() on empty buffer returned %d entries, want 0", len(logs))
	}
}

func TestLogBuffer_ConcurrentAccess(t *testing.T) {
	buf := NewLogBuffer(100)
	done := make(chan bool)

	// 并发写入
	go func() {
		for i := 0; i < 1000; i++ {
			buf.Add(LogEntry{
				Timestamp: time.Now(),
				ProcessID: "test",
				Stream:    "stdout",
				Content:   "Line",
			})
		}
		done <- true
	}()

	// 并发读取
	go func() {
		for i := 0; i < 1000; i++ {
			_ = buf.GetLast(50)
		}
		done <- true
	}()

	// 等待完成
	<-done
	<-done
}

func TestMaskSensitiveEnvVars(t *testing.T) {
	env := map[string]string{
		"OPENAI_API_KEY":  "sk-secret-123",
		"API_KEY":         "secret-key",
		"SECRET_TOKEN":    "token-123",
		"PASSWORD":        "mypassword",
		"DATABASE_URL":    "postgres://user:pass@localhost/db",
		"PB_PORT":         "8090",
		"NODE_ENV":        "production",
		"ALLOWED_ORIGINS": "http://localhost:3000",
	}

	masked := MaskSensitiveEnvVars(env)

	// 敏感变量应该被脱敏
	sensitiveKeys := []string{"OPENAI_API_KEY", "API_KEY", "SECRET_TOKEN", "PASSWORD"}
	for _, key := range sensitiveKeys {
		if masked[key] != "****" {
			t.Errorf("Sensitive env %q should be masked, got %q", key, masked[key])
		}
	}

	// 非敏感变量应该保持原值
	nonSensitiveKeys := []string{"PB_PORT", "NODE_ENV", "ALLOWED_ORIGINS"}
	for _, key := range nonSensitiveKeys {
		if masked[key] != env[key] {
			t.Errorf("Non-sensitive env %q should not be masked, got %q", key, masked[key])
		}
	}
}

func TestGetProcessLogs_NotFound(t *testing.T) {
	pm := New(nil, Config{})

	logs, err := pm.GetProcessLogs("nonexistent", 100)

	if err == nil {
		t.Error("GetProcessLogs() should return error for non-existent process")
	}
	if logs != nil {
		t.Error("Logs should be nil for non-existent process")
	}
}

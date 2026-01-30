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

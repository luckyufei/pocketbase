// TDD 绿灯阶段：ProcessManager 核心测试
package processman

import (
	"testing"
	"time"
)

// === T1.1 测试：ProcessManager 创建 ===

func TestNew_DefaultConfig(t *testing.T) {
	// 测试使用 nil app 来验证基本初始化（实际需要 mock app）
	pm := New(nil, Config{})

	if pm == nil {
		t.Fatal("New() returned nil")
	}

	// 验证默认配置文件名
	if pm.config.ConfigFile != "pb_processes.json" {
		t.Errorf("ConfigFile = %q, want %q", pm.config.ConfigFile, "pb_processes.json")
	}

	// 验证 states map 已初始化
	if pm.states == nil {
		t.Error("states map should be initialized")
	}

	// 验证 context 已创建
	if pm.ctx == nil {
		t.Error("context should be initialized")
	}
}

func TestNew_CustomConfig(t *testing.T) {
	cfg := Config{
		ConfigFile: "custom_processes.json",
	}
	pm := New(nil, cfg)

	if pm.config.ConfigFile != "custom_processes.json" {
		t.Errorf("ConfigFile = %q, want %q", pm.config.ConfigFile, "custom_processes.json")
	}
}

func TestProcessManager_Register(t *testing.T) {
	pm := New(nil, Config{})

	cfg := ProcessConfig{
		ID:     "test-process",
		Script: "test.py",
		Cwd:    "/tmp",
	}

	pm.Register(cfg)

	if len(pm.configs) != 1 {
		t.Errorf("configs length = %d, want 1", len(pm.configs))
	}

	if pm.configs[0].ID != "test-process" {
		t.Errorf("configs[0].ID = %q, want %q", pm.configs[0].ID, "test-process")
	}
}

func TestProcessManager_RegisterMultiple(t *testing.T) {
	pm := New(nil, Config{})

	configs := []ProcessConfig{
		{ID: "process-1", Script: "p1.py", Cwd: "/tmp"},
		{ID: "process-2", Script: "p2.py", Cwd: "/tmp"},
		{ID: "process-3", Command: "echo", Args: []string{"hello"}, Cwd: "/tmp"},
	}

	for _, cfg := range configs {
		pm.Register(cfg)
	}

	if len(pm.configs) != 3 {
		t.Errorf("configs length = %d, want 3", len(pm.configs))
	}
}

func TestProcessManager_Stop(t *testing.T) {
	pm := New(nil, Config{})

	// 验证 context 可以被取消
	select {
	case <-pm.ctx.Done():
		t.Error("context should not be done before Stop()")
	default:
		// OK
	}

	pm.Stop()

	// 验证 context 已被取消
	select {
	case <-pm.ctx.Done():
		// OK
	case <-time.After(100 * time.Millisecond):
		t.Error("context should be done after Stop()")
	}
}

// === T1.3 测试：指数退避策略 ===

func TestCalculateBackoff_FirstFailure(t *testing.T) {
	pm := New(nil, Config{})
	base := 1 * time.Second

	result := pm.calculateBackoff(base, 1)
	if result != 1*time.Second {
		t.Errorf("calculateBackoff(1s, 1) = %v, want 1s", result)
	}
}

func TestCalculateBackoff_Exponential(t *testing.T) {
	pm := New(nil, Config{})
	base := 1 * time.Second

	tests := []struct {
		failCount int
		expected  time.Duration
	}{
		{1, 1 * time.Second},
		{2, 2 * time.Second},
		{3, 4 * time.Second},
		{4, 8 * time.Second},
		{5, 16 * time.Second},
	}

	for _, tt := range tests {
		result := pm.calculateBackoff(base, tt.failCount)
		if result != tt.expected {
			t.Errorf("calculateBackoff(%v, %d) = %v, want %v",
				base, tt.failCount, result, tt.expected)
		}
	}
}

func TestCalculateBackoff_Cap30Seconds(t *testing.T) {
	pm := New(nil, Config{})
	base := 1 * time.Second

	// 大量失败次数应该被限制在 30 秒
	result := pm.calculateBackoff(base, 100)
	if result != 30*time.Second {
		t.Errorf("calculateBackoff(1s, 100) = %v, want 30s (cap)", result)
	}

	// 边界测试：failCount=6 应该是 32s，但被限制为 30s
	result = pm.calculateBackoff(base, 6)
	if result != 30*time.Second {
		t.Errorf("calculateBackoff(1s, 6) = %v, want 30s (cap)", result)
	}
}

func TestCalculateBackoff_HealthyRun(t *testing.T) {
	pm := New(nil, Config{})
	base := 1 * time.Second

	// failCount=0 表示健康运行后重启
	result := pm.calculateBackoff(base, 0)
	if result != 0 {
		t.Errorf("calculateBackoff(1s, 0) = %v, want 0 (immediate restart)", result)
	}
}

func TestParseBackoff_ValidDuration(t *testing.T) {
	pm := New(nil, Config{})

	tests := []struct {
		input    string
		expected time.Duration
	}{
		{"1s", 1 * time.Second},
		{"500ms", 500 * time.Millisecond},
		{"2m", 2 * time.Minute},
		{"", 1 * time.Second}, // 默认值
	}

	for _, tt := range tests {
		result := pm.parseBackoff(tt.input)
		if result != tt.expected {
			t.Errorf("parseBackoff(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestParseBackoff_InvalidFormat(t *testing.T) {
	pm := New(nil, Config{})

	// 无效格式应该返回默认值 1s
	result := pm.parseBackoff("invalid")
	if result != 1*time.Second {
		t.Errorf("parseBackoff(invalid) = %v, want 1s (default)", result)
	}
}

// === T1.4 测试：状态管理 ===

func TestUpdateState_NewProcess(t *testing.T) {
	pm := New(nil, Config{})

	pm.updateState("new-process", "starting", 0, "")

	pm.mu.RLock()
	state, exists := pm.states["new-process"]
	pm.mu.RUnlock()

	if !exists {
		t.Fatal("state should exist after updateState")
	}
	if state.Status != "starting" {
		t.Errorf("Status = %q, want %q", state.Status, "starting")
	}
}

func TestUpdateState_Running(t *testing.T) {
	pm := New(nil, Config{})

	pm.updateState("test", "running", 12345, "")

	pm.mu.RLock()
	state := pm.states["test"]
	pm.mu.RUnlock()

	if state.PID != 12345 {
		t.Errorf("PID = %d, want 12345", state.PID)
	}
	if state.StartTime.IsZero() {
		t.Error("StartTime should be set when status is running")
	}
}

func TestUpdateState_RestartCount(t *testing.T) {
	pm := New(nil, Config{})

	// 模拟多次重启
	pm.updateState("test", "running", 100, "")
	pm.updateState("test", "crashed", 0, "error 1")
	pm.updateState("test", "running", 101, "")
	pm.updateState("test", "crashed", 0, "error 2")

	pm.mu.RLock()
	state := pm.states["test"]
	pm.mu.RUnlock()

	if state.RestartCount != 2 {
		t.Errorf("RestartCount = %d, want 2", state.RestartCount)
	}
	if state.LastError != "error 2" {
		t.Errorf("LastError = %q, want %q", state.LastError, "error 2")
	}
}

// === T1.4 测试：GetState 方法 ===

func TestGetState_Exists(t *testing.T) {
	pm := New(nil, Config{})
	pm.updateState("test", "running", 123, "")

	state := pm.GetState("test")
	if state == nil {
		t.Fatal("GetState should return non-nil for existing process")
	}
	if state.PID != 123 {
		t.Errorf("PID = %d, want 123", state.PID)
	}
}

func TestGetState_NotExists(t *testing.T) {
	pm := New(nil, Config{})

	state := pm.GetState("nonexistent")
	if state != nil {
		t.Error("GetState should return nil for non-existent process")
	}
}

// === 并发安全测试 ===

func TestProcessManager_ConcurrentAccess(t *testing.T) {
	pm := New(nil, Config{})

	// 启动多个 goroutine 并发更新状态
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				pm.updateState("test", "running", id*1000+j, "")
				pm.GetState("test")
			}
			done <- true
		}(i)
	}

	// 等待所有 goroutine 完成
	for i := 0; i < 10; i++ {
		<-done
	}

	// 如果没有 panic 或 race condition，测试通过
	state := pm.GetState("test")
	if state == nil {
		t.Error("state should exist after concurrent updates")
	}
}

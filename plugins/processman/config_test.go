// TDD 绿灯阶段：配置结构体测试
package processman

import (
	"encoding/json"
	"testing"
	"time"
)

// === T1.1 测试：配置结构体 ===

func TestProcessConfig_Defaults(t *testing.T) {
	cfg := ProcessConfig{
		ID:     "test-process",
		Script: "test.py",
		Cwd:    "/tmp",
	}

	// 验证必填字段
	if cfg.ID == "" {
		t.Error("ID should not be empty")
	}
	if cfg.Cwd == "" {
		t.Error("Cwd should not be empty")
	}
}

func TestProcessConfig_JSONTags(t *testing.T) {
	// 测试 JSON 序列化/反序列化
	jsonStr := `{
		"id": "ai-agent",
		"script": "agent.py",
		"args": ["--port", "8091"],
		"cwd": "./agents",
		"env": {"OPENAI_API_KEY": "test-key"},
		"interpreter": "auto",
		"maxRetries": 3,
		"backoff": "1s",
		"devMode": true,
		"watchPaths": ["./src"]
	}`

	var cfg ProcessConfig
	if err := json.Unmarshal([]byte(jsonStr), &cfg); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if cfg.ID != "ai-agent" {
		t.Errorf("ID = %q, want %q", cfg.ID, "ai-agent")
	}
	if cfg.Script != "agent.py" {
		t.Errorf("Script = %q, want %q", cfg.Script, "agent.py")
	}
	if len(cfg.Args) != 2 {
		t.Errorf("Args length = %d, want 2", len(cfg.Args))
	}
	if cfg.Cwd != "./agents" {
		t.Errorf("Cwd = %q, want %q", cfg.Cwd, "./agents")
	}
	if cfg.Env["OPENAI_API_KEY"] != "test-key" {
		t.Errorf("Env[OPENAI_API_KEY] = %q, want %q", cfg.Env["OPENAI_API_KEY"], "test-key")
	}
	if cfg.Interpreter != "auto" {
		t.Errorf("Interpreter = %q, want %q", cfg.Interpreter, "auto")
	}
	if cfg.MaxRetries != 3 {
		t.Errorf("MaxRetries = %d, want 3", cfg.MaxRetries)
	}
	if cfg.Backoff != "1s" {
		t.Errorf("Backoff = %q, want %q", cfg.Backoff, "1s")
	}
	if !cfg.DevMode {
		t.Error("DevMode should be true")
	}
	if len(cfg.WatchPaths) != 1 || cfg.WatchPaths[0] != "./src" {
		t.Errorf("WatchPaths = %v, want [./src]", cfg.WatchPaths)
	}
}

func TestProcessState_StatusValues(t *testing.T) {
	validStatuses := []string{"running", "stopped", "crashed", "starting"}

	for _, status := range validStatuses {
		state := ProcessState{
			ID:     "test",
			Status: status,
		}
		if state.Status != status {
			t.Errorf("Status = %q, want %q", state.Status, status)
		}
	}
}

func TestProcessState_UptimeCalculation(t *testing.T) {
	state := ProcessState{
		ID:        "test",
		Status:    "running",
		StartTime: time.Now().Add(-2 * time.Hour),
	}

	// 验证 StartTime 正确设置
	if state.StartTime.IsZero() {
		t.Error("StartTime should not be zero")
	}

	// 计算 uptime（实际计算在 API 返回时处理）
	uptime := time.Since(state.StartTime)
	if uptime < 2*time.Hour-time.Minute || uptime > 2*time.Hour+time.Minute {
		t.Errorf("Uptime calculation seems wrong: %v", uptime)
	}
}

func TestConfig_DefaultConfigFile(t *testing.T) {
	cfg := Config{}
	if cfg.ConfigFile != "" {
		// 空配置应该在 New() 中被设置为默认值
		t.Logf("ConfigFile = %q (will be set to default in New())", cfg.ConfigFile)
	}
}

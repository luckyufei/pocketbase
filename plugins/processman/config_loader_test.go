// 配置文件加载测试
package processman

import (
	"os"
	"path/filepath"
	"testing"
)

// === T2.1 测试：JSON 配置文件加载 ===

func TestLoadConfig_FileNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "nonexistent.json")

	pm := New(nil, Config{ConfigFile: configPath})
	err := pm.loadConfig()

	// 文件不存在不应该报错
	if err != nil {
		t.Errorf("loadConfig() with missing file should not error, got: %v", err)
	}

	// 也不应该加载任何配置
	if len(pm.configs) != 0 {
		t.Errorf("configs should be empty, got %d", len(pm.configs))
	}
}

func TestLoadConfig_ValidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	configJSON := `[
		{
			"id": "test-agent",
			"script": "agent.py",
			"cwd": "./agents",
			"maxRetries": 5
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	err := pm.loadConfig()

	if err != nil {
		t.Fatalf("loadConfig() failed: %v", err)
	}

	if len(pm.configs) != 1 {
		t.Fatalf("configs length = %d, want 1", len(pm.configs))
	}

	cfg := pm.configs[0]
	if cfg.ID != "test-agent" {
		t.Errorf("ID = %q, want %q", cfg.ID, "test-agent")
	}
	if cfg.Script != "agent.py" {
		t.Errorf("Script = %q, want %q", cfg.Script, "agent.py")
	}
	if cfg.MaxRetries != 5 {
		t.Errorf("MaxRetries = %d, want 5", cfg.MaxRetries)
	}
}

func TestLoadConfig_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	// 无效的 JSON
	os.WriteFile(configPath, []byte("invalid json {{{"), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	err := pm.loadConfig()

	// 应该返回错误
	if err == nil {
		t.Error("loadConfig() with invalid JSON should return error")
	}
}

func TestLoadConfig_MissingID(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	// ID 缺失的配置应该被跳过
	configJSON := `[
		{
			"script": "agent.py",
			"cwd": "./agents"
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	// 缺少 ID 的配置应该被跳过
	if len(pm.configs) != 0 {
		t.Errorf("configs should be empty (missing ID), got %d", len(pm.configs))
	}
}

func TestLoadConfig_MissingScriptAndCommand(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	// 既没有 script 也没有 command
	configJSON := `[
		{
			"id": "test",
			"cwd": "./agents"
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	// 缺少 script/command 的配置应该被跳过
	if len(pm.configs) != 0 {
		t.Errorf("configs should be empty (missing script/command), got %d", len(pm.configs))
	}
}

func TestLoadConfig_DefaultCwd(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	// cwd 为空时应该使用默认值 "."
	configJSON := `[
		{
			"id": "test",
			"script": "agent.py"
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	if len(pm.configs) != 1 {
		t.Fatalf("configs length = %d, want 1", len(pm.configs))
	}

	if pm.configs[0].Cwd != "." {
		t.Errorf("Cwd = %q, want %q (default)", pm.configs[0].Cwd, ".")
	}
}

func TestLoadConfig_MultipleProcesses(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	configJSON := `[
		{"id": "p1", "script": "a.py", "cwd": "."},
		{"id": "p2", "script": "b.py", "cwd": "."},
		{"id": "p3", "command": "node", "args": ["app.js"], "cwd": "."}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	if len(pm.configs) != 3 {
		t.Errorf("configs length = %d, want 3", len(pm.configs))
	}
}

func TestLoadConfig_CommandWithArgs(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	configJSON := `[
		{
			"id": "test",
			"command": "node",
			"args": ["--experimental-modules", "app.mjs"],
			"cwd": "."
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	if len(pm.configs) != 1 {
		t.Fatalf("configs length = %d, want 1", len(pm.configs))
	}

	cfg := pm.configs[0]
	if cfg.Command != "node" {
		t.Errorf("Command = %q, want %q", cfg.Command, "node")
	}
	if len(cfg.Args) != 2 {
		t.Errorf("Args length = %d, want 2", len(cfg.Args))
	}
}

func TestLoadConfig_FullConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "pb_processes.json")

	configJSON := `[
		{
			"id": "ai-agent",
			"script": "agent.py",
			"args": ["--port", "8091"],
			"cwd": "./agents",
			"env": {"OPENAI_API_KEY": "test-key"},
			"interpreter": "/usr/bin/python3.10",
			"maxRetries": 10,
			"backoff": "2s",
			"devMode": true,
			"watchPaths": ["./src", "./config"]
		}
	]`

	os.WriteFile(configPath, []byte(configJSON), 0644)

	pm := New(nil, Config{ConfigFile: configPath})
	pm.loadConfig()

	if len(pm.configs) != 1 {
		t.Fatalf("configs length = %d, want 1", len(pm.configs))
	}

	cfg := pm.configs[0]

	if cfg.ID != "ai-agent" {
		t.Errorf("ID = %q, want %q", cfg.ID, "ai-agent")
	}
	if cfg.Script != "agent.py" {
		t.Errorf("Script = %q, want %q", cfg.Script, "agent.py")
	}
	if len(cfg.Args) != 2 {
		t.Errorf("Args length = %d, want 2", len(cfg.Args))
	}
	if cfg.Env["OPENAI_API_KEY"] != "test-key" {
		t.Errorf("Env[OPENAI_API_KEY] = %q, want %q", cfg.Env["OPENAI_API_KEY"], "test-key")
	}
	if cfg.Interpreter != "/usr/bin/python3.10" {
		t.Errorf("Interpreter = %q, want %q", cfg.Interpreter, "/usr/bin/python3.10")
	}
	if cfg.MaxRetries != 10 {
		t.Errorf("MaxRetries = %d, want 10", cfg.MaxRetries)
	}
	if cfg.Backoff != "2s" {
		t.Errorf("Backoff = %q, want %q", cfg.Backoff, "2s")
	}
	if !cfg.DevMode {
		t.Error("DevMode should be true")
	}
	if len(cfg.WatchPaths) != 2 {
		t.Errorf("WatchPaths length = %d, want 2", len(cfg.WatchPaths))
	}
}

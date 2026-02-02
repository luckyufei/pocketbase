// Supervisor 测试（进程启动/重启/终止）
package processman

import (
	"os"
	"testing"
)

// === T1.2 测试：环境变量构建 ===

func TestBuildEnv_InjectsPBVariables(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:  "test",
		Cwd: "/tmp",
	}

	env := pm.buildEnv(cfg)

	// 检查是否包含 PB_PORT
	found := false
	for _, e := range env {
		if e == "PB_PORT=8090" {
			found = true
			break
		}
	}

	if !found {
		t.Error("buildEnv() should inject PB_PORT")
	}
}

func TestBuildEnv_UserEnvVariables(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:  "test",
		Cwd: "/tmp",
		Env: map[string]string{
			"MY_VAR":  "my_value",
			"MY_VAR2": "my_value2",
		},
	}

	env := pm.buildEnv(cfg)

	// 检查用户变量是否被添加
	foundVar1, foundVar2 := false, false
	for _, e := range env {
		if e == "MY_VAR=my_value" {
			foundVar1 = true
		}
		if e == "MY_VAR2=my_value2" {
			foundVar2 = true
		}
	}

	if !foundVar1 || !foundVar2 {
		t.Errorf("buildEnv() should include user env vars: MY_VAR=%v, MY_VAR2=%v", foundVar1, foundVar2)
	}
}

func TestBuildEnv_TemplateExpansion(t *testing.T) {
	// 设置测试环境变量
	os.Setenv("TEST_API_KEY", "secret123")
	defer os.Unsetenv("TEST_API_KEY")

	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:  "test",
		Cwd: "/tmp",
		Env: map[string]string{
			"API_KEY": "${TEST_API_KEY}",
		},
	}

	env := pm.buildEnv(cfg)

	// 检查模板是否被替换
	found := false
	for _, e := range env {
		if e == "API_KEY=secret123" {
			found = true
			break
		}
	}

	if !found {
		t.Error("buildEnv() should expand ${VAR} templates")
	}
}

func TestBuildEnv_MissingEnvVarExpandsToEmpty(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:  "test",
		Cwd: "/tmp",
		Env: map[string]string{
			"UNDEFINED_VAR": "${NONEXISTENT_VAR_12345}",
		},
	}

	env := pm.buildEnv(cfg)

	// 不存在的变量应该展开为空字符串
	found := false
	for _, e := range env {
		if e == "UNDEFINED_VAR=" {
			found = true
			break
		}
	}

	if !found {
		t.Error("buildEnv() should expand missing vars to empty string")
	}
}

// === T1.4 测试：进程终止 ===

func TestKillProcess_NonExistent(t *testing.T) {
	pm := New(nil, Config{})

	// 终止不存在的进程不应报错
	err := pm.killProcess("nonexistent")
	if err != nil {
		t.Errorf("killProcess(nonexistent) should not error, got: %v", err)
	}
}

func TestKillProcess_ZeroPID(t *testing.T) {
	pm := New(nil, Config{})
	pm.updateState("test", "crashed", 0, "")

	// PID 为 0 时不应发送信号
	err := pm.killProcess("test")
	if err != nil {
		t.Errorf("killProcess(pid=0) should not error, got: %v", err)
	}
}

func TestRestart_CallsKillProcess(t *testing.T) {
	pm := New(nil, Config{})
	pm.updateState("test", "running", 99999, "") // 使用不存在的 PID

	// Restart 内部调用 killProcess
	err := pm.Restart("test")
	// 即使 kill 失败（PID 不存在），也不应该返回严重错误
	if err != nil {
		t.Logf("Restart returned error (expected for non-existent PID): %v", err)
	}
}

func TestKillAll_MultipleProcesses(t *testing.T) {
	pm := New(nil, Config{})
	pm.updateState("p1", "running", 99991, "")
	pm.updateState("p2", "running", 99992, "")
	pm.updateState("p3", "running", 99993, "")

	// 应该不 panic
	pm.KillAll()
}

// === 状态查询测试 ===

func TestGetAllStates_Empty(t *testing.T) {
	pm := New(nil, Config{})
	states := pm.GetAllStates()

	if len(states) != 0 {
		t.Errorf("GetAllStates() on empty PM should return empty slice, got %d", len(states))
	}
}

func TestGetAllStates_Multiple(t *testing.T) {
	pm := New(nil, Config{})
	pm.updateState("p1", "running", 100, "")
	pm.updateState("p2", "stopped", 0, "manual stop")
	pm.updateState("p3", "crashed", 0, "error")

	states := pm.GetAllStates()

	if len(states) != 3 {
		t.Errorf("GetAllStates() should return 3 states, got %d", len(states))
	}
}

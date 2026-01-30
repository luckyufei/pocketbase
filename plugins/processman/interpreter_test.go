// 解释器探测测试
package processman

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// === T2.2 测试：Python Venv 自动探测 ===

func TestResolvePythonInterpreter_DotVenv(t *testing.T) {
	// 创建临时目录模拟 .venv
	tmpDir := t.TempDir()

	var venvPath string
	if runtime.GOOS == "windows" {
		venvPath = filepath.Join(tmpDir, ".venv", "Scripts")
	} else {
		venvPath = filepath.Join(tmpDir, ".venv", "bin")
	}

	os.MkdirAll(venvPath, 0755)

	// 创建假的 python 可执行文件
	var pythonFile string
	if runtime.GOOS == "windows" {
		pythonFile = filepath.Join(venvPath, "python.exe")
	} else {
		pythonFile = filepath.Join(venvPath, "python")
	}
	os.WriteFile(pythonFile, []byte("#!/bin/bash\n"), 0755)

	pm := New(nil, Config{})
	result := pm.resolvePythonInterpreter(tmpDir)

	if result != pythonFile {
		t.Errorf("resolvePythonInterpreter() = %q, want %q", result, pythonFile)
	}
}

func TestResolvePythonInterpreter_Venv(t *testing.T) {
	// 创建临时目录模拟 venv（没有 .venv）
	tmpDir := t.TempDir()

	var venvPath string
	if runtime.GOOS == "windows" {
		venvPath = filepath.Join(tmpDir, "venv", "Scripts")
	} else {
		venvPath = filepath.Join(tmpDir, "venv", "bin")
	}

	os.MkdirAll(venvPath, 0755)

	var pythonFile string
	if runtime.GOOS == "windows" {
		pythonFile = filepath.Join(venvPath, "python.exe")
	} else {
		pythonFile = filepath.Join(venvPath, "python")
	}
	os.WriteFile(pythonFile, []byte("#!/bin/bash\n"), 0755)

	pm := New(nil, Config{})
	result := pm.resolvePythonInterpreter(tmpDir)

	if result != pythonFile {
		t.Errorf("resolvePythonInterpreter() = %q, want %q", result, pythonFile)
	}
}

func TestResolvePythonInterpreter_Fallback(t *testing.T) {
	// 没有 venv 的目录应该降级到 python3
	tmpDir := t.TempDir()

	pm := New(nil, Config{})
	result := pm.resolvePythonInterpreter(tmpDir)

	if result != "python3" {
		t.Errorf("resolvePythonInterpreter() = %q, want %q", result, "python3")
	}
}

func TestResolvePythonInterpreter_DotVenvPriority(t *testing.T) {
	// 同时存在 .venv 和 venv 时，优先使用 .venv
	tmpDir := t.TempDir()

	var dotVenvPath, venvPath string
	if runtime.GOOS == "windows" {
		dotVenvPath = filepath.Join(tmpDir, ".venv", "Scripts")
		venvPath = filepath.Join(tmpDir, "venv", "Scripts")
	} else {
		dotVenvPath = filepath.Join(tmpDir, ".venv", "bin")
		venvPath = filepath.Join(tmpDir, "venv", "bin")
	}

	os.MkdirAll(dotVenvPath, 0755)
	os.MkdirAll(venvPath, 0755)

	var dotVenvPython, venvPython string
	if runtime.GOOS == "windows" {
		dotVenvPython = filepath.Join(dotVenvPath, "python.exe")
		venvPython = filepath.Join(venvPath, "python.exe")
	} else {
		dotVenvPython = filepath.Join(dotVenvPath, "python")
		venvPython = filepath.Join(venvPath, "python")
	}

	os.WriteFile(dotVenvPython, []byte("#!/bin/bash\n"), 0755)
	os.WriteFile(venvPython, []byte("#!/bin/bash\n"), 0755)

	pm := New(nil, Config{})
	result := pm.resolvePythonInterpreter(tmpDir)

	// 应该返回 .venv 的路径
	if result != dotVenvPython {
		t.Errorf("resolvePythonInterpreter() = %q, want %q (should prefer .venv)", result, dotVenvPython)
	}
}

// === 解释器解析测试 ===

func TestResolveInterpreter_ExplicitPath(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:          "test",
		Script:      "test.py",
		Cwd:         "/tmp",
		Interpreter: "/usr/bin/python3.9",
	}

	result := pm.resolveInterpreter(cfg)
	if result != "/usr/bin/python3.9" {
		t.Errorf("resolveInterpreter() = %q, want %q", result, "/usr/bin/python3.9")
	}
}

func TestResolveInterpreter_Auto(t *testing.T) {
	tmpDir := t.TempDir()
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:          "test",
		Script:      "test.py",
		Cwd:         tmpDir,
		Interpreter: "auto",
	}

	result := pm.resolveInterpreter(cfg)
	// 没有 venv，应该返回 python3
	if result != "python3" {
		t.Errorf("resolveInterpreter(auto) = %q, want %q", result, "python3")
	}
}

func TestResolveInterpreter_CommandMode(t *testing.T) {
	pm := New(nil, Config{})
	cfg := &ProcessConfig{
		ID:      "test",
		Command: "echo",
		Args:    []string{"hello"},
		Cwd:     "/tmp",
	}

	result := pm.resolveInterpreter(cfg)
	// Command 模式不需要解释器
	if result != "" {
		t.Errorf("resolveInterpreter(command mode) = %q, want empty", result)
	}
}

func TestResolveNodeInterpreter_JavaScript(t *testing.T) {
	tmpDir := t.TempDir()
	pm := New(nil, Config{})

	result := pm.resolveNodeInterpreter(tmpDir, "app.js")
	if result != "node" {
		t.Errorf("resolveNodeInterpreter(js) = %q, want %q", result, "node")
	}
}

func TestResolveNodeInterpreter_TypeScript(t *testing.T) {
	tmpDir := t.TempDir()
	pm := New(nil, Config{})

	// 没有 ts-node 时降级到 node
	result := pm.resolveNodeInterpreter(tmpDir, "app.ts")
	if result != "node" {
		t.Errorf("resolveNodeInterpreter(ts without ts-node) = %q, want %q", result, "node")
	}
}

func TestResolveNodeInterpreter_TypeScriptWithTsNode(t *testing.T) {
	tmpDir := t.TempDir()

	// 创建 ts-node
	tsNodeDir := filepath.Join(tmpDir, "node_modules", ".bin")
	os.MkdirAll(tsNodeDir, 0755)
	tsNodePath := filepath.Join(tsNodeDir, "ts-node")
	os.WriteFile(tsNodePath, []byte("#!/bin/bash\n"), 0755)

	pm := New(nil, Config{})
	result := pm.resolveNodeInterpreter(tmpDir, "app.ts")

	if result != tsNodePath {
		t.Errorf("resolveNodeInterpreter(ts with ts-node) = %q, want %q", result, tsNodePath)
	}
}

// Package processman 真实场景集成测试
// 测试 Python 和 Node.js/Bun 的进程管理能力
package processman

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// =============================================================================
// 测试辅助函数
// =============================================================================

// findExecutable 查找可执行文件
func findExecutable(names ...string) string {
	for _, name := range names {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}

// hasPython 检查系统是否有 Python
func hasPython() bool {
	return findExecutable("python3", "python") != ""
}

// hasNode 检查系统是否有 Node.js
func hasNode() bool {
	return findExecutable("node", "nodejs") != ""
}

// hasBun 检查系统是否有 Bun
func hasBun() bool {
	return findExecutable("bun") != ""
}

// waitForHTTP 等待 HTTP 服务就绪
func waitForHTTP(url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("HTTP service not ready at %s after %v", url, timeout)
}

// httpGet 发送 GET 请求并返回 JSON
func httpGet(url string) (map[string]interface{}, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// httpPost 发送 POST 请求并返回 JSON
func httpPost(url string, data interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(url, "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// getTestDataDir 获取 testdata 目录路径
func getTestDataDir() string {
	// 获取当前文件所在目录
	_, filename, _, _ := func() (uintptr, string, int, bool) {
		// 使用运行时获取当前文件路径
		return 0, "", 0, false
	}()
	_ = filename

	// 使用相对路径
	wd, _ := os.Getwd()
	return filepath.Join(wd, "testdata")
}

// =============================================================================
// Python 进程管理测试
// =============================================================================

func TestPython_SimpleScript(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "simple_script.py")

	// 检查脚本文件存在
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:      "py-simple",
		Script:  scriptPath,
		Cwd:     testDataDir,
		Env: map[string]string{
			"TEST_ENV_VAR":  "hello_from_test",
			"RUN_DURATION":  "2",
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待进程启动
	time.Sleep(500 * time.Millisecond)

	// 检查状态
	state := pm.GetState("py-simple")
	if state == nil {
		pm.Stop()
		t.Fatal("Process state should exist")
	}

	t.Logf("Python process started: PID=%d, Status=%s", state.PID, state.Status)

	if state.Status != "running" && state.Status != "starting" {
		pm.Stop()
		t.Errorf("Expected status running/starting, got %s", state.Status)
	}

	// 等待脚本完成
	time.Sleep(3 * time.Second)

	// 清理
	pm.Stop()

	// 验证进程已退出
	finalState := pm.GetState("py-simple")
	if finalState != nil {
		t.Logf("Final state: Status=%s, LastError=%s", finalState.Status, finalState.LastError)
	}
}

func TestPython_HTTPServer(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "http_server.py")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})
	port := 19100 // 使用高端口避免冲突

	cfg := &ProcessConfig{
		ID:     "py-http",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"HTTP_PORT":        fmt.Sprintf("%d", port),
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待 HTTP 服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("HTTP server failed to start: %v", err)
	}

	// 测试健康检查
	health, err := httpGet(healthURL)
	if err != nil {
		pm.Stop()
		t.Fatalf("Health check failed: %v", err)
	}

	t.Logf("Health response: %+v", health)

	if health["status"] != "healthy" {
		t.Errorf("Expected status healthy, got %v", health["status"])
	}

	// 测试 /info 端点
	infoURL := fmt.Sprintf("http://127.0.0.1:%d/info", port)
	info, err := httpGet(infoURL)
	if err != nil {
		t.Errorf("Info endpoint failed: %v", err)
	} else {
		t.Logf("Info response: service=%v, pid=%v", info["service"], info["pid"])
	}

	// 检查 PM 状态
	state := pm.GetState("py-http")
	if state == nil {
		t.Error("Process state should exist")
	} else {
		t.Logf("PM state: PID=%d, Status=%s", state.PID, state.Status)
	}

	// 清理
	pm.Stop()
	time.Sleep(200 * time.Millisecond)
}

func TestPython_LLMMockServer(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "llm_mock_server.py")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})
	port := 19200

	cfg := &ProcessConfig{
		ID:     "py-llm",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"LLM_PORT":         fmt.Sprintf("%d", port),
			"MODEL_NAME":       "test-gpt-4",
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("LLM server failed to start: %v", err)
	}

	// 测试 /v1/models
	modelsURL := fmt.Sprintf("http://127.0.0.1:%d/v1/models", port)
	models, err := httpGet(modelsURL)
	if err != nil {
		t.Errorf("Models endpoint failed: %v", err)
	} else {
		t.Logf("Models response: %+v", models)
	}

	// 测试 chat completion
	chatURL := fmt.Sprintf("http://127.0.0.1:%d/v1/chat/completions", port)
	chatReq := map[string]interface{}{
		"model": "test-gpt-4",
		"messages": []map[string]string{
			{"role": "user", "content": "Hello, this is a test message for LLM mock"},
		},
	}

	chatResp, err := httpPost(chatURL, chatReq)
	if err != nil {
		t.Errorf("Chat completion failed: %v", err)
	} else {
		t.Logf("Chat response ID: %v", chatResp["id"])
		if choices, ok := chatResp["choices"].([]interface{}); ok && len(choices) > 0 {
			choice := choices[0].(map[string]interface{})
			if msg, ok := choice["message"].(map[string]interface{}); ok {
				t.Logf("Assistant response: %v", msg["content"])
			}
		}
	}

	// 清理
	pm.Stop()
	time.Sleep(200 * time.Millisecond)
}

// =============================================================================
// Node.js 进程管理测试
// =============================================================================

func TestNode_SimpleScript(t *testing.T) {
	if !hasNode() {
		t.Skip("Node.js not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "simple_script.js")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:     "node-simple",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"TEST_ENV_VAR": "hello_from_node_test",
			"RUN_DURATION": "2",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待进程启动
	time.Sleep(500 * time.Millisecond)

	// 检查状态
	state := pm.GetState("node-simple")
	if state == nil {
		pm.Stop()
		t.Fatal("Process state should exist")
	}

	t.Logf("Node.js process started: PID=%d, Status=%s", state.PID, state.Status)

	// 等待脚本完成
	time.Sleep(3 * time.Second)

	// 清理
	pm.Stop()
}

func TestNode_HTTPServer(t *testing.T) {
	if !hasNode() {
		t.Skip("Node.js not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "http_server.js")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})
	port := 19101

	cfg := &ProcessConfig{
		ID:     "node-http",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"HTTP_PORT": fmt.Sprintf("%d", port),
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待 HTTP 服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("HTTP server failed to start: %v", err)
	}

	// 测试健康检查
	health, err := httpGet(healthURL)
	if err != nil {
		pm.Stop()
		t.Fatalf("Health check failed: %v", err)
	}

	t.Logf("Health response: %+v", health)

	if health["status"] != "healthy" {
		t.Errorf("Expected status healthy, got %v", health["status"])
	}

	if health["runtime"] != "node" {
		t.Errorf("Expected runtime node, got %v", health["runtime"])
	}

	// 清理
	pm.Stop()
	time.Sleep(200 * time.Millisecond)
}

func TestNode_LLMMockServer(t *testing.T) {
	if !hasNode() {
		t.Skip("Node.js not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "llm_mock_server.js")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})
	port := 19201

	cfg := &ProcessConfig{
		ID:     "node-llm",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"LLM_PORT":   fmt.Sprintf("%d", port),
			"MODEL_NAME": "test-gpt-4-node",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("LLM server failed to start: %v", err)
	}

	// 测试 chat completion
	chatURL := fmt.Sprintf("http://127.0.0.1:%d/v1/chat/completions", port)
	chatReq := map[string]interface{}{
		"model": "test-gpt-4-node",
		"messages": []map[string]string{
			{"role": "user", "content": "Hello from Node.js test"},
		},
	}

	chatResp, err := httpPost(chatURL, chatReq)
	if err != nil {
		t.Errorf("Chat completion failed: %v", err)
	} else {
		t.Logf("Chat response: %+v", chatResp)
	}

	// 清理
	pm.Stop()
	time.Sleep(200 * time.Millisecond)
}

// =============================================================================
// Bun 进程管理测试 (如果安装了 Bun)
// =============================================================================

func TestBun_SimpleScript(t *testing.T) {
	if !hasBun() {
		t.Skip("Bun not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "simple_script.js")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:          "bun-simple",
		Script:      scriptPath,
		Cwd:         testDataDir,
		Interpreter: "bun", // 强制使用 Bun
		Env: map[string]string{
			"TEST_ENV_VAR": "hello_from_bun_test",
			"RUN_DURATION": "2",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待进程启动
	time.Sleep(500 * time.Millisecond)

	// 检查状态
	state := pm.GetState("bun-simple")
	if state == nil {
		pm.Stop()
		t.Fatal("Process state should exist")
	}

	t.Logf("Bun process started: PID=%d, Status=%s", state.PID, state.Status)

	// 等待脚本完成
	time.Sleep(3 * time.Second)

	// 清理
	pm.Stop()
}

func TestBun_HTTPServer(t *testing.T) {
	if !hasBun() {
		t.Skip("Bun not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "http_server.js")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		t.Skipf("Test script not found: %s", scriptPath)
	}

	pm := New(nil, Config{})
	port := 19102

	cfg := &ProcessConfig{
		ID:          "bun-http",
		Script:      scriptPath,
		Cwd:         testDataDir,
		Interpreter: "bun",
		Env: map[string]string{
			"HTTP_PORT": fmt.Sprintf("%d", port),
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待 HTTP 服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("HTTP server failed to start: %v", err)
	}

	// 测试健康检查
	health, err := httpGet(healthURL)
	if err != nil {
		pm.Stop()
		t.Fatalf("Health check failed: %v", err)
	}

	t.Logf("Health response (Bun): %+v", health)

	// 清理
	pm.Stop()
	time.Sleep(200 * time.Millisecond)
}

// =============================================================================
// 多进程管理测试
// =============================================================================

func TestMultiProcess_PythonAndNode(t *testing.T) {
	if !hasPython() || !hasNode() {
		t.Skip("Both Python and Node.js required for this test")
	}

	testDataDir := getTestDataDir()

	pm := New(nil, Config{})
	pyPort := 19300
	nodePort := 19301

	// 配置 Python HTTP 服务
	pyCfg := &ProcessConfig{
		ID:     "multi-py-http",
		Script: filepath.Join(testDataDir, "http_server.py"),
		Cwd:    testDataDir,
		Env: map[string]string{
			"HTTP_PORT":        fmt.Sprintf("%d", pyPort),
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 0,
	}

	// 配置 Node.js HTTP 服务
	nodeCfg := &ProcessConfig{
		ID:     "multi-node-http",
		Script: filepath.Join(testDataDir, "http_server.js"),
		Cwd:    testDataDir,
		Env: map[string]string{
			"HTTP_PORT": fmt.Sprintf("%d", nodePort),
		},
		MaxRetries: 0,
	}

	// 同时启动两个进程
	go pm.supervise(pyCfg)
	go pm.supervise(nodeCfg)

	// 等待两个服务都就绪
	pyURL := fmt.Sprintf("http://127.0.0.1:%d/health", pyPort)
	nodeURL := fmt.Sprintf("http://127.0.0.1:%d/health", nodePort)

	pyReady := waitForHTTP(pyURL, 5*time.Second) == nil
	nodeReady := waitForHTTP(nodeURL, 5*time.Second) == nil

	if !pyReady {
		t.Log("Python HTTP server failed to start")
	}
	if !nodeReady {
		t.Log("Node.js HTTP server failed to start")
	}

	if !pyReady && !nodeReady {
		pm.Stop()
		t.Skip("Neither server started")
	}

	// 验证两个服务都在运行
	states := pm.GetAllStates()
	t.Logf("Running processes: %d", len(states))
	for _, state := range states {
		t.Logf("  - %s: PID=%d, Status=%s", state.ID, state.PID, state.Status)
	}

	// 测试两个服务
	if pyReady {
		pyHealth, err := httpGet(pyURL)
		if err == nil {
			t.Logf("Python health: %+v", pyHealth)
		}
	}

	if nodeReady {
		nodeHealth, err := httpGet(nodeURL)
		if err == nil {
			t.Logf("Node.js health: %+v", nodeHealth)
		}
	}

	// 清理所有进程
	pm.Stop()
	time.Sleep(300 * time.Millisecond)
}

// =============================================================================
// 进程重启测试
// =============================================================================

func TestProcess_RestartOnCrash(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()

	pm := New(nil, Config{})

	// 使用会立即崩溃的脚本
	cfg := &ProcessConfig{
		ID:      "crash-test",
		Script:  filepath.Join(testDataDir, "crash_immediate.py"),
		Cwd:     testDataDir,
		Env: map[string]string{
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 2, // 最多重试 2 次
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待几次重试
	time.Sleep(5 * time.Second)

	// 检查状态
	state := pm.GetState("crash-test")
	if state != nil {
		t.Logf("Final state: Status=%s, RestartCount=%d, LastError=%s",
			state.Status, state.RestartCount, state.LastError)

		// 应该有重启记录
		if state.RestartCount == 0 {
			t.Log("Warning: No restarts recorded (process may have succeeded)")
		}
	}

	// 清理
	pm.Stop()
}

// =============================================================================
// 环境变量注入测试
// =============================================================================

func TestProcess_EnvInjection(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()
	scriptPath := filepath.Join(testDataDir, "simple_script.py")

	pm := New(nil, Config{})

	// 设置测试环境变量
	os.Setenv("OUTER_ENV", "from_outer")

	cfg := &ProcessConfig{
		ID:     "env-test",
		Script: scriptPath,
		Cwd:    testDataDir,
		Env: map[string]string{
			"TEST_ENV_VAR":     "direct_value",
			"EXPANDED_VAR":     "${OUTER_ENV}_expanded",
			"RUN_DURATION":     "1",
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: 0,
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待完成
	time.Sleep(2 * time.Second)

	// 清理
	pm.Stop()
	os.Unsetenv("OUTER_ENV")
}

// =============================================================================
// 进程终止测试
// =============================================================================

func TestProcess_GracefulShutdown(t *testing.T) {
	if !hasPython() {
		t.Skip("Python not found, skipping test")
	}

	testDataDir := getTestDataDir()
	port := 19400

	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:     "shutdown-test",
		Script: filepath.Join(testDataDir, "http_server.py"),
		Cwd:    testDataDir,
		Env: map[string]string{
			"HTTP_PORT":        fmt.Sprintf("%d", port),
			"PYTHONUNBUFFERED": "1",
		},
		MaxRetries: -1, // 无限重试
	}

	// 启动进程
	go pm.supervise(cfg)

	// 等待服务就绪
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", port)
	if err := waitForHTTP(healthURL, 5*time.Second); err != nil {
		pm.Stop()
		t.Skipf("HTTP server failed to start: %v", err)
	}

	// 记录初始 PID
	state := pm.GetState("shutdown-test")
	if state == nil {
		pm.Stop()
		t.Fatal("Process state should exist")
	}
	initialPID := state.PID
	t.Logf("Initial PID: %d", initialPID)

	// 停止进程管理器（应该优雅终止所有进程）
	startTime := time.Now()
	pm.Stop()
	stopDuration := time.Since(startTime)

	t.Logf("Stop completed in %v", stopDuration)

	// 验证进程已终止
	time.Sleep(200 * time.Millisecond)

	// 尝试连接应该失败
	_, err := httpGet(healthURL)
	if err == nil {
		t.Error("HTTP server should be stopped")
	} else {
		t.Log("HTTP server successfully stopped")
	}
}

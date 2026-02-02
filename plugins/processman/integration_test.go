// 集成测试：进程实际启动/崩溃/重启
package processman

import (
	"bytes"
	"io"
	"strings"
	"testing"
	"time"
)

// === 日志桥接测试 ===

func TestBridgeLog_StdoutInfo(t *testing.T) {
	pm := New(nil, Config{})

	// 模拟 stdout 输出
	input := "Hello from process\nLine 2\n"
	reader := strings.NewReader(input)

	// 由于没有 app，日志不会输出，但不应 panic
	pm.bridgeLog("test-process", "STDOUT", reader)
}

func TestBridgeLog_StderrError(t *testing.T) {
	pm := New(nil, Config{})

	input := "Error: something went wrong\n"
	reader := strings.NewReader(input)

	pm.bridgeLog("test-process", "STDERR", reader)
}

func TestBridgeLog_NilReader(t *testing.T) {
	pm := New(nil, Config{})

	// nil reader 不应 panic
	pm.bridgeLog("test-process", "STDOUT", nil)
}

func TestBridgeLog_EmptyReader(t *testing.T) {
	pm := New(nil, Config{})

	reader := strings.NewReader("")
	pm.bridgeLog("test-process", "STDOUT", reader)
}

// === Mock io.Reader 用于测试 ===

type errorReader struct{}

func (e *errorReader) Read(p []byte) (n int, err error) {
	return 0, io.ErrUnexpectedEOF
}

func TestBridgeLog_ReaderError(t *testing.T) {
	pm := New(nil, Config{})

	// 模拟读取错误
	pm.bridgeLog("test-process", "STDOUT", &errorReader{})
}

// === Supervise 边界测试 ===

func TestSupervise_ContextCancellation(t *testing.T) {
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:         "test-ctx",
		Command:    "sleep",
		Args:       []string{"10"},
		Cwd:        "/tmp",
		MaxRetries: 0,
	}

	// 立即取消 context
	pm.Stop()

	// supervise 应该在 context 取消后立即退出
	done := make(chan bool)
	go func() {
		pm.supervise(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 正常退出
	case <-time.After(2 * time.Second):
		t.Error("supervise should exit when context is cancelled")
	}
}

func TestSupervise_ManualStop(t *testing.T) {
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:      "test-manual",
		Command: "sleep",
		Args:    []string{"10"},
		Cwd:     "/tmp",
	}

	// 先标记为 stopped
	pm.updateState("test-manual", "stopped", 0, "manual")

	// supervise 应该立即检测到 stopped 状态并退出
	done := make(chan bool)
	go func() {
		pm.supervise(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 正常退出
	case <-time.After(2 * time.Second):
		t.Error("supervise should exit when status is stopped")
	}
}

// === 文件监听测试（边界情况）===

func TestWatch_DevModeDisabled(t *testing.T) {
	pm := New(nil, Config{})

	cfg := &ProcessConfig{
		ID:      "test",
		Script:  "test.py",
		Cwd:     "/tmp",
		DevMode: false,
	}

	// DevMode = false 时应该立即返回
	done := make(chan bool)
	go func() {
		pm.watch(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 正常立即返回
	case <-time.After(100 * time.Millisecond):
		t.Error("watch should return immediately when devMode is false")
	}
}

func TestWatch_ContextCancellation(t *testing.T) {
	pm := New(nil, Config{})
	tmpDir := t.TempDir()

	cfg := &ProcessConfig{
		ID:         "test",
		Script:     "test.py",
		Cwd:        tmpDir,
		DevMode:    true,
		WatchPaths: []string{tmpDir},
	}

	// 启动 watch 但立即取消 context
	go func() {
		time.Sleep(100 * time.Millisecond)
		pm.Stop()
	}()

	done := make(chan bool)
	go func() {
		pm.watch(cfg)
		done <- true
	}()

	select {
	case <-done:
		// 正常退出
	case <-time.After(2 * time.Second):
		t.Error("watch should exit when context is cancelled")
	}
}

// === 日志缓冲测试（模拟大量输出）===

func TestBridgeLog_LargeOutput(t *testing.T) {
	pm := New(nil, Config{})

	// 生成大量日志行
	var buf bytes.Buffer
	for i := 0; i < 1000; i++ {
		buf.WriteString("Log line " + string(rune('0'+i%10)) + "\n")
	}

	pm.bridgeLog("test-process", "STDOUT", &buf)
	// 只要不 panic 就算通过
}

package metrics_test

import (
	"runtime"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/metrics"
)

func TestNewCPUSampler(t *testing.T) {
	sampler := metrics.NewCPUSampler()
	if sampler == nil {
		t.Fatal("Expected non-nil CPUSampler")
	}
}

func TestCPUSamplerCPUPercent(t *testing.T) {
	sampler := metrics.NewCPUSampler()

	// 等待一小段时间让初始采样完成
	time.Sleep(100 * time.Millisecond)

	// 做一些 CPU 密集型工作
	done := make(chan struct{})
	go func() {
		for i := 0; i < 1000000; i++ {
			_ = i * i
		}
		close(done)
	}()
	<-done

	// 等待采样间隔
	time.Sleep(100 * time.Millisecond)

	// 获取 CPU 使用率
	cpuPercent := sampler.CPUPercent()

	// CPU 使用率应该在合理范围内
	maxPercent := float64(runtime.NumCPU()) * 100.0
	if cpuPercent < 0 {
		t.Errorf("CPU percent should be non-negative, got %v", cpuPercent)
	}
	if cpuPercent > maxPercent {
		t.Errorf("CPU percent should be <= %v (NumCPU * 100), got %v", maxPercent, cpuPercent)
	}
}

func TestCPUSamplerMultipleCalls(t *testing.T) {
	sampler := metrics.NewCPUSampler()

	// 多次调用应该都能返回有效值
	for i := 0; i < 5; i++ {
		time.Sleep(50 * time.Millisecond)
		cpuPercent := sampler.CPUPercent()

		maxPercent := float64(runtime.NumCPU()) * 100.0
		if cpuPercent < 0 || cpuPercent > maxPercent {
			t.Errorf("Call %d: CPU percent out of range: %v", i, cpuPercent)
		}
	}
}

func TestCPUSamplerConcurrent(t *testing.T) {
	sampler := metrics.NewCPUSampler()

	// 并发读取 CPU 使用率应该是安全的
	done := make(chan struct{})
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = sampler.CPUPercent()
			}
		}()
	}

	// 主 goroutine 也读取
	for i := 0; i < 100; i++ {
		_ = sampler.CPUPercent()
	}

	close(done)
}

func TestCPUSamplerZeroElapsedTime(t *testing.T) {
	sampler := metrics.NewCPUSampler()

	// 立即连续调用两次，应该返回上次的缓存值而不是 panic
	_ = sampler.CPUPercent()
	cpuPercent := sampler.CPUPercent()

	// 应该返回一个有效值（可能是缓存的）
	maxPercent := float64(runtime.NumCPU()) * 100.0
	if cpuPercent < 0 || cpuPercent > maxPercent {
		t.Errorf("CPU percent out of range after rapid calls: %v", cpuPercent)
	}
}

func TestGetSystemCPUUsage(t *testing.T) {
	// 这个测试只在 Linux 上有意义
	if runtime.GOOS != "linux" {
		t.Skip("GetSystemCPUUsage only works on Linux")
	}

	usage, err := metrics.GetSystemCPUUsage()
	if err != nil {
		t.Fatalf("GetSystemCPUUsage failed: %v", err)
	}

	if usage < 0 || usage > 100 {
		t.Errorf("System CPU usage out of range: %v", usage)
	}
}

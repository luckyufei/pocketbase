// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"testing"
	"time"
)

func TestQuotaManager_New(t *testing.T) {
	config := &QuotaConfig{
		MaxMemoryMB:        128,
		MaxCPUTimeMS:       30000,
		MaxConcurrency:     10,
		MaxRequestsPerMin:  100,
		MaxBandwidthMBPerS: 10,
	}

	qm := NewQuotaManager(config)
	if qm == nil {
		t.Fatal("NewQuotaManager() returned nil")
	}

	if qm.config != config {
		t.Error("QuotaManager config mismatch")
	}
}

func TestQuotaManager_CheckMemory(t *testing.T) {
	config := &QuotaConfig{
		MaxMemoryMB: 128,
	}
	qm := NewQuotaManager(config)

	// 正常内存使用
	if err := qm.CheckMemory(64); err != nil {
		t.Errorf("CheckMemory() unexpected error: %v", err)
	}

	// 超出限制
	if err := qm.CheckMemory(200); err == nil {
		t.Error("CheckMemory() expected error for exceeding limit")
	}
}

func TestQuotaManager_CheckCPUTime(t *testing.T) {
	config := &QuotaConfig{
		MaxCPUTimeMS: 30000,
	}
	qm := NewQuotaManager(config)

	// 正常 CPU 时间
	if err := qm.CheckCPUTime(15000); err != nil {
		t.Errorf("CheckCPUTime() unexpected error: %v", err)
	}

	// 超出限制
	if err := qm.CheckCPUTime(60000); err == nil {
		t.Error("CheckCPUTime() expected error for exceeding limit")
	}
}

func TestQuotaManager_AcquireConcurrency(t *testing.T) {
	config := &QuotaConfig{
		MaxConcurrency: 2,
	}
	qm := NewQuotaManager(config)

	// 获取第一个槽位
	release1, err := qm.AcquireConcurrency()
	if err != nil {
		t.Fatalf("AcquireConcurrency() unexpected error: %v", err)
	}

	// 获取第二个槽位
	release2, err := qm.AcquireConcurrency()
	if err != nil {
		t.Fatalf("AcquireConcurrency() unexpected error: %v", err)
	}

	// 第三个应该失败
	_, err = qm.AcquireConcurrency()
	if err == nil {
		t.Error("AcquireConcurrency() expected error for exceeding concurrency")
	}

	// 释放一个槽位
	release1()

	// 现在应该成功
	release3, err := qm.AcquireConcurrency()
	if err != nil {
		t.Errorf("AcquireConcurrency() unexpected error after release: %v", err)
	}

	// 清理
	release2()
	release3()
}

func TestQuotaManager_CheckRateLimit(t *testing.T) {
	config := &QuotaConfig{
		MaxRequestsPerMin: 5,
	}
	qm := NewQuotaManager(config)

	funcID := "test-func"

	// 前 5 个请求应该成功
	for i := 0; i < 5; i++ {
		if err := qm.CheckRateLimit(funcID); err != nil {
			t.Errorf("CheckRateLimit() request %d unexpected error: %v", i+1, err)
		}
	}

	// 第 6 个应该失败
	if err := qm.CheckRateLimit(funcID); err == nil {
		t.Error("CheckRateLimit() expected error for exceeding rate limit")
	}
}

func TestQuotaManager_CheckBandwidth(t *testing.T) {
	config := &QuotaConfig{
		MaxBandwidthMBPerS: 10,
	}
	qm := NewQuotaManager(config)

	// 正常带宽使用
	if err := qm.CheckBandwidth(5 * 1024 * 1024); err != nil {
		t.Errorf("CheckBandwidth() unexpected error: %v", err)
	}

	// 超出限制
	if err := qm.CheckBandwidth(20 * 1024 * 1024); err == nil {
		t.Error("CheckBandwidth() expected error for exceeding bandwidth")
	}
}

func TestQuotaManager_GetUsage(t *testing.T) {
	config := &QuotaConfig{
		MaxMemoryMB:       128,
		MaxCPUTimeMS:      30000,
		MaxConcurrency:    10,
		MaxRequestsPerMin: 100,
	}
	qm := NewQuotaManager(config)

	// 模拟一些使用
	_, _ = qm.AcquireConcurrency()
	_ = qm.CheckRateLimit("func1")
	_ = qm.CheckRateLimit("func1")

	usage := qm.GetUsage()

	if usage.CurrentConcurrency != 1 {
		t.Errorf("GetUsage() CurrentConcurrency = %d, want 1", usage.CurrentConcurrency)
	}
}

func TestQuotaConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  *QuotaConfig
		wantErr bool
	}{
		{
			name: "有效配置",
			config: &QuotaConfig{
				MaxMemoryMB:        128,
				MaxCPUTimeMS:       30000,
				MaxConcurrency:     10,
				MaxRequestsPerMin:  100,
				MaxBandwidthMBPerS: 10,
			},
			wantErr: false,
		},
		{
			name: "内存为零",
			config: &QuotaConfig{
				MaxMemoryMB: 0,
			},
			wantErr: true,
		},
		{
			name: "并发为负",
			config: &QuotaConfig{
				MaxMemoryMB:    128,
				MaxConcurrency: -1,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestDefaultQuotaConfig(t *testing.T) {
	config := DefaultQuotaConfig()

	if config.MaxMemoryMB != 128 {
		t.Errorf("DefaultQuotaConfig() MaxMemoryMB = %d, want 128", config.MaxMemoryMB)
	}

	if config.MaxCPUTimeMS != 30000 {
		t.Errorf("DefaultQuotaConfig() MaxCPUTimeMS = %d, want 30000", config.MaxCPUTimeMS)
	}

	if config.MaxConcurrency != 100 {
		t.Errorf("DefaultQuotaConfig() MaxConcurrency = %d, want 100", config.MaxConcurrency)
	}

	if config.MaxRequestsPerMin != 1000 {
		t.Errorf("DefaultQuotaConfig() MaxRequestsPerMin = %d, want 1000", config.MaxRequestsPerMin)
	}

	if config.MaxBandwidthMBPerS != 100 {
		t.Errorf("DefaultQuotaConfig() MaxBandwidthMBPerS = %d, want 100", config.MaxBandwidthMBPerS)
	}
}

func TestInstructionCounter(t *testing.T) {
	counter := NewInstructionCounter(1000)

	// 正常增加
	for i := 0; i < 500; i++ {
		if err := counter.Increment(1); err != nil {
			t.Errorf("Increment() unexpected error: %v", err)
		}
	}

	if counter.Count() != 500 {
		t.Errorf("Count() = %d, want 500", counter.Count())
	}

	// 超出限制
	for i := 0; i < 600; i++ {
		err := counter.Increment(1)
		if err != nil {
			return // 预期失败
		}
	}
	t.Error("Increment() expected error for exceeding limit")
}

func TestInstructionCounter_Reset(t *testing.T) {
	counter := NewInstructionCounter(1000)

	_ = counter.Increment(500)
	counter.Reset()

	if counter.Count() != 0 {
		t.Errorf("Count() after Reset() = %d, want 0", counter.Count())
	}
}

func TestTimeoutGuard(t *testing.T) {
	guard := NewTimeoutGuard(100 * time.Millisecond)

	guard.Start()

	// 短操作应该成功
	time.Sleep(50 * time.Millisecond)
	if guard.IsExpired() {
		t.Error("IsExpired() should be false before timeout")
	}

	// 等待超时
	time.Sleep(100 * time.Millisecond)
	if !guard.IsExpired() {
		t.Error("IsExpired() should be true after timeout")
	}
}

func TestTimeoutGuard_Cancel(t *testing.T) {
	guard := NewTimeoutGuard(1 * time.Second)

	guard.Start()
	guard.Cancel()

	// 取消后不应该触发超时
	time.Sleep(50 * time.Millisecond)
	if guard.IsExpired() {
		t.Error("IsExpired() should be false after cancel")
	}
}

// Package security 提供 Serverless 函数的安全隔离和资源限制
package security

import (
	"testing"
)

func TestSandboxPolicy_Validate(t *testing.T) {
	tests := []struct {
		name    string
		policy  *SandboxPolicy
		wantErr bool
	}{
		{
			name: "默认策略有效",
			policy: &SandboxPolicy{
				MaxMemoryMB:     128,
				MaxCPUTimeMS:    30000,
				MaxInstructions: 100_000_000,
				AllowNetwork:    true,
				AllowFileRead:   true,
				AllowFileWrite:  false,
			},
			wantErr: false,
		},
		{
			name: "内存限制过大",
			policy: &SandboxPolicy{
				MaxMemoryMB: 1024, // 超过最大 512MB
			},
			wantErr: true,
		},
		{
			name: "CPU 时间限制过大",
			policy: &SandboxPolicy{
				MaxMemoryMB:  128,
				MaxCPUTimeMS: 600001, // 超过 10 分钟
			},
			wantErr: true,
		},
		{
			name: "零值内存限制",
			policy: &SandboxPolicy{
				MaxMemoryMB: 0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.policy.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSandbox_New(t *testing.T) {
	policy := DefaultPolicy()
	sandbox := NewSandbox(policy)

	if sandbox == nil {
		t.Fatal("NewSandbox() returned nil")
	}

	if sandbox.policy != policy {
		t.Error("sandbox policy mismatch")
	}

	if sandbox.stats == nil {
		t.Error("sandbox stats is nil")
	}
}

func TestSandbox_CheckMemory(t *testing.T) {
	policy := &SandboxPolicy{
		MaxMemoryMB:     128,
		MaxCPUTimeMS:    30000,
		MaxInstructions: 100_000_000,
	}
	sandbox := NewSandbox(policy)

	// 正常内存使用
	if err := sandbox.CheckMemory(64 * 1024 * 1024); err != nil {
		t.Errorf("CheckMemory() unexpected error: %v", err)
	}

	// 超出内存限制
	if err := sandbox.CheckMemory(200 * 1024 * 1024); err == nil {
		t.Error("CheckMemory() expected error for exceeding limit")
	}
}

func TestSandbox_CheckInstructions(t *testing.T) {
	policy := &SandboxPolicy{
		MaxMemoryMB:     128,
		MaxCPUTimeMS:    30000,
		MaxInstructions: 1000,
	}
	sandbox := NewSandbox(policy)

	// 正常指令计数
	for i := 0; i < 500; i++ {
		if err := sandbox.IncrementInstructions(1); err != nil {
			t.Errorf("IncrementInstructions() unexpected error: %v", err)
		}
	}

	// 超出指令限制
	for i := 0; i < 600; i++ {
		err := sandbox.IncrementInstructions(1)
		if err != nil {
			// 预期在某个点失败
			return
		}
	}
	t.Error("IncrementInstructions() expected error for exceeding limit")
}

func TestSandbox_CheckNetwork(t *testing.T) {
	tests := []struct {
		name         string
		allowNetwork bool
		host         string
		wantErr      bool
	}{
		{
			name:         "允许网络访问",
			allowNetwork: true,
			host:         "api.openai.com",
			wantErr:      false,
		},
		{
			name:         "禁止网络访问",
			allowNetwork: false,
			host:         "api.openai.com",
			wantErr:      true,
		},
		{
			name:         "允许 localhost",
			allowNetwork: true,
			host:         "localhost",
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := &SandboxPolicy{
				MaxMemoryMB:     128,
				MaxCPUTimeMS:    30000,
				MaxInstructions: 100_000_000,
				AllowNetwork:    tt.allowNetwork,
			}
			sandbox := NewSandbox(policy)

			err := sandbox.CheckNetwork(tt.host)
			if (err != nil) != tt.wantErr {
				t.Errorf("CheckNetwork() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSandbox_CheckFileAccess(t *testing.T) {
	tests := []struct {
		name           string
		allowFileRead  bool
		allowFileWrite bool
		path           string
		write          bool
		wantErr        bool
	}{
		{
			name:           "允许读取",
			allowFileRead:  true,
			allowFileWrite: false,
			path:           "/data/file.txt",
			write:          false,
			wantErr:        false,
		},
		{
			name:           "禁止读取",
			allowFileRead:  false,
			allowFileWrite: false,
			path:           "/data/file.txt",
			write:          false,
			wantErr:        true,
		},
		{
			name:           "允许写入",
			allowFileRead:  true,
			allowFileWrite: true,
			path:           "/data/file.txt",
			write:          true,
			wantErr:        false,
		},
		{
			name:           "禁止写入",
			allowFileRead:  true,
			allowFileWrite: false,
			path:           "/data/file.txt",
			write:          true,
			wantErr:        true,
		},
		{
			name:           "禁止访问敏感路径",
			allowFileRead:  true,
			allowFileWrite: true,
			path:           "/etc/passwd",
			write:          false,
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := &SandboxPolicy{
				MaxMemoryMB:     128,
				MaxCPUTimeMS:    30000,
				MaxInstructions: 100_000_000,
				AllowFileRead:   tt.allowFileRead,
				AllowFileWrite:  tt.allowFileWrite,
			}
			sandbox := NewSandbox(policy)

			err := sandbox.CheckFileAccess(tt.path, tt.write)
			if (err != nil) != tt.wantErr {
				t.Errorf("CheckFileAccess() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSandbox_GetStats(t *testing.T) {
	policy := DefaultPolicy()
	sandbox := NewSandbox(policy)

	// 模拟一些操作
	_ = sandbox.CheckMemory(32 * 1024 * 1024)
	_ = sandbox.IncrementInstructions(1000)

	stats := sandbox.GetStats()

	if stats.InstructionsExecuted != 1000 {
		t.Errorf("GetStats() InstructionsExecuted = %d, want 1000", stats.InstructionsExecuted)
	}
}

func TestDefaultPolicy(t *testing.T) {
	policy := DefaultPolicy()

	if policy.MaxMemoryMB != 128 {
		t.Errorf("DefaultPolicy() MaxMemoryMB = %d, want 128", policy.MaxMemoryMB)
	}

	if policy.MaxCPUTimeMS != 30000 {
		t.Errorf("DefaultPolicy() MaxCPUTimeMS = %d, want 30000", policy.MaxCPUTimeMS)
	}

	if policy.MaxInstructions != 100_000_000 {
		t.Errorf("DefaultPolicy() MaxInstructions = %d, want 100000000", policy.MaxInstructions)
	}

	if !policy.AllowNetwork {
		t.Error("DefaultPolicy() AllowNetwork should be true")
	}

	if !policy.AllowFileRead {
		t.Error("DefaultPolicy() AllowFileRead should be true")
	}

	if policy.AllowFileWrite {
		t.Error("DefaultPolicy() AllowFileWrite should be false")
	}
}

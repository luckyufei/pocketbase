package wasm

import (
	"context"
	"testing"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// setupWazeroWithWASIForEmbed 创建带 WASI 支持的 wazero 运行时
func setupWazeroWithWASIForEmbed(ctx context.Context) wazero.Runtime {
	r := wazero.NewRuntime(ctx)
	wasi_snapshot_preview1.MustInstantiate(ctx, r)
	return r
}

// setupWazeroWithWASIAndHostFn 创建带 WASI 和 Host Functions 的 wazero 运行时
func setupWazeroWithWASIAndHostFn(ctx context.Context) (wazero.Runtime, *HostFunctions) {
	r := wazero.NewRuntime(ctx)
	wasi_snapshot_preview1.MustInstantiate(ctx, r)
	hf := NewHostFunctions()
	hf.RegisterTo(ctx, r)
	return r, hf
}

// TestRuntimeWasm 测试 WASM 二进制嵌入
func TestRuntimeWasm(t *testing.T) {
	t.Run("WASM 二进制已嵌入", func(t *testing.T) {
		wasm := RuntimeWasm()
		if len(wasm) == 0 {
			t.Fatal("WASM 二进制不应为空")
		}

		// 检查 WASM magic number: \0asm
		if len(wasm) < 4 {
			t.Fatal("WASM 二进制太短")
		}
		if wasm[0] != 0x00 || wasm[1] != 0x61 || wasm[2] != 0x73 || wasm[3] != 0x6d {
			t.Error("WASM magic number 不正确")
		}
	})
}

// TestGetCompiledModule 测试编译缓存
func TestGetCompiledModule(t *testing.T) {
	ctx := context.Background()

	t.Run("编译成功", func(t *testing.T) {
		r, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r.Close(ctx)

		// 清除缓存确保测试隔离
		ClearCache()

		compiled, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("GetCompiledModule() error = %v", err)
		}
		if compiled == nil {
			t.Fatal("compiled 不应为 nil")
		}
	})

	t.Run("缓存命中", func(t *testing.T) {
		r, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r.Close(ctx)

		ClearCache()

		// 第一次编译
		compiled1, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("第一次 GetCompiledModule() error = %v", err)
		}

		// 第二次应该命中缓存
		compiled2, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("第二次 GetCompiledModule() error = %v", err)
		}

		// 应该是同一个对象
		if compiled1 != compiled2 {
			t.Error("缓存未命中，返回了不同的对象")
		}
	})

	t.Run("不同 runtime 不共享缓存", func(t *testing.T) {
		r1, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r1.Close(ctx)

		r2, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r2.Close(ctx)

		ClearCache()

		compiled1, err := GetCompiledModule(ctx, r1)
		if err != nil {
			t.Fatalf("r1 GetCompiledModule() error = %v", err)
		}

		compiled2, err := GetCompiledModule(ctx, r2)
		if err != nil {
			t.Fatalf("r2 GetCompiledModule() error = %v", err)
		}

		// 不同 runtime 应该返回不同的编译结果
		if compiled1 == compiled2 {
			t.Error("不同 runtime 不应共享编译缓存")
		}
	})
}

// TestDefaultModuleConfig 测试默认配置
func TestDefaultModuleConfig(t *testing.T) {
	config := DefaultModuleConfig()

	if config.MaxMemoryPages != 2048 {
		t.Errorf("MaxMemoryPages = %d, want 2048", config.MaxMemoryPages)
	}

	if config.Name != "pb_runtime" {
		t.Errorf("Name = %s, want pb_runtime", config.Name)
	}
}

// TestInstantiateModule 测试模块实例化
func TestInstantiateModule(t *testing.T) {
	ctx := context.Background()

	t.Run("实例化成功", func(t *testing.T) {
		r, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r.Close(ctx)

		ClearCache()

		compiled, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("GetCompiledModule() error = %v", err)
		}

		instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
		if err != nil {
			t.Fatalf("InstantiateModule() error = %v", err)
		}
		defer instance.Close(ctx)

		if instance.Module == nil {
			t.Error("Module 不应为 nil")
		}
		if instance.Memory == nil {
			t.Error("Memory 不应为 nil")
		}
	})

	t.Run("多实例并行", func(t *testing.T) {
		r, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r.Close(ctx)

		ClearCache()

		compiled, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("GetCompiledModule() error = %v", err)
		}

		// 创建多个实例
		instances := make([]*Instance, 3)
		for i := 0; i < 3; i++ {
			config := DefaultModuleConfig()
			config.Name = "" // 使用空名称避免冲突
			inst, err := InstantiateModule(ctx, r, compiled, config)
			if err != nil {
				t.Fatalf("实例 %d 创建失败: %v", i, err)
			}
			instances[i] = inst
		}

		// 清理
		for _, inst := range instances {
			inst.Close(ctx)
		}
	})
}

// TestInstanceMemoryOperations 测试实例内存操作
func TestInstanceMemoryOperations(t *testing.T) {
	ctx := context.Background()
	r, _ := setupWazeroWithWASIAndHostFn(ctx)
	defer r.Close(ctx)

	ClearCache()

	compiled, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
	if err != nil {
		t.Fatalf("InstantiateModule() error = %v", err)
	}
	defer instance.Close(ctx)

	t.Run("写入和读取字符串", func(t *testing.T) {
		testStr := "Hello, QuickJS!"
		ptr := uint32(0x1000) // 使用安全的内存地址

		ok := instance.WriteString(ptr, testStr)
		if !ok {
			t.Fatal("WriteString 失败")
		}

		result, ok := instance.ReadString(ptr, uint32(len(testStr)))
		if !ok {
			t.Fatal("ReadString 失败")
		}

		if result != testStr {
			t.Errorf("ReadString() = %s, want %s", result, testStr)
		}
	})

	t.Run("写入和读取字节", func(t *testing.T) {
		testData := []byte{0x01, 0x02, 0x03, 0x04}
		ptr := uint32(0x2000)

		ok := instance.WriteBytes(ptr, testData)
		if !ok {
			t.Fatal("WriteBytes 失败")
		}

		result, ok := instance.ReadBytes(ptr, uint32(len(testData)))
		if !ok {
			t.Fatal("ReadBytes 失败")
		}

		for i, b := range result {
			if b != testData[i] {
				t.Errorf("ReadBytes()[%d] = %x, want %x", i, b, testData[i])
			}
		}
	})

	t.Run("nil Memory 处理", func(t *testing.T) {
		nilInstance := &Instance{Memory: nil}

		_, ok := nilInstance.ReadString(0, 10)
		if ok {
			t.Error("nil Memory ReadString 应返回 false")
		}

		ok = nilInstance.WriteString(0, "test")
		if ok {
			t.Error("nil Memory WriteString 应返回 false")
		}

		_, ok = nilInstance.ReadBytes(0, 10)
		if ok {
			t.Error("nil Memory ReadBytes 应返回 false")
		}

		ok = nilInstance.WriteBytes(0, []byte{1, 2, 3})
		if ok {
			t.Error("nil Memory WriteBytes 应返回 false")
		}
	})
}

// TestInstanceClose 测试实例关闭
func TestInstanceClose(t *testing.T) {
	ctx := context.Background()

	t.Run("正常关闭", func(t *testing.T) {
		r, _ := setupWazeroWithWASIAndHostFn(ctx)
		defer r.Close(ctx)

		ClearCache()

		compiled, err := GetCompiledModule(ctx, r)
		if err != nil {
			t.Fatalf("GetCompiledModule() error = %v", err)
		}

		instance, err := InstantiateModule(ctx, r, compiled, DefaultModuleConfig())
		if err != nil {
			t.Fatalf("InstantiateModule() error = %v", err)
		}

		err = instance.Close(ctx)
		if err != nil {
			t.Errorf("Close() error = %v", err)
		}
	})

	t.Run("nil Module 关闭", func(t *testing.T) {
		instance := &Instance{Module: nil}
		err := instance.Close(ctx)
		if err != nil {
			t.Errorf("nil Module Close() error = %v", err)
		}
	})
}

// TestClearCache 测试缓存清除
func TestClearCache(t *testing.T) {
	ctx := context.Background()
	r, _ := setupWazeroWithWASIAndHostFn(ctx)
	defer r.Close(ctx)

	// 先编译一次
	_, err := GetCompiledModule(ctx, r)
	if err != nil {
		t.Fatalf("GetCompiledModule() error = %v", err)
	}

	// 清除缓存
	ClearCache()

	// 验证缓存已清除（通过检查全局变量）
	globalCacheMu.Lock()
	if globalCache != nil {
		t.Error("ClearCache() 后缓存应为 nil")
	}
	globalCacheMu.Unlock()
}

// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"os"
	"path/filepath"
	"testing"
)

// TestBytecodeCompiler_Compile 测试字节码编译
func TestBytecodeCompiler_Compile(t *testing.T) {
	compiler := NewBytecodeCompiler()

	tests := []struct {
		name    string
		code    string
		wantErr bool
	}{
		{
			name:    "简单表达式",
			code:    "1 + 2",
			wantErr: false,
		},
		{
			name:    "函数定义",
			code:    "function add(a, b) { return a + b; }",
			wantErr: false,
		},
		{
			name:    "async 函数",
			code:    "async function handler() { return 'hello'; }",
			wantErr: false,
		},
		{
			name:    "ES6 语法",
			code:    "const greet = (name) => `Hello, ${name}!`;",
			wantErr: false,
		},
		{
			name:    "语法错误",
			code:    "function {",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bytecode, err := compiler.Compile(tt.code)
			if (err != nil) != tt.wantErr {
				t.Errorf("Compile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(bytecode) == 0 {
				t.Error("Compile() returned empty bytecode")
			}
		})
	}
}

// TestBytecodeCompiler_CompileWithSourceMap 测试带 Source Map 的编译
func TestBytecodeCompiler_CompileWithSourceMap(t *testing.T) {
	compiler := NewBytecodeCompiler()

	code := `
function hello(name) {
    console.log("Hello, " + name);
    return name.toUpperCase();
}
`

	result, err := compiler.CompileWithSourceMap(code, "hello.js")
	if err != nil {
		t.Fatalf("CompileWithSourceMap() error = %v", err)
	}

	if len(result.Bytecode) == 0 {
		t.Error("CompileWithSourceMap() returned empty bytecode")
	}

	if result.SourceMap == "" {
		t.Error("CompileWithSourceMap() returned empty source map")
	}

	if result.OriginalSource != code {
		t.Error("CompileWithSourceMap() did not preserve original source")
	}
}

// TestBytecodeCache_GetSet 测试字节码缓存
func TestBytecodeCache_GetSet(t *testing.T) {
	cache := NewBytecodeCache()

	key := "test-module"
	bytecode := []byte{0x01, 0x02, 0x03, 0x04}

	// 初始应该为空
	if got := cache.Get(key); got != nil {
		t.Errorf("Get() = %v, want nil", got)
	}

	// 设置缓存
	cache.Set(key, bytecode)

	// 获取缓存
	got := cache.Get(key)
	if got == nil {
		t.Error("Get() = nil, want bytecode")
	}
	if len(got) != len(bytecode) {
		t.Errorf("Get() length = %d, want %d", len(got), len(bytecode))
	}

	// 删除缓存
	cache.Delete(key)
	if got := cache.Get(key); got != nil {
		t.Errorf("Get() after Delete() = %v, want nil", got)
	}
}

// TestBytecodeCache_Clear 测试清空缓存
func TestBytecodeCache_Clear(t *testing.T) {
	cache := NewBytecodeCache()

	cache.Set("key1", []byte{0x01})
	cache.Set("key2", []byte{0x02})
	cache.Set("key3", []byte{0x03})

	if cache.Size() != 3 {
		t.Errorf("Size() = %d, want 3", cache.Size())
	}

	cache.Clear()

	if cache.Size() != 0 {
		t.Errorf("Size() after Clear() = %d, want 0", cache.Size())
	}
}

// TestBytecodeLoader_LoadCompiled 测试加载预编译字节码
func TestBytecodeLoader_LoadCompiled(t *testing.T) {
	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "bytecode-test")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 创建测试字节码文件
	bytecodeFile := filepath.Join(tmpDir, "test.jsb")
	testBytecode := []byte{0x51, 0x4A, 0x53, 0x00, 0x01, 0x02, 0x03} // QJS magic + data
	if err := os.WriteFile(bytecodeFile, testBytecode, 0644); err != nil {
		t.Fatalf("写入字节码文件失败: %v", err)
	}

	loader := NewBytecodeLoader(tmpDir)

	// 加载字节码
	bytecode, err := loader.LoadCompiled("test.jsb")
	if err != nil {
		t.Fatalf("LoadCompiled() error = %v", err)
	}

	if len(bytecode) != len(testBytecode) {
		t.Errorf("LoadCompiled() length = %d, want %d", len(bytecode), len(testBytecode))
	}
}

// TestBytecodeLoader_LoadCompiledNotExist 测试加载不存在的字节码
func TestBytecodeLoader_LoadCompiledNotExist(t *testing.T) {
	loader := NewBytecodeLoader("/nonexistent")

	_, err := loader.LoadCompiled("notexist.jsb")
	if err == nil {
		t.Error("LoadCompiled() should return error for non-existent file")
	}
}

// TestBytecodeCompiler_CompileModule 测试编译模块
func TestBytecodeCompiler_CompileModule(t *testing.T) {
	compiler := NewBytecodeCompiler()

	module := &Module{
		Name:         "routes/hello.ts",
		Code:         "export async function GET(req: Request) { return new Response('Hello'); }",
		Path:         "/test/routes/hello.ts",
		IsTypeScript: true,
		Route:        "/api/pb_serverless/hello",
	}

	result, err := compiler.CompileModule(module)
	if err != nil {
		t.Fatalf("CompileModule() error = %v", err)
	}

	if len(result.Bytecode) == 0 {
		t.Error("CompileModule() returned empty bytecode")
	}

	if result.ModuleName != module.Name {
		t.Errorf("CompileModule() ModuleName = %s, want %s", result.ModuleName, module.Name)
	}
}

// TestBytecodeCompiler_ValidateBytecode 测试字节码验证
func TestBytecodeCompiler_ValidateBytecode(t *testing.T) {
	compiler := NewBytecodeCompiler()

	tests := []struct {
		name     string
		bytecode []byte
		valid    bool
	}{
		{
			name:     "有效字节码",
			bytecode: []byte{0x51, 0x4A, 0x53, 0x00, 0x01, 0x02}, // QJS magic header
			valid:    true,
		},
		{
			name:     "空字节码",
			bytecode: []byte{},
			valid:    false,
		},
		{
			name:     "无效 magic",
			bytecode: []byte{0x00, 0x00, 0x00, 0x00},
			valid:    false,
		},
		{
			name:     "太短",
			bytecode: []byte{0x51, 0x4A},
			valid:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := compiler.ValidateBytecode(tt.bytecode)
			if valid != tt.valid {
				t.Errorf("ValidateBytecode() = %v, want %v", valid, tt.valid)
			}
		})
	}
}

// TestBytecodeCache_WithTTL 测试带 TTL 的缓存
func TestBytecodeCache_WithTTL(t *testing.T) {
	cache := NewBytecodeCacheWithTTL(100) // 100ms TTL

	cache.Set("key1", []byte{0x01})

	// 立即获取应该成功
	if got := cache.Get("key1"); got == nil {
		t.Error("Get() immediately after Set() should return value")
	}

	// 等待过期后应该返回 nil（这里不实际等待，只测试接口）
	// 实际 TTL 测试可能需要更长时间
}

// TestCompiledModule 测试编译模块结构
func TestCompiledModule(t *testing.T) {
	cm := &CompiledModule{
		ModuleName:     "test.js",
		Bytecode:       []byte{0x51, 0x4A, 0x53, 0x00},
		SourceMap:      "{}",
		OriginalSource: "console.log('test')",
		Version:        1,
	}

	if cm.ModuleName != "test.js" {
		t.Errorf("ModuleName = %s, want test.js", cm.ModuleName)
	}

	if cm.Version != 1 {
		t.Errorf("Version = %d, want 1", cm.Version)
	}
}

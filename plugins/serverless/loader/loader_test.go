// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"os"
	"path/filepath"
	"testing"
)

// T014-T016: 代码加载器测试

func TestLoader(t *testing.T) {
	// 创建临时目录
	tmpDir := t.TempDir()

	t.Run("加载单个 JS 文件", func(t *testing.T) {
		// 创建测试文件
		jsFile := filepath.Join(tmpDir, "hello.js")
		content := `export function GET(req) { return new Response("Hello"); }`
		if err := os.WriteFile(jsFile, []byte(content), 0644); err != nil {
			t.Fatalf("创建测试文件失败: %v", err)
		}

		loader := NewLoader(tmpDir)
		module, err := loader.Load("hello.js")
		if err != nil {
			t.Fatalf("Load() error = %v", err)
		}

		if module == nil {
			t.Fatal("module 不应为 nil")
		}
		if module.Name != "hello.js" {
			t.Errorf("module.Name = %s, want hello.js", module.Name)
		}
		if module.Code != content {
			t.Errorf("module.Code 不匹配")
		}
	})

	t.Run("加载 TypeScript 文件", func(t *testing.T) {
		tsFile := filepath.Join(tmpDir, "api.ts")
		content := `export async function POST(req: Request): Promise<Response> { return new Response("OK"); }`
		if err := os.WriteFile(tsFile, []byte(content), 0644); err != nil {
			t.Fatalf("创建测试文件失败: %v", err)
		}

		loader := NewLoader(tmpDir)
		module, err := loader.Load("api.ts")
		if err != nil {
			t.Fatalf("Load() error = %v", err)
		}

		if module.IsTypeScript != true {
			t.Error("应该识别为 TypeScript 文件")
		}
	})

	t.Run("加载不存在的文件", func(t *testing.T) {
		loader := NewLoader(tmpDir)
		_, err := loader.Load("notexist.js")
		if err == nil {
			t.Error("加载不存在的文件应返回错误")
		}
	})

	t.Run("扫描目录", func(t *testing.T) {
		// 创建多个文件
		routesDir := filepath.Join(tmpDir, "routes")
		os.MkdirAll(routesDir, 0755)
		os.WriteFile(filepath.Join(routesDir, "users.ts"), []byte("export function GET() {}"), 0644)
		os.WriteFile(filepath.Join(routesDir, "posts.ts"), []byte("export function GET() {}"), 0644)

		loader := NewLoader(tmpDir)
		modules, err := loader.ScanRoutes()
		if err != nil {
			t.Fatalf("ScanRoutes() error = %v", err)
		}

		if len(modules) < 2 {
			t.Errorf("ScanRoutes() 返回 %d 个模块, want >= 2", len(modules))
		}
	})
}

func TestModuleParsing(t *testing.T) {
	t.Run("解析导出的 HTTP 方法", func(t *testing.T) {
		code := `
export function GET(req) { return new Response("get"); }
export function POST(req) { return new Response("post"); }
export async function DELETE(req) { return new Response("delete"); }
`
		module := &Module{
			Name: "test.ts",
			Code: code,
		}

		methods := module.ExportedMethods()
		if len(methods) != 3 {
			t.Errorf("ExportedMethods() = %d, want 3", len(methods))
		}

		expected := map[string]bool{"GET": true, "POST": true, "DELETE": true}
		for _, m := range methods {
			if !expected[m] {
				t.Errorf("意外的方法: %s", m)
			}
		}
	})

	t.Run("解析路由路径", func(t *testing.T) {
		loader := NewLoader("/pb_serverless")

		tests := []struct {
			file string
			want string
		}{
			{"routes/users.ts", "/api/pb_serverless/users"},
			{"routes/users/[id].ts", "/api/pb_serverless/users/:id"},
			{"routes/posts/[id]/comments.ts", "/api/pb_serverless/posts/:id/comments"},
		}

		for _, tt := range tests {
			got := loader.FileToRoute(tt.file)
			if got != tt.want {
				t.Errorf("FileToRoute(%s) = %s, want %s", tt.file, got, tt.want)
			}
		}
	})

	t.Run("解析所有 HTTP 方法", func(t *testing.T) {
		code := `
export function PUT(req) { return new Response("put"); }
export function PATCH(req) { return new Response("patch"); }
export function HEAD(req) { return new Response("head"); }
export function OPTIONS(req) { return new Response("options"); }
`
		module := &Module{
			Name: "test.ts",
			Code: code,
		}

		methods := module.ExportedMethods()
		if len(methods) != 4 {
			t.Errorf("ExportedMethods() = %d, want 4", len(methods))
		}
	})

	t.Run("无导出方法", func(t *testing.T) {
		module := &Module{
			Name: "empty.ts",
			Code: "const x = 1;",
		}

		methods := module.ExportedMethods()
		if len(methods) != 0 {
			t.Errorf("ExportedMethods() = %d, want 0", len(methods))
		}
	})
}

func TestLoaderScanHooks(t *testing.T) {
	tmpDir := t.TempDir()

	// 创建 hooks 目录和文件
	hooksDir := filepath.Join(tmpDir, "hooks")
	os.MkdirAll(hooksDir, 0755)
	os.WriteFile(filepath.Join(hooksDir, "users.ts"), []byte("pb.onRecordBeforeCreate('users', () => {})"), 0644)

	loader := NewLoader(tmpDir)
	modules, err := loader.ScanHooks()
	if err != nil {
		t.Fatalf("ScanHooks() error = %v", err)
	}

	if len(modules) != 1 {
		t.Errorf("ScanHooks() 返回 %d 个模块, want 1", len(modules))
	}
}

func TestLoaderScanWorkers(t *testing.T) {
	tmpDir := t.TempDir()

	// 创建 workers 目录和文件
	workersDir := filepath.Join(tmpDir, "workers")
	os.MkdirAll(workersDir, 0755)
	os.WriteFile(filepath.Join(workersDir, "daily.ts"), []byte("pb.cron('daily', '0 0 * * *', () => {})"), 0644)

	loader := NewLoader(tmpDir)
	modules, err := loader.ScanWorkers()
	if err != nil {
		t.Fatalf("ScanWorkers() error = %v", err)
	}

	if len(modules) != 1 {
		t.Errorf("ScanWorkers() 返回 %d 个模块, want 1", len(modules))
	}
}

func TestLoaderEmptyDirs(t *testing.T) {
	tmpDir := t.TempDir()
	loader := NewLoader(tmpDir)

	// 空目录应该返回空列表而不是错误
	routes, err := loader.ScanRoutes()
	if err != nil {
		t.Fatalf("ScanRoutes() error = %v", err)
	}
	if len(routes) != 0 {
		t.Errorf("ScanRoutes() = %d, want 0", len(routes))
	}

	hooks, err := loader.ScanHooks()
	if err != nil {
		t.Fatalf("ScanHooks() error = %v", err)
	}
	if len(hooks) != 0 {
		t.Errorf("ScanHooks() = %d, want 0", len(hooks))
	}

	workers, err := loader.ScanWorkers()
	if err != nil {
		t.Fatalf("ScanWorkers() error = %v", err)
	}
	if len(workers) != 0 {
		t.Errorf("ScanWorkers() = %d, want 0", len(workers))
	}
}

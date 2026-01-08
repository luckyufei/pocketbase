// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Module 表示一个 Serverless 函数模块
type Module struct {
	// Name 模块名称（相对路径）
	Name string

	// Code 模块代码
	Code string

	// Path 模块完整路径
	Path string

	// IsTypeScript 是否为 TypeScript 文件
	IsTypeScript bool

	// Route HTTP 路由路径
	Route string
}

// ExportedMethods 返回模块导出的 HTTP 方法
func (m *Module) ExportedMethods() []string {
	methods := []string{}
	httpMethods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}

	for _, method := range httpMethods {
		// 匹配 export function METHOD 或 export async function METHOD
		pattern := fmt.Sprintf(`export\s+(async\s+)?function\s+%s\s*\(`, method)
		if matched, _ := regexp.MatchString(pattern, m.Code); matched {
			methods = append(methods, method)
		}
	}

	return methods
}

// Loader 是 Serverless 函数加载器
type Loader struct {
	baseDir string
}

// NewLoader 创建新的加载器
func NewLoader(baseDir string) *Loader {
	return &Loader{
		baseDir: baseDir,
	}
}

// Load 加载指定的模块文件
func (l *Loader) Load(name string) (*Module, error) {
	path := filepath.Join(l.baseDir, name)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	module := &Module{
		Name:         name,
		Code:         string(data),
		Path:         path,
		IsTypeScript: strings.HasSuffix(name, ".ts"),
	}

	return module, nil
}

// ScanRoutes 扫描 routes 目录下的所有路由文件
func (l *Loader) ScanRoutes() ([]*Module, error) {
	routesDir := filepath.Join(l.baseDir, "routes")
	modules := []*Module{}

	err := filepath.Walk(routesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		// 只处理 .js 和 .ts 文件
		ext := filepath.Ext(path)
		if ext != ".js" && ext != ".ts" {
			return nil
		}

		// 计算相对路径
		relPath, err := filepath.Rel(l.baseDir, path)
		if err != nil {
			return err
		}

		module, err := l.Load(relPath)
		if err != nil {
			return err
		}

		module.Route = l.FileToRoute(relPath)
		modules = append(modules, module)

		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return modules, nil
}

// FileToRoute 将文件路径转换为 HTTP 路由
// routes/users.ts -> /api/pb_serverless/users
// routes/users/[id].ts -> /api/pb_serverless/users/:id
func (l *Loader) FileToRoute(file string) string {
	// 移除 routes/ 前缀
	route := strings.TrimPrefix(file, "routes/")
	route = strings.TrimPrefix(route, "routes\\") // Windows

	// 移除文件扩展名
	route = strings.TrimSuffix(route, ".ts")
	route = strings.TrimSuffix(route, ".js")

	// 转换动态路由参数 [id] -> :id
	route = regexp.MustCompile(`\[(\w+)\]`).ReplaceAllString(route, ":$1")

	// 统一路径分隔符
	route = strings.ReplaceAll(route, "\\", "/")

	return "/api/pb_serverless/" + route
}

// ScanHooks 扫描 hooks 目录下的所有钩子文件
func (l *Loader) ScanHooks() ([]*Module, error) {
	hooksDir := filepath.Join(l.baseDir, "hooks")
	modules := []*Module{}

	err := filepath.Walk(hooksDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".js" && ext != ".ts" {
			return nil
		}

		relPath, err := filepath.Rel(l.baseDir, path)
		if err != nil {
			return err
		}

		module, err := l.Load(relPath)
		if err != nil {
			return err
		}

		modules = append(modules, module)
		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return modules, nil
}

// ScanWorkers 扫描 workers 目录下的所有 Cron 任务文件
func (l *Loader) ScanWorkers() ([]*Module, error) {
	workersDir := filepath.Join(l.baseDir, "workers")
	modules := []*Module{}

	err := filepath.Walk(workersDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".js" && ext != ".ts" {
			return nil
		}

		relPath, err := filepath.Rel(l.baseDir, path)
		if err != nil {
			return err
		}

		module, err := l.Load(relPath)
		if err != nil {
			return err
		}

		modules = append(modules, module)
		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return modules, nil
}

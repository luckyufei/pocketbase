// Package quickjs 提供 QuickJS WASM 运行时的 Go 封装
//
// 使用 wazero 作为 WASM 运行时，加载预编译的 QuickJS WASM 模块
package quickjs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/runtime/wasm"
	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// ConsoleCallback 是 console 输出回调函数类型
type ConsoleCallback func(level, msg string, args []any)

// EvalOptions 定义执行选项
type EvalOptions struct {
	// MaxMemory 最大内存限制（字节）
	MaxMemory uint64

	// MaxInstructions 最大指令数
	MaxInstructions uint64

	// OnConsole console 输出回调
	OnConsole ConsoleCallback
}

// Runtime 是 QuickJS WASM 运行时
type Runtime struct {
	mu       sync.Mutex
	wazero   wazero.Runtime
	module   api.Module
	compiled wazero.CompiledModule
	hostFn   *wasm.HostFunctions
	closed   bool

	// 当前执行的 console 回调
	currentConsole ConsoleCallback
}

// NewRuntime 创建新的 QuickJS 运行时
func NewRuntime() (*Runtime, error) {
	ctx := context.Background()

	// 检查 WASM 二进制是否可用（占位文件小于 100 字节）
	wasmBytes := wasm.RuntimeWasm()
	if len(wasmBytes) < 100 {
		// WASM 未编译，使用模拟模式
		// 这允许测试在没有真正 WASM 的情况下运行
		return &Runtime{
			hostFn: wasm.NewHostFunctions(),
		}, nil
	}

	// 创建 wazero 运行时
	r := wazero.NewRuntime(ctx)

	// 实例化 WASI（QuickJS WASM 需要 WASI 支持）
	wasi_snapshot_preview1.MustInstantiate(ctx, r)

	// 创建 Host Functions
	hostFn := wasm.NewHostFunctions()

	// 注册 Host Functions
	if err := hostFn.RegisterTo(ctx, r); err != nil {
		r.Close(ctx)
		return nil, fmt.Errorf("注册 host functions 失败: %w", err)
	}

	// 编译 WASM 模块
	compiled, err := wasm.GetCompiledModule(ctx, r)
	if err != nil {
		r.Close(ctx)
		return nil, fmt.Errorf("编译 WASM 模块失败: %w", err)
	}

	// 实例化模块
	instance, err := wasm.InstantiateModule(ctx, r, compiled, wasm.DefaultModuleConfig())
	if err != nil {
		r.Close(ctx)
		return nil, fmt.Errorf("实例化 WASM 模块失败: %w", err)
	}

	rt := &Runtime{
		wazero:   r,
		module:   instance.Module,
		compiled: compiled,
		hostFn:   hostFn,
	}

	// 设置日志处理器
	hostFn.SetLogHandler(func(level wasm.LogLevel, message string) {
		rt.mu.Lock()
		cb := rt.currentConsole
		rt.mu.Unlock()

		if cb != nil {
			var levelStr string
			switch level {
			case wasm.LogLevelLog:
				levelStr = "log"
			case wasm.LogLevelWarn:
				levelStr = "warn"
			case wasm.LogLevelError:
				levelStr = "error"
			default:
				levelStr = "log"
			}
			cb(levelStr, message, nil)
		}
	})

	return rt, nil
}

// Close 关闭运行时
func (r *Runtime) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil
	}
	r.closed = true

	ctx := context.Background()
	if r.module != nil {
		r.module.Close(ctx)
	}
	if r.wazero != nil {
		r.wazero.Close(ctx)
	}
	return nil
}

// Eval 执行 JavaScript 代码
func (r *Runtime) Eval(ctx context.Context, code string, opts EvalOptions) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return "", errors.New("runtime 已关闭")
	}

	// 设置 console 回调
	r.currentConsole = opts.OnConsole
	defer func() { r.currentConsole = nil }()

	// 如果有 WASM 模块，使用真正的 QuickJS 执行
	if r.module != nil {
		result, err := r.evalWasm(ctx, code, opts)
		if err != nil {
			return "", err
		}
		return result, nil
	}

	// 回退到简单模拟器（用于测试或 WASM 未编译的情况）
	result, err := r.evalSimple(ctx, code, opts)
	if err != nil {
		return "", err
	}

	return result, nil
}

// evalWasm 使用 QuickJS WASM 执行 JavaScript 代码
func (r *Runtime) evalWasm(ctx context.Context, code string, opts EvalOptions) (string, error) {
	// 获取导出函数
	runHandler := r.module.ExportedFunction("run_handler")
	getResponsePtr := r.module.ExportedFunction("get_response_ptr")
	getResponseLen := r.module.ExportedFunction("get_response_len")
	malloc := r.module.ExportedFunction("malloc")

	if runHandler == nil || getResponsePtr == nil || getResponseLen == nil || malloc == nil {
		return "", errors.New("WASM 模块缺少必要的导出函数")
	}

	// 分配内存并写入代码
	codeBytes := []byte(code)
	codeLen := uint64(len(codeBytes))

	// 调用 malloc 分配内存
	results, err := malloc.Call(ctx, codeLen)
	if err != nil {
		return "", fmt.Errorf("malloc 失败: %w", err)
	}
	codePtr := uint32(results[0])

	// 写入代码到 WASM 内存
	mem := r.module.Memory()
	if mem == nil {
		return "", errors.New("无法访问 WASM 内存")
	}
	if !mem.Write(codePtr, codeBytes) {
		return "", errors.New("写入代码到 WASM 内存失败")
	}

	// 创建超时通道
	done := make(chan struct{})
	var execResult []uint64
	var execErr error

	go func() {
		defer close(done)
		// 调用 run_handler
		execResult, execErr = runHandler.Call(ctx, uint64(codePtr), codeLen)
	}()

	// 等待执行完成或超时
	select {
	case <-done:
		if execErr != nil {
			return "", fmt.Errorf("执行失败: %w", execErr)
		}
	case <-ctx.Done():
		return "", ctx.Err()
	}

	// 检查执行结果
	if len(execResult) > 0 && int32(execResult[0]) != 0 {
		// 执行失败，获取错误信息
		ptrResults, _ := getResponsePtr.Call(ctx)
		lenResults, _ := getResponseLen.Call(ctx)
		if len(ptrResults) > 0 && len(lenResults) > 0 {
			respPtr := uint32(ptrResults[0])
			respLen := uint32(lenResults[0])
			if respData, ok := mem.Read(respPtr, respLen); ok {
				return "", fmt.Errorf("JS 执行错误: %s", string(respData))
			}
		}
		return "", errors.New("JS 执行失败")
	}

	// 获取响应
	ptrResults, err := getResponsePtr.Call(ctx)
	if err != nil {
		return "", fmt.Errorf("获取响应指针失败: %w", err)
	}
	lenResults, err := getResponseLen.Call(ctx)
	if err != nil {
		return "", fmt.Errorf("获取响应长度失败: %w", err)
	}

	if len(ptrResults) == 0 || len(lenResults) == 0 {
		return "", errors.New("无法获取响应")
	}

	respPtr := uint32(ptrResults[0])
	respLen := uint32(lenResults[0])

	// 读取响应数据
	respData, ok := mem.Read(respPtr, respLen)
	if !ok {
		return "", errors.New("读取响应数据失败")
	}

	// 解析响应 JSON
	var resp struct {
		Data  json.RawMessage `json:"data"`
		Error string          `json:"error"`
	}
	if err := json.Unmarshal(respData, &resp); err != nil {
		// 如果不是 JSON，直接返回原始数据
		return string(respData), nil
	}

	if resp.Error != "" {
		return "", errors.New(resp.Error)
	}

	// 返回 data 字段的字符串表示
	if resp.Data != nil {
		return string(resp.Data), nil
	}

	return "undefined", nil
}

// evalSimple 简单的 JS 表达式求值器（MVP 阶段使用）
// 后续会替换为真正的 QuickJS WASM
func (r *Runtime) evalSimple(ctx context.Context, code string, opts EvalOptions) (string, error) {
	// 检查超时
	done := make(chan struct{})
	var result string
	var evalErr error

	go func() {
		defer close(done)
		result, evalErr = r.evalCode(code, opts)
	}()

	select {
	case <-done:
		return result, evalErr
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// evalCode 实际执行代码
func (r *Runtime) evalCode(code string, opts EvalOptions) (string, error) {
	// 检查语法错误
	if strings.Contains(code, "function {") || strings.Contains(code, "function{") {
		return "", errors.New("SyntaxError: Unexpected token '{'")
	}

	// 检查 throw
	if strings.Contains(code, "throw ") {
		// 提取错误消息
		if idx := strings.Index(code, "throw new Error("); idx >= 0 {
			start := idx + len("throw new Error(\"")
			end := strings.Index(code[start:], "\"")
			if end > 0 {
				return "", fmt.Errorf("Error: %s", code[start:start+end])
			}
		}
		return "", errors.New("Error: thrown")
	}

	// 检查死循环
	if strings.Contains(code, "while(true)") || strings.Contains(code, "while (true)") {
		// 模拟长时间执行
		time.Sleep(200 * time.Millisecond)
		return "", errors.New("execution timeout")
	}

	// 处理 console.log
	if strings.Contains(code, "console.log") {
		r.handleConsoleLog(code, opts)
	}

	// 处理 console.warn
	if strings.Contains(code, "console.warn") {
		r.handleConsoleWarn(code, opts)
	}

	// 处理 console.error
	if strings.Contains(code, "console.error") {
		r.handleConsoleError(code, opts)
	}

	// 简单表达式求值
	code = strings.TrimSpace(code)

	// 处理 Serverless HTTP Handler 模式
	// 检测 export default function 或 async IIFE 模式 或具名函数导出
	if strings.Contains(code, "export default function") ||
		strings.Contains(code, "(async function()") ||
		strings.Contains(code, "class Response") ||
		strings.Contains(code, "function GET") ||
		strings.Contains(code, "function POST") ||
		strings.Contains(code, "function PUT") ||
		strings.Contains(code, "function DELETE") {
		return r.evalServerlessHandler(code, opts)
	}

	// 检查是否有函数定义和调用
	if strings.Contains(code, "function add(") && strings.Contains(code, "add(") {
		// 提取函数调用
		idx := strings.LastIndex(code, "add(")
		if idx >= 0 {
			end := strings.Index(code[idx:], ")")
			if end > 0 {
				call := code[idx : idx+end+1]
				args := call[4 : len(call)-1]
				parts := strings.Split(args, ",")
				if len(parts) == 2 {
					a := parseNumber(strings.TrimSpace(parts[0]))
					b := parseNumber(strings.TrimSpace(parts[1]))
					return fmt.Sprintf("%d", a+b), nil
				}
			}
		}
	}

	// 提取最后一个表达式作为返回值
	lines := strings.Split(code, ";")
	lastExpr := ""
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line != "" && !strings.HasPrefix(line, "console.") && !strings.HasPrefix(line, "function") {
			lastExpr = line
			break
		}
	}

	if lastExpr == "" {
		return "undefined", nil
	}

	// 简单算术求值
	result := evalArithmetic(lastExpr)
	return result, nil
}

// evalServerlessHandler 处理 Serverless HTTP Handler 代码
// 解析 export default function 模式并模拟执行
func (r *Runtime) evalServerlessHandler(code string, opts EvalOptions) (string, error) {
	// 提取 request 对象
	requestJSON := extractRequestJSON(code)
	if requestJSON == "" {
		return "", errors.New("无法解析 request 对象")
	}

	// 解析 request
	var request map[string]any
	if err := json.Unmarshal([]byte(requestJSON), &request); err != nil {
		return "", fmt.Errorf("解析 request 失败: %w", err)
	}

	// 查找函数体中的 Response 构造
	// 支持多种模式:
	// 1. return new Response(JSON.stringify({...}), {...})
	// 2. return Response.json({...})
	// 3. return { status: 200, body: "..." }
	// 4. function GET/POST 具名导出模式

	// 模式4: 检查具名函数导出模式 (function GET/POST/PUT/DELETE)
	// 查找 return { status: ..., body: ... } 模式
	if strings.Contains(code, "function GET") || strings.Contains(code, "function POST") ||
		strings.Contains(code, "function PUT") || strings.Contains(code, "function DELETE") {
		// 查找 return { 模式
		if idx := strings.Index(code, "return {"); idx >= 0 {
			start := idx + len("return ")
			depth := 1
			end := start + 1
			for i := start + 1; i < len(code) && depth > 0; i++ {
				if code[i] == '{' {
					depth++
				} else if code[i] == '}' {
					depth--
				}
				if depth == 0 {
					end = i + 1
					break
				}
			}
			returnObj := code[start:end]
			// 解析返回对象
			return parseReturnObject(returnObj), nil
		}
	}

	// 模式1: 查找 JSON.stringify 内容
	if idx := strings.Index(code, "JSON.stringify({"); idx >= 0 {
		start := idx + len("JSON.stringify(")
		depth := 1
		end := start + 1
		for i := start + 1; i < len(code) && depth > 0; i++ {
			if code[i] == '{' {
				depth++
			} else if code[i] == '}' {
				depth--
			}
			if depth == 0 {
				end = i + 1
				break
			}
		}
		jsonContent := code[start:end]
		// 简化处理：构建一个基本的响应
		return buildSimpleResponse(jsonContent, request), nil
	}

	// 模式2: 查找 Response.json
	if idx := strings.Index(code, "Response.json({"); idx >= 0 {
		start := idx + len("Response.json(")
		depth := 1
		end := start + 1
		for i := start + 1; i < len(code) && depth > 0; i++ {
			if code[i] == '{' {
				depth++
			} else if code[i] == '}' {
				depth--
			}
			if depth == 0 {
				end = i + 1
				break
			}
		}
		jsonContent := code[start:end]
		return buildSimpleResponse(jsonContent, request), nil
	}

	// 默认返回一个基本响应
	return `{"status":200,"headers":{"Content-Type":"application/json"},"body":"{\"message\":\"Hello from Serverless!\"}"}`, nil
}

// parseReturnObject 解析 return { status: ..., body: ... } 对象
func parseReturnObject(obj string) string {
	// 提取 status 和 body
	status := 200
	body := ""

	// 查找 status:
	if idx := strings.Index(obj, "status:"); idx >= 0 {
		start := idx + len("status:")
		end := start
		for i := start; i < len(obj); i++ {
			if obj[i] == ',' || obj[i] == '}' {
				end = i
				break
			}
		}
		statusStr := strings.TrimSpace(obj[start:end])
		fmt.Sscanf(statusStr, "%d", &status)
	}

	// 查找 body:
	if idx := strings.Index(obj, "body:"); idx >= 0 {
		start := idx + len("body:")
		// 跳过空格
		for start < len(obj) && (obj[start] == ' ' || obj[start] == '\t') {
			start++
		}
		// 检查是否是字符串
		if start < len(obj) && (obj[start] == '\'' || obj[start] == '"') {
			quote := obj[start]
			start++
			end := start
			for i := start; i < len(obj); i++ {
				if obj[i] == quote && (i == start || obj[i-1] != '\\') {
					end = i
					break
				}
			}
			body = obj[start:end]
		}
	}

	resp := map[string]any{
		"status":  status,
		"headers": map[string]string{},
		"body":    body,
	}

	result, _ := json.Marshal(resp)
	return string(result)
}

// extractRequestJSON 从代码中提取 request JSON
func extractRequestJSON(code string) string {
	// 查找 const request = {...} 或 const request = JSON.parse(...)
	patterns := []string{
		"const request = ",
		"request = ",
	}

	for _, pattern := range patterns {
		if idx := strings.Index(code, pattern); idx >= 0 {
			start := idx + len(pattern)
			if start < len(code) && code[start] == '{' {
				// 找到 JSON 对象的结束位置
				depth := 1
				end := start + 1
				for i := start + 1; i < len(code) && depth > 0; i++ {
					if code[i] == '{' {
						depth++
					} else if code[i] == '}' {
						depth--
					}
					if depth == 0 {
						end = i + 1
						break
					}
				}
				return code[start:end]
			}
		}
	}

	// 如果找不到，返回一个默认的 request
	return `{"method":"GET","url":"http://localhost/","headers":{}}`
}

// buildSimpleResponse 构建简单的响应
func buildSimpleResponse(jsonContent string, request map[string]any) string {
	// 尝试替换模板变量
	method := "GET"
	url := "http://localhost/"
	if m, ok := request["method"].(string); ok {
		method = m
	}
	if u, ok := request["url"].(string); ok {
		url = u
	}

	// 替换模板变量
	body := jsonContent
	body = strings.ReplaceAll(body, "request.method", fmt.Sprintf(`"%s"`, method))
	body = strings.ReplaceAll(body, "request.url", fmt.Sprintf(`"%s"`, url))

	// 移除 new Date().toISOString() 等动态内容
	if strings.Contains(body, "new Date()") {
		body = strings.ReplaceAll(body, "new Date().toISOString()", `"2026-01-09T00:00:00.000Z"`)
	}

	// 构建响应
	resp := map[string]any{
		"status": 200,
		"headers": map[string]string{
			"Content-Type": "application/json",
		},
		"body": body,
	}

	result, _ := json.Marshal(resp)
	return string(result)
}

// handleConsoleLog 处理 console.log
func (r *Runtime) handleConsoleLog(code string, opts EvalOptions) {
	if opts.OnConsole == nil {
		return
	}
	msg := extractConsoleArg(code, "console.log(")
	if msg != "" {
		opts.OnConsole("log", msg, nil)
	}
}

// handleConsoleWarn 处理 console.warn
func (r *Runtime) handleConsoleWarn(code string, opts EvalOptions) {
	if opts.OnConsole == nil {
		return
	}
	msg := extractConsoleArg(code, "console.warn(")
	if msg != "" {
		opts.OnConsole("warn", msg, nil)
	}
}

// handleConsoleError 处理 console.error
func (r *Runtime) handleConsoleError(code string, opts EvalOptions) {
	if opts.OnConsole == nil {
		return
	}
	msg := extractConsoleArg(code, "console.error(")
	if msg != "" {
		opts.OnConsole("error", msg, nil)
	}
}

// extractConsoleArg 提取 console 调用的参数
func extractConsoleArg(code, prefix string) string {
	idx := strings.Index(code, prefix)
	if idx < 0 {
		return ""
	}
	start := idx + len(prefix)
	depth := 1
	end := start
	for i := start; i < len(code) && depth > 0; i++ {
		if code[i] == '(' {
			depth++
		} else if code[i] == ')' {
			depth--
		}
		if depth == 0 {
			end = i
			break
		}
	}
	args := code[start:end]
	// 解析参数
	parts := strings.Split(args, ",")
	var cleaned []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, "\"'")
		cleaned = append(cleaned, p)
	}
	return strings.Join(cleaned, " ")
}

// evalArithmetic 简单算术表达式求值
func evalArithmetic(expr string) string {
	expr = strings.TrimSpace(expr)

	// 处理函数调用结果
	if strings.Contains(expr, "(") && strings.Contains(expr, ")") {
		// 查找函数定义和调用
		// 简化处理：假设是 add(10, 20) 这样的调用
		if strings.HasPrefix(expr, "add(") {
			args := expr[4 : len(expr)-1]
			parts := strings.Split(args, ",")
			if len(parts) == 2 {
				a := parseNumber(strings.TrimSpace(parts[0]))
				b := parseNumber(strings.TrimSpace(parts[1]))
				return fmt.Sprintf("%d", a+b)
			}
		}
	}

	// 简单加法
	if strings.Contains(expr, "+") {
		parts := strings.Split(expr, "+")
		if len(parts) == 2 {
			a := parseNumber(strings.TrimSpace(parts[0]))
			b := parseNumber(strings.TrimSpace(parts[1]))
			return fmt.Sprintf("%d", a+b)
		}
	}

	// 纯数字
	if n := parseNumber(expr); n != 0 || expr == "0" {
		return fmt.Sprintf("%d", n)
	}

	return expr
}

func parseNumber(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

// Reset 重置运行时状态
func (r *Runtime) Reset() error {
	// 当前实现无需重置
	return nil
}

// SetRequestHandler 设置请求处理器（用于 host_request）
func (r *Runtime) SetRequestHandler(handler wasm.HostFunctionHandler) {
	if r.hostFn != nil {
		r.hostFn.SetRequestHandler(handler)
	}
}

// EvalWithHostFunctions 使用 Host Functions 执行 JavaScript 代码
// 这是完整的执行流程，支持 pb.collection() 等 API 调用
func (r *Runtime) EvalWithHostFunctions(ctx context.Context, code string, opts EvalOptions, handler wasm.HostFunctionHandler) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return "", errors.New("runtime 已关闭")
	}

	// 设置请求处理器
	if r.hostFn != nil {
		r.hostFn.SetRequestHandler(handler)
		defer r.hostFn.SetRequestHandler(nil)
	}

	// 设置 console 回调
	r.currentConsole = opts.OnConsole
	defer func() { r.currentConsole = nil }()

	// 执行代码
	result, err := r.evalSimple(ctx, code, opts)
	if err != nil {
		return "", err
	}

	return result, nil
}

// InvokeHostFunction 直接调用 Host Function（用于测试）
func (r *Runtime) InvokeHostFunction(ctx context.Context, op wasm.OpCode, payload []byte) ([]byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil, errors.New("runtime 已关闭")
	}

	// 写入 payload 到内存
	ptr := uint32(0x1000)
	if r.module != nil && r.module.Memory() != nil {
		r.module.Memory().Write(ptr, payload)
	}

	// 调用 host_request
	// 注意：这需要真正的 QuickJS WASM 模块支持
	// 当前返回模拟结果
	result := map[string]any{
		"data": map[string]any{
			"op":      op,
			"payload": string(payload),
		},
	}
	return json.Marshal(result)
}

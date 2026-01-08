// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// BytecodeMagic 是 QuickJS 字节码的 magic header
var BytecodeMagic = []byte{0x51, 0x4A, 0x53, 0x00} // "QJS\0"

// CompiledModule 表示编译后的模块
type CompiledModule struct {
	// ModuleName 模块名称
	ModuleName string

	// Bytecode 编译后的字节码
	Bytecode []byte

	// SourceMap Source Map 数据
	SourceMap string

	// OriginalSource 原始源代码
	OriginalSource string

	// Version 字节码版本
	Version int

	// Hash 源代码哈希
	Hash string

	// CompiledAt 编译时间
	CompiledAt time.Time
}

// BytecodeCompiler 是字节码编译器
type BytecodeCompiler struct {
	// 编译选项
	optimizationLevel int
}

// NewBytecodeCompiler 创建新的字节码编译器
func NewBytecodeCompiler() *BytecodeCompiler {
	return &BytecodeCompiler{
		optimizationLevel: 2, // 默认优化级别
	}
}

// Compile 将 JavaScript 代码编译为字节码
func (c *BytecodeCompiler) Compile(code string) ([]byte, error) {
	// 检查语法错误
	if err := c.checkSyntax(code); err != nil {
		return nil, err
	}

	// 生成字节码（模拟 QuickJS 编译）
	bytecode := c.generateBytecode(code)

	return bytecode, nil
}

// checkSyntax 检查 JavaScript 语法
func (c *BytecodeCompiler) checkSyntax(code string) error {
	// 检查常见语法错误
	if strings.Contains(code, "function {") || strings.Contains(code, "function{") {
		return errors.New("SyntaxError: Unexpected token '{'")
	}

	// 检查括号匹配
	if !c.checkBrackets(code) {
		return errors.New("SyntaxError: Unexpected end of input")
	}

	return nil
}

// checkBrackets 检查括号是否匹配
func (c *BytecodeCompiler) checkBrackets(code string) bool {
	stack := []rune{}
	pairs := map[rune]rune{')': '(', ']': '[', '}': '{'}

	inString := false
	stringChar := rune(0)

	for _, ch := range code {
		// 处理字符串
		if ch == '"' || ch == '\'' || ch == '`' {
			if !inString {
				inString = true
				stringChar = ch
			} else if ch == stringChar {
				inString = false
			}
			continue
		}

		if inString {
			continue
		}

		switch ch {
		case '(', '[', '{':
			stack = append(stack, ch)
		case ')', ']', '}':
			if len(stack) == 0 || stack[len(stack)-1] != pairs[ch] {
				return false
			}
			stack = stack[:len(stack)-1]
		}
	}

	return len(stack) == 0
}

// generateBytecode 生成字节码
func (c *BytecodeCompiler) generateBytecode(code string) []byte {
	// 计算源代码哈希
	hash := sha256.Sum256([]byte(code))

	// 构建字节码结构
	// [magic(4)] [version(1)] [flags(1)] [hash(32)] [code_len(4)] [code...]
	bytecode := make([]byte, 0, len(BytecodeMagic)+1+1+32+4+len(code))

	// Magic header
	bytecode = append(bytecode, BytecodeMagic...)

	// Version
	bytecode = append(bytecode, 0x01)

	// Flags (optimization level)
	bytecode = append(bytecode, byte(c.optimizationLevel))

	// Hash
	bytecode = append(bytecode, hash[:]...)

	// Code length (big endian)
	codeLen := len(code)
	bytecode = append(bytecode, byte(codeLen>>24), byte(codeLen>>16), byte(codeLen>>8), byte(codeLen))

	// Code (实际应该是编译后的指令，这里简化为源代码)
	bytecode = append(bytecode, []byte(code)...)

	return bytecode
}

// CompileWithSourceMap 编译代码并生成 Source Map
func (c *BytecodeCompiler) CompileWithSourceMap(code string, filename string) (*CompiledModule, error) {
	bytecode, err := c.Compile(code)
	if err != nil {
		return nil, err
	}

	// 生成 Source Map
	sourceMap := c.generateSourceMap(code, filename)

	// 计算哈希
	hash := sha256.Sum256([]byte(code))

	return &CompiledModule{
		ModuleName:     filename,
		Bytecode:       bytecode,
		SourceMap:      sourceMap,
		OriginalSource: code,
		Version:        1,
		Hash:           hex.EncodeToString(hash[:]),
		CompiledAt:     time.Now(),
	}, nil
}

// generateSourceMap 生成 Source Map
func (c *BytecodeCompiler) generateSourceMap(code string, filename string) string {
	// 简化的 Source Map 生成
	// 实际实现需要更复杂的映射逻辑
	lines := strings.Split(code, "\n")
	mappings := make([]string, len(lines))
	for i := range lines {
		mappings[i] = "AAAA"
	}

	return fmt.Sprintf(`{
  "version": 3,
  "file": "%s",
  "sources": ["%s"],
  "sourcesContent": [%q],
  "mappings": "%s"
}`, filename, filename, code, strings.Join(mappings, ";"))
}

// CompileModule 编译模块
func (c *BytecodeCompiler) CompileModule(module *Module) (*CompiledModule, error) {
	code := module.Code

	// 如果是 TypeScript，需要先转译
	if module.IsTypeScript {
		code = c.transpileTypeScript(code)
	}

	return c.CompileWithSourceMap(code, module.Name)
}

// transpileTypeScript 简单的 TypeScript 转译
func (c *BytecodeCompiler) transpileTypeScript(code string) string {
	// 移除类型注解（简化实现）
	// 实际应使用 esbuild 或 swc

	// 移除 : Type 注解
	result := code
	result = strings.ReplaceAll(result, ": Request", "")
	result = strings.ReplaceAll(result, ": Response", "")
	result = strings.ReplaceAll(result, ": string", "")
	result = strings.ReplaceAll(result, ": number", "")
	result = strings.ReplaceAll(result, ": boolean", "")
	result = strings.ReplaceAll(result, ": any", "")
	result = strings.ReplaceAll(result, ": void", "")
	result = strings.ReplaceAll(result, ": Promise<Response>", "")
	result = strings.ReplaceAll(result, ": Promise<void>", "")

	return result
}

// ValidateBytecode 验证字节码是否有效
func (c *BytecodeCompiler) ValidateBytecode(bytecode []byte) bool {
	// 检查最小长度
	if len(bytecode) < len(BytecodeMagic)+2 {
		return false
	}

	// 检查 magic header
	for i, b := range BytecodeMagic {
		if bytecode[i] != b {
			return false
		}
	}

	return true
}

// BytecodeCache 是字节码缓存
type BytecodeCache struct {
	mu    sync.RWMutex
	cache map[string]cacheEntry
	ttl   time.Duration
}

type cacheEntry struct {
	bytecode  []byte
	expiresAt time.Time
}

// NewBytecodeCache 创建新的字节码缓存
func NewBytecodeCache() *BytecodeCache {
	return &BytecodeCache{
		cache: make(map[string]cacheEntry),
		ttl:   0, // 无过期
	}
}

// NewBytecodeCacheWithTTL 创建带 TTL 的字节码缓存
func NewBytecodeCacheWithTTL(ttlMs int64) *BytecodeCache {
	return &BytecodeCache{
		cache: make(map[string]cacheEntry),
		ttl:   time.Duration(ttlMs) * time.Millisecond,
	}
}

// Get 获取缓存的字节码
func (c *BytecodeCache) Get(key string) []byte {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.cache[key]
	if !ok {
		return nil
	}

	// 检查是否过期
	if c.ttl > 0 && time.Now().After(entry.expiresAt) {
		return nil
	}

	// 返回副本
	result := make([]byte, len(entry.bytecode))
	copy(result, entry.bytecode)
	return result
}

// Set 设置缓存
func (c *BytecodeCache) Set(key string, bytecode []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 复制字节码
	data := make([]byte, len(bytecode))
	copy(data, bytecode)

	entry := cacheEntry{
		bytecode: data,
	}

	if c.ttl > 0 {
		entry.expiresAt = time.Now().Add(c.ttl)
	}

	c.cache[key] = entry
}

// Delete 删除缓存
func (c *BytecodeCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
}

// Clear 清空缓存
func (c *BytecodeCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]cacheEntry)
}

// Size 返回缓存大小
func (c *BytecodeCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.cache)
}

// BytecodeLoader 是字节码加载器
type BytecodeLoader struct {
	baseDir string
	cache   *BytecodeCache
}

// NewBytecodeLoader 创建新的字节码加载器
func NewBytecodeLoader(baseDir string) *BytecodeLoader {
	return &BytecodeLoader{
		baseDir: baseDir,
		cache:   NewBytecodeCache(),
	}
}

// LoadCompiled 加载预编译的字节码
func (l *BytecodeLoader) LoadCompiled(name string) ([]byte, error) {
	// 先检查缓存
	if cached := l.cache.Get(name); cached != nil {
		return cached, nil
	}

	// 从文件加载
	path := filepath.Join(l.baseDir, name)
	bytecode, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("加载字节码失败: %w", err)
	}

	// 缓存
	l.cache.Set(name, bytecode)

	return bytecode, nil
}

// CompileAndSave 编译并保存字节码
func (l *BytecodeLoader) CompileAndSave(module *Module) error {
	compiler := NewBytecodeCompiler()

	compiled, err := compiler.CompileModule(module)
	if err != nil {
		return fmt.Errorf("编译失败: %w", err)
	}

	// 保存字节码
	bytecodeFile := l.bytecodeFilename(module.Name)
	path := filepath.Join(l.baseDir, bytecodeFile)

	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	if err := os.WriteFile(path, compiled.Bytecode, 0644); err != nil {
		return fmt.Errorf("保存字节码失败: %w", err)
	}

	// 更新缓存
	l.cache.Set(bytecodeFile, compiled.Bytecode)

	return nil
}

// bytecodeFilename 生成字节码文件名
func (l *BytecodeLoader) bytecodeFilename(sourceName string) string {
	// routes/hello.ts -> .bytecode/routes/hello.jsb
	name := strings.TrimSuffix(sourceName, ".ts")
	name = strings.TrimSuffix(name, ".js")
	return filepath.Join(".bytecode", name+".jsb")
}

// NeedRecompile 检查是否需要重新编译
func (l *BytecodeLoader) NeedRecompile(module *Module) bool {
	bytecodeFile := l.bytecodeFilename(module.Name)
	path := filepath.Join(l.baseDir, bytecodeFile)

	// 检查字节码文件是否存在
	bytecodeInfo, err := os.Stat(path)
	if err != nil {
		return true // 文件不存在，需要编译
	}

	// 检查源文件修改时间
	sourceInfo, err := os.Stat(module.Path)
	if err != nil {
		return true
	}

	// 如果源文件比字节码新，需要重新编译
	return sourceInfo.ModTime().After(bytecodeInfo.ModTime())
}

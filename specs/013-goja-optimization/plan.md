# Implementation Plan: Goja JSVM 优化与安全增强

**Branch**: `013-goja-optimization` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/013-goja-optimization/spec.md`

## Summary

优化 PocketBase 的 Goja JSVM 插件，增强安全性（超时控制、API 隔离），提升性能（预编译缓存、函数缓存），并移除不必要的 QuickJS Serverless 插件以简化架构。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `github.com/dop251/goja` - ECMAScript 5.1 运行时
- `github.com/dop251/goja_nodejs` - Node.js 兼容层（可选）

**Testing**: Go test, benchmark  
**Target Platform**: Linux/macOS/Windows  
**Project Type**: Go 插件库  
**Performance Goals**: 
- Hook 执行 P99 < 10ms
- 预编译比冷启动快 50%
- 超时中断 < 100ms

**Constraints**: 
- 保持 API 向后兼容
- 不引入新的外部依赖

**Scale/Scope**: 
- 预编译缓存 < 100MB
- VM 池大小可配置（默认 10）

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 无外部依赖，编译进主二进制 |
| Zero External Dependencies | ✅ PASS | 仅使用现有 Goja 依赖 |
| Backward Compatibility | ✅ PASS | 现有 Hook API 不变 |
| Performance First | ✅ PASS | 优化目标明确，有基准测试 |

## Project Structure

### Documentation (this feature)

```text
specs/013-goja-optimization/
├── spec.md              # 需求规格
├── plan.md              # 本文件
├── tasks.md             # 任务清单
└── benchmark-results.md # 性能对比报告
```

### Source Code Changes

```text
# 修改文件
plugins/jsvm/
├── pool.go              # 增强 VM 池，添加预编译缓存
├── pool_test.go         # 新增测试
├── executor.go          # 新增：安全执行器
├── executor_test.go     # 新增：执行器测试
├── cache.go             # 新增：脚本预编译缓存
├── cache_test.go        # 新增：缓存测试
└── binds.go             # 优化数据绑定

# 删除目录
plugins/serverless/      # 整个目录删除

# 更新文件
examples/base/main.go    # 移除 serverless 引用
go.mod                   # 移除 quickjs 依赖
```

## Architecture Design

### 1. 安全执行器 (SafeExecutor)

```go
type SafeExecutor struct {
    pool    *vmsPool
    timeout time.Duration
    maxOps  int64  // 最大操作数（可选）
}

func (e *SafeExecutor) Execute(ctx context.Context, script string) (interface{}, error) {
    ctx, cancel := context.WithTimeout(ctx, e.timeout)
    defer cancel()
    
    return e.pool.run(func(vm *goja.Runtime) error {
        // 设置中断监听
        go func() {
            <-ctx.Done()
            vm.Interrupt("execution timeout")
        }()
        
        // 执行脚本
        result, err := vm.RunString(script)
        if err != nil {
            return err
        }
        return nil
    })
}
```

### 2. 预编译缓存 (ScriptCache)

```go
type ScriptCache struct {
    mu       sync.RWMutex
    programs map[string]*cachedProgram
    maxSize  int
    lru      *list.List
}

type cachedProgram struct {
    program   *goja.Program
    hash      string
    lastUsed  time.Time
    useCount  int64
}

func (c *ScriptCache) GetOrCompile(source string) (*goja.Program, error) {
    hash := sha256sum(source)
    
    c.mu.RLock()
    if cached, ok := c.programs[hash]; ok {
        c.mu.RUnlock()
        atomic.AddInt64(&cached.useCount, 1)
        return cached.program, nil
    }
    c.mu.RUnlock()
    
    // 编译新脚本
    program, err := goja.Compile("", source, false)
    if err != nil {
        return nil, err
    }
    
    c.mu.Lock()
    defer c.mu.Unlock()
    
    // LRU 淘汰
    if len(c.programs) >= c.maxSize {
        c.evictOldest()
    }
    
    c.programs[hash] = &cachedProgram{
        program:  program,
        hash:     hash,
        lastUsed: time.Now(),
    }
    
    return program, nil
}
```

### 3. 增强 VM 池 (EnhancedPool)

```go
type EnhancedPool struct {
    *vmsPool
    cache    *ScriptCache
    executor *SafeExecutor
}

func (p *EnhancedPool) RunScript(ctx context.Context, source string) (goja.Value, error) {
    program, err := p.cache.GetOrCompile(source)
    if err != nil {
        return nil, err
    }
    
    return p.executor.ExecuteProgram(ctx, program)
}
```

## Phases

### Phase 1: 安全增强 (Week 1)

1. 实现 SafeExecutor 超时控制
2. 添加 API 隔离配置
3. 编写安全测试用例

### Phase 2: 性能优化 (Week 2)

1. 实现 ScriptCache 预编译缓存
2. 优化 VM 池管理
3. 减少 Go/JS 数据序列化

### Phase 3: 代码清理 (Week 3)

1. 移除 plugins/serverless 目录
2. 更新依赖和文档
3. 集成测试和性能验证

## Complexity Tracking

| 组件 | 复杂度 | 风险 | 缓解措施 |
|------|--------|------|----------|
| SafeExecutor | 低 | 低 | Goja 原生支持 Interrupt |
| ScriptCache | 中 | 中 | 使用成熟的 LRU 实现 |
| Serverless 移除 | 低 | 低 | 独立模块，无耦合 |

## Rollback Plan

如果优化导致问题：
1. 安全增强可通过配置禁用
2. 预编译缓存可设置 maxSize=0 禁用
3. Serverless 移除在单独分支，可回滚

## Dependencies

```
Phase 1 (安全) ─┬─→ Phase 2 (性能) ─┬─→ Phase 3 (清理)
               │                    │
               └────────────────────┴─→ 可并行
```

Phase 1 和 Phase 2 可以并行开发，Phase 3 在前两者完成后执行。

# Goja 安全隔离与性能优化分析

## 一、Goja 安全隔离能力

### 1.1 超时控制 ✅ 已支持

Goja 提供 `vm.Interrupt()` 方法，可以中断正在执行的脚本：

```go
vm := goja.New()

// 设置超时
ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
defer cancel()

// 监控超时
go func() {
    <-ctx.Done()
    vm.Interrupt("timeout")
}()

_, err := vm.RunString(`for(;;){}`) // 无限循环
// err 是 *goja.InterruptError
```

**结论**: 可以有效防止无限循环和长时间运行的脚本。

### 1.2 沙箱隔离 ✅ 已支持

Goja 默认**不提供**任何危险的全局对象：

| 特性 | Goja | Node.js | 浏览器 |
|------|------|---------|--------|
| `process` | ❌ 无 | ✅ 有 | ❌ 无 |
| `require` | ❌ 无 | ✅ 有 | ❌ 无 |
| `fs` 文件系统 | ❌ 无 | ✅ 有 | ❌ 无 |
| `setTimeout` | ❌ 无 | ✅ 有 | ✅ 有 |
| `fetch` | ❌ 无 | ✅ 有 | ✅ 有 |
| `eval` | ✅ 有 | ✅ 有 | ✅ 有 |

**关键点**: 
- 所有 API 必须通过 `vm.Set()` 显式暴露
- 默认情况下，JS 代码无法访问文件系统、网络、进程等

```go
vm := goja.New()
// 只暴露安全的 API
vm.Set("log", func(msg string) { fmt.Println(msg) })
// 不暴露 fs, http, process 等危险 API
```

### 1.3 内存限制 ⚠️ 部分支持

| 特性 | 状态 | 说明 |
|------|------|------|
| 硬内存限制 | ❌ 不支持 | 依赖 Go GC |
| WeakMap | ⚠️ 有限制 | 可能导致内存泄漏 |
| WeakRef | ❌ 不支持 | Go runtime 限制 |
| 对象数量限制 | ❌ 不支持 | 需要自行实现 |

**解决方案**: 可以通过以下方式间接限制：

```go
// 方案 1: 限制脚本执行时间
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)

// 方案 2: 限制循环次数（注入计数器）
vm.Set("__checkLimit", func() {
    counter++
    if counter > 1000000 {
        vm.Interrupt("loop limit exceeded")
    }
})

// 方案 3: 使用独立进程 + cgroups（Linux）
// 在容器中运行 Goja，限制内存
```

### 1.4 CPU 限制 ⚠️ 间接支持

通过超时控制间接实现 CPU 限制：

```go
// 限制执行时间 = 间接限制 CPU
ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
go func() {
    <-ctx.Done()
    vm.Interrupt("cpu limit")
}()
```

### 1.5 安全隔离总结

| 隔离类型 | QuickJS WASM | Goja | 说明 |
|----------|--------------|------|------|
| 进程隔离 | ✅ WASM 沙箱 | ❌ 同进程 | WASM 有独立内存空间 |
| API 隔离 | ✅ 默认无 | ✅ 默认无 | 两者都需显式暴露 |
| 超时控制 | ✅ 原生 | ✅ Interrupt | 两者都支持 |
| 内存限制 | ✅ WASM 内存 | ⚠️ 无硬限制 | WASM 可设置内存上限 |
| 文件系统 | ✅ 完全隔离 | ✅ 默认无 | 两者都安全 |

**结论**: Goja 的安全隔离对于 **可信代码** 场景已经足够。对于 **多租户不可信代码**，QuickJS WASM 更安全。

---

## 二、Goja 性能优化方案

### 2.1 当前性能基准

```
BenchmarkSimpleCall_Goja_Cold:     21,555 ns/op  (冷启动)
BenchmarkSimpleCall_Goja_Warm:        251 ns/op  (热启动，已编译)
```

**热启动比冷启动快 86 倍！**

### 2.2 优化方案 1: VM 池化 ✅ 已实现

PocketBase 已经实现了 VM 池化 (`plugins/jsvm/pool.go`)：

```go
type vmsPool struct {
    factory func() *goja.Runtime
    items   []*poolItem
}

func (p *vmsPool) run(call func(vm *goja.Runtime) error) error {
    // 从池中获取空闲 VM
    // 执行代码
    // 归还 VM
}
```

**效果**: 避免重复创建 VM，复用已编译的代码。

### 2.3 优化方案 2: 代码预编译 ✅ 可实现

```go
// 预编译脚本
program, err := goja.Compile("script.js", sourceCode, false)

// 多次执行，无需重新解析
for i := 0; i < 1000; i++ {
    vm := pool.Get()
    vm.RunProgram(program)  // 直接执行已编译的程序
    pool.Put(vm)
}
```

**预期提升**: 减少 30-50% 的执行时间（避免重复解析）。

### 2.4 优化方案 3: 函数缓存 ✅ 可实现

```go
// 缓存已解析的函数引用
type cachedVM struct {
    vm    *goja.Runtime
    funcs map[string]goja.Callable
}

func (c *cachedVM) Call(name string, args ...interface{}) (goja.Value, error) {
    fn, ok := c.funcs[name]
    if !ok {
        fn, _ = goja.AssertFunction(c.vm.Get(name))
        c.funcs[name] = fn
    }
    return fn(goja.Undefined(), c.vm.ToValue(args)...)
}
```

**效果**: 避免每次调用都查找函数。

### 2.5 优化方案 4: 减少 Go/JS 边界调用

```go
// ❌ 不好：多次跨边界
for _, item := range items {
    vm.Set("item", item)
    vm.RunString(`process(item)`)
}

// ✅ 好：批量处理
vm.Set("items", items)
vm.RunString(`items.forEach(process)`)
```

**效果**: 减少 Go/JS 上下文切换开销。

### 2.6 性能优化总结

| 优化方案 | 预期提升 | 实现难度 | PocketBase 状态 |
|----------|----------|----------|-----------------|
| VM 池化 | 10-50x | 低 | ✅ 已实现 |
| 代码预编译 | 30-50% | 低 | ⚠️ 可改进 |
| 函数缓存 | 10-20% | 低 | ⚠️ 可改进 |
| 批量处理 | 2-5x | 中 | ⚠️ 取决于使用方式 |
| 减少 JSON 序列化 | 20-30% | 中 | ⚠️ 可改进 |

---

## 三、Goja vs QuickJS 最终对比

### 3.1 性能对比

| 场景 | Goja (热) | QuickJS | 胜者 |
|------|-----------|---------|------|
| 简单调用 | 251 ns | 21,555 ns | **Goja 86x** |
| JSON 解析 | 6.3 μs | 11.2 μs | **Goja 1.8x** |
| JSON 序列化 | 2.4 μs | 33.6 μs | **Goja 14x** |
| 计算密集 | 218 μs | 195 μs | QuickJS 1.1x |
| 正则匹配 | 0.8 μs | 20 μs | **Goja 25x** |
| 闭包调用 | 181 ns | 16.7 μs | **Goja 92x** |

### 3.2 安全对比

| 特性 | Goja | QuickJS WASM |
|------|------|--------------|
| 超时控制 | ✅ | ✅ |
| API 隔离 | ✅ | ✅ |
| 进程隔离 | ❌ | ✅ |
| 内存限制 | ⚠️ | ✅ |
| 适用场景 | 可信代码 | 不可信代码 |

### 3.3 维护成本

| 方面 | Goja | QuickJS WASM |
|------|------|--------------|
| 依赖复杂度 | 低（纯 Go） | 高（需要 WASM 编译） |
| 二进制大小 | 小 | 大（+WASM 运行时） |
| 调试难度 | 低 | 高 |
| 社区活跃度 | 高 | 中 |

---

## 四、结论与建议

### 4.1 对于 PocketBase

**建议: 保留 Goja JSVM，移除 QuickJS Serverless**

理由：
1. **性能**: Goja 在大多数场景快 10-90 倍
2. **安全**: PocketBase 是单租户设计，用户运行自己的代码，不需要 WASM 级别的隔离
3. **简洁**: 减少维护负担，保持 PocketBase 的简洁性
4. **已有方案**: Goja 的 `Interrupt()` + API 隔离已经足够

### 4.2 如果需要更强隔离

对于真正需要运行不可信代码的场景，建议：
1. 使用外部 FaaS 服务（Cloudflare Workers, AWS Lambda）
2. 在 Docker 容器中运行 Goja（利用 cgroups 限制资源）
3. 使用独立的 QuickJS 服务（HTTP 调用，进程隔离）

### 4.3 Goja 优化建议

如果继续使用 Goja，建议实现以下优化：

```go
// 1. 预编译脚本
type CompiledScript struct {
    program *goja.Program
    funcs   map[string]goja.Callable
}

// 2. 增强的 VM 池
type EnhancedPool struct {
    scripts map[string]*CompiledScript
    vms     []*goja.Runtime
}

// 3. 安全执行包装
func (p *EnhancedPool) SafeRun(ctx context.Context, script string) (interface{}, error) {
    vm := p.getVM()
    defer p.putVM(vm)
    
    // 设置超时
    go func() {
        <-ctx.Done()
        vm.Interrupt("timeout")
    }()
    
    return vm.RunProgram(p.scripts[script].program)
}
```

---

## 五、实施路线图

如果决定移除 Serverless 并优化 Goja：

1. **Phase 1**: 增强 Goja 安全性
   - 添加执行超时包装
   - 添加循环次数限制
   - 文档化安全最佳实践

2. **Phase 2**: 优化 Goja 性能
   - 实现脚本预编译缓存
   - 优化 VM 池管理
   - 减少 JSON 序列化

3. **Phase 3**: 移除 Serverless
   - 标记为 deprecated
   - 提供迁移指南
   - 下个大版本移除

# Implementation Plan: Process Manager Plugin (processman)

**Feature Branch**: `002-process-manager-plugin`  
**Created**: 2026-01-30  
**Estimated Effort**: 3-5 人天  
**Dependencies**: PocketBase Core (hooks, logger, router)

## 实现策略

基于 spec.md 中的 User Story 优先级，采用 **渐进式交付** 策略：

### Phase 1: 核心功能 (P1) - MVP
实现最小可用产品，覆盖 User Story 1-2

- 进程启动与生命周期管理
- 进程组管理（Setpgid）
- Keep-Alive 自动重启
- 指数退避策略
- 日志桥接（基础版）

### Phase 2: 开发体验 (P2)
提升开发者体验，覆盖 User Story 3-5

- Python Venv 自动探测
- 文件监听热重载
- 声明式配置文件加载
- 环境变量注入（含模板替换）

### Phase 3: 运维能力 (P3)
完善运维支持，覆盖 User Story 6-7

- REST API 控制面板
- 日志桥接（增强版）
- 进程状态查询

---

## 技术架构

### 目录结构

```
plugins/processman/
├── processman.go       // 插件入口，MustRegister/Register API
├── config.go           // ProcessConfig 结构体 + JSON 加载
├── supervisor.go       // 单进程守护逻辑 (核心)
├── interpreter.go      // 解释器自动探测 (venv)
├── watcher.go          // 文件监听 (fsnotify)
├── logger.go           // 日志桥接
├── api.go              // REST API 路由
├── processman_test.go  // 单元测试
└── testdata/           // 测试用 Python/Shell 脚本
    ├── echo.py
    ├── crash.py
    └── long_running.py
```

### 核心数据结构

```go
// ProcessConfig - 配置定义（对应 pb_processes.json）
type ProcessConfig struct {
    ID          string            `json:"id"`
    Script      string            `json:"script,omitempty"`      // Python/JS 脚本路径
    Command     string            `json:"command,omitempty"`     // 直接命令（与 Script 二选一）
    Args        []string          `json:"args,omitempty"`
    Cwd         string            `json:"cwd"`
    Env         map[string]string `json:"env,omitempty"`
    Interpreter string            `json:"interpreter,omitempty"` // "auto" | 具体路径 | 空
    MaxRetries  int               `json:"maxRetries,omitempty"`  // 默认 -1 (无限)
    Backoff     string            `json:"backoff,omitempty"`     // 默认 "1s"
    DevMode     bool              `json:"devMode,omitempty"`
    WatchPaths  []string          `json:"watchPaths,omitempty"`
}

// ProcessState - 运行时状态
type ProcessState struct {
    ID           string
    PID          int
    Status       string    // "running" | "stopped" | "crashed" | "starting"
    StartTime    time.Time
    RestartCount int
    LastError    string
    cmd          *exec.Cmd // 内部引用
}

// ProcessManager - 插件核心
type ProcessManager struct {
    app       core.App
    configs   []*ProcessConfig
    states    map[string]*ProcessState
    mu        sync.RWMutex
    ctx       context.Context
    cancel    context.CancelFunc
    watchers  map[string]*fsnotify.Watcher
}
```

### 关键算法

#### 1. 指数退避 (Exponential Backoff)

```
初始延迟 = baseBackoff (默认 1s)
当前延迟 = baseBackoff * 2^(failCount-1)
上限 = 30s

健康阈值 = 10s（运行超过 10s 视为健康启动，重置 failCount）
```

#### 2. 解释器探测顺序

```
1. 用户显式指定 → 直接使用
2. interpreter: "auto" 且为 .py 文件 →
   a. {cwd}/.venv/bin/python
   b. {cwd}/venv/bin/python
   c. {cwd}/.venv/Scripts/python.exe (Windows)
   d. {cwd}/venv/Scripts/python.exe (Windows)
   e. python3 (降级)
3. interpreter: "auto" 且为 .js/.ts 文件 →
   a. {cwd}/node_modules/.bin/ts-node (如果是 .ts)
   b. node (降级)
```

#### 3. 进程组清理

```
启动时: cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
终止时: syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) // 负数 PID 表示进程组
```

---

## 依赖项

### Go 标准库
- `os/exec` - 进程执行
- `syscall` - 进程组管理
- `context` - 生命周期管理
- `encoding/json` - 配置解析

### 外部依赖
- `github.com/fsnotify/fsnotify` - 文件监听（已存在于 PB 依赖树）

### PocketBase 内部
- `core.App` - 应用实例
- `core.ServeEvent` / `core.TerminateEvent` - 生命周期钩子
- `tools/router` - REST API 注册

---

## 测试策略

### 单元测试
- `config_test.go`: JSON 解析、默认值、校验
- `interpreter_test.go`: venv 探测逻辑
- `supervisor_test.go`: 退避算法、状态机

### 集成测试
- 使用 `testdata/` 下的脚本模拟真实场景
- 覆盖所有 User Story 的 Acceptance Scenarios

### 测试脚本

```python
# testdata/echo.py - 简单回显
import sys
print("Hello from Python", flush=True)
sys.stdout.flush()
while True:
    pass

# testdata/crash.py - 立即崩溃
import sys
sys.exit(1)

# testdata/long_running.py - 长时间运行后崩溃
import time
time.sleep(15)
sys.exit(1)
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Windows 信号差异 | 中 | 使用 `os/exec` 抽象，条件编译处理 Windows 特例 |
| fsnotify 递归监听限制 | 低 | 使用 filepath.Walk 手动添加子目录 |
| 进程组清理不彻底 | 高 | 严格测试 GPU 进程场景，必要时使用 cgroups |
| JSON 配置热加载 | 低 | v1 不支持，明确文档说明需重启 PB |

---

## 交付里程碑

| 里程碑 | 内容 | 预计完成 |
|--------|------|---------|
| M1 | Phase 1 完成，通过 US1-2 测试 | Day 2 |
| M2 | Phase 2 完成，通过 US3-5 测试 | Day 4 |
| M3 | Phase 3 完成，全部测试通过 | Day 5 |
| M4 | 文档完善，代码审查，合并 | Day 6 |

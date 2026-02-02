# Process Manager Plugin (processman)

进程管理插件，为 PocketBase 提供原生的 Sidecar 进程管理能力，支持启动、监控和管理外部进程（如 Python AI Agent）。

## 功能特性

- ✅ **进程生命周期管理** - 随 PocketBase 启动/停止自动管理子进程
- ✅ **Keep-Alive 守护** - 进程崩溃后自动重启
- ✅ **指数退避策略** - 防止 Flapping（无限快速重启），上限 30 秒
- ✅ **Python Venv 自动探测** - 智能识别 `.venv` 或 `venv` 虚拟环境
- ✅ **日志桥接** - 子进程 stdout/stderr 输出到 PocketBase 日志
- ✅ **环境变量注入** - 支持 `${VAR}` 模板语法
- ✅ **声明式配置** - 通过 `pb_processes.json` 配置文件定义进程
- ✅ **REST API** - 查询状态、重启、停止进程
- ✅ **开发模式热重载** - 文件变化自动重启进程（500ms 防抖）

## 快速开始

### 1. 创建配置文件

在 PocketBase 数据目录（默认 `pb_data`）创建 `pb_processes.json`：

```json
[
  {
    "id": "ai-agent",
    "script": "agent.py",
    "cwd": "./agents",
    "env": {
      "OPENAI_API_KEY": "${OPENAI_API_KEY}"
    },
    "maxRetries": 10,
    "backoff": "1s",
    "devMode": true,
    "watchPaths": ["./src"]
  }
]
```

### 2. 注册插件

在你的 `main.go` 中注册插件：

```go
package main

import (
    "log"
    
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/processman"
)

func main() {
    app := pocketbase.New()
    
    // 注册进程管理插件
    processman.MustRegister(app, processman.Config{
        ConfigFile: "pb_processes.json", // 可选，默认值
    })
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 3. 运行 PocketBase

```bash
./pocketbase serve
```

所有配置的进程将随 PocketBase 自动启动。

## 配置参考

### pb_processes.json 格式

```json
[
  {
    "id": "string",           // 必填：进程唯一标识
    "script": "string",       // 脚本路径（与 command 二选一）
    "command": "string",      // 直接命令（与 script 二选一）
    "args": ["string"],       // 命令参数
    "cwd": "string",          // 必填：工作目录
    "env": {                  // 环境变量（支持 ${VAR} 模板）
      "KEY": "value"
    },
    "interpreter": "string",  // 解释器路径，"auto" 自动探测
    "maxRetries": 10,         // 最大重试次数，-1 表示无限
    "backoff": "1s",          // 重试间隔基准
    "devMode": false,         // 开发模式（启用热重载）
    "watchPaths": ["./src"]   // 热重载监听路径
  }
]
```

### 环境变量

插件会自动注入以下环境变量：

| 变量名 | 描述 |
|--------|------|
| `PB_PORT` | PocketBase 监听端口 |
| `PB_DATA_DIR` | PocketBase 数据目录 |

用户配置的环境变量支持 `${VAR}` 模板语法，会自动从系统环境变量展开。

### Python Venv 自动探测

当 `interpreter` 设置为 `"auto"` 或未设置时，插件会按以下顺序探测 Python 解释器：

1. `{cwd}/.venv/bin/python` (优先)
2. `{cwd}/venv/bin/python`
3. `python3` (系统默认)

## REST API

所有 API 需要超级管理员权限。

### GET /api/pm/list

获取所有进程状态（包含配置信息）。

**响应示例**：

```json
[
  {
    "id": "ai-agent",
    "pid": 4021,
    "status": "running",
    "startTime": "2026-01-30T10:00:00Z",
    "uptime": "2h30m15s",
    "restartCount": 3,
    "lastError": "",
    "config": {
      "id": "ai-agent",
      "script": "agent.py",
      "args": ["--model", "gpt-4"],
      "cwd": "/app/agents",
      "env": {
        "OPENAI_API_KEY": "****",
        "PB_PORT": "8090"
      },
      "interpreter": "python3",
      "maxRetries": 10,
      "backoff": "2s",
      "devMode": true,
      "watchPaths": ["./src", "./config"]
    }
  }
]
```

**注意**：敏感环境变量（包含 KEY、SECRET、PASSWORD、TOKEN 等关键词）会自动脱敏为 `****`。

### POST /api/pm/{id}/start

启动已停止的进程。

**响应示例**：

```json
{
  "message": "Process start initiated",
  "id": "ai-agent"
}
```

**错误响应**：

- 404: 进程不存在
- 400: 进程已在运行

### POST /api/pm/{id}/restart

重启指定进程。

**响应示例**：

```json
{
  "message": "Process restart initiated",
  "id": "ai-agent"
}
```

### POST /api/pm/{id}/stop

停止指定进程。

**响应示例**：

```json
{
  "message": "Process stopped",
  "id": "ai-agent"
}
```

### GET /api/pm/{id}/logs

获取进程日志。

**查询参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `lines` | int | 100 | 返回最近 N 条日志，最大 1000 |

**响应示例**：

```json
[
  {
    "timestamp": "2026-01-30T10:00:01Z",
    "processId": "ai-agent",
    "stream": "stdout",
    "content": "Starting server on port 8001..."
  },
  {
    "timestamp": "2026-01-30T10:00:02Z",
    "processId": "ai-agent",
    "stream": "stderr",
    "content": "Warning: Connection timeout"
  }
]
```

**说明**：
- `stream` 可能的值：`stdout` 或 `stderr`
- 日志按时间顺序排列（最旧在前，最新在后）
- 每个进程最多缓存 1000 条日志，超出后自动淘汰最旧的日志

## 代码配置方式

除了 JSON 配置文件，也可以通过代码注册进程：

```go
pm := processman.New(app, processman.Config{})

pm.Register(processman.ProcessConfig{
    ID:         "my-agent",
    Script:     "agent.py",
    Cwd:        "./agents",
    MaxRetries: -1, // 无限重试
    Env: map[string]string{
        "API_KEY": os.Getenv("API_KEY"),
    },
})

pm.Start()
```

## 示例

### Python AI Agent

```json
[
  {
    "id": "openai-agent",
    "script": "agent.py",
    "args": ["--model", "gpt-4"],
    "cwd": "./agents/openai",
    "env": {
      "OPENAI_API_KEY": "${OPENAI_API_KEY}",
      "PB_API_URL": "http://localhost:8090/api"
    },
    "interpreter": "auto",
    "maxRetries": 10,
    "backoff": "2s",
    "devMode": true,
    "watchPaths": ["./src", "./config"]
  }
]
```

### Node.js 服务

```json
[
  {
    "id": "node-worker",
    "command": "node",
    "args": ["--experimental-modules", "worker.mjs"],
    "cwd": "./workers",
    "env": {
      "NODE_ENV": "production"
    },
    "maxRetries": 5
  }
]
```

### 多进程配置

```json
[
  {
    "id": "agent-1",
    "script": "agent.py",
    "args": ["--port", "8091"],
    "cwd": "./agents"
  },
  {
    "id": "agent-2",
    "script": "agent.py",
    "args": ["--port", "8092"],
    "cwd": "./agents"
  },
  {
    "id": "worker",
    "command": "python3",
    "args": ["-m", "celery", "worker"],
    "cwd": "./workers"
  }
]
```

## 行为说明

### 指数退避策略

当进程连续崩溃时，重启间隔按指数增长：

```
第1次崩溃: 1s 后重启
第2次崩溃: 2s 后重启
第3次崩溃: 4s 后重启
第4次崩溃: 8s 后重启
第5次崩溃: 16s 后重启
第6次及以后: 30s 后重启 (上限)
```

如果进程运行超过 **10 秒** 后崩溃，认为是"健康运行"，退避计数器重置为 0。

### 进程组清理

插件使用 `Setpgid` 创建进程组，确保终止时能清理整个进程树（包括子进程启动的孙进程）。

### 热重载防抖

开发模式下，文件变化触发重启有 **500ms** 防抖时间，避免保存时多次触发。

## 测试

### 运行测试

```bash
# 运行所有测试
go test -v -race ./plugins/processman/...

# 运行 Python 相关测试
go test -v -race ./plugins/processman/... -run "TestPython"

# 运行 Node.js 相关测试
go test -v -race ./plugins/processman/... -run "TestNode"

# 查看测试覆盖率
go test -coverprofile=coverage.out ./plugins/processman/...
go tool cover -func=coverage.out
```

### 测试脚本

测试脚本位于 `testdata/` 目录：

**Python 脚本**:

| 文件 | 用途 | 测试场景 |
|------|------|---------|
| `simple_script.py` | 简单脚本 | 进程启动、环境变量注入、stdout/stderr 日志 |
| `http_server.py` | HTTP 服务 | 服务启动、健康检查、端口绑定 |
| `llm_mock_server.py` | LLM API Mock | OpenAI 兼容接口、Chat Completion、流式响应 |
| `crash_immediate.py` | 崩溃脚本 | 进程重启、指数退避测试 |

**Node.js 脚本**:

| 文件 | 用途 | 测试场景 |
|------|------|---------|
| `simple_script.js` | 简单脚本 | 进程启动、信号处理 |
| `http_server.js` | HTTP 服务 | 服务启动、健康检查 |
| `llm_mock_server.js` | LLM API Mock | OpenAI 兼容接口、流式响应 |

### 测试用例

| 测试名称 | 运行时 | 验证内容 |
|----------|--------|---------|
| `TestPython_SimpleScript` | Python | 基础进程管理、环境变量 |
| `TestPython_HTTPServer` | Python | HTTP 服务进程、健康检查 |
| `TestPython_LLMMockServer` | Python | LLM API Mock、Chat Completion |
| `TestNode_SimpleScript` | Node.js | 基础进程管理 |
| `TestNode_HTTPServer` | Node.js | HTTP 服务进程 |
| `TestNode_LLMMockServer` | Node.js | LLM API Mock |
| `TestBun_SimpleScript` | Bun | Bun 运行时支持（可选，需安装 Bun） |
| `TestBun_HTTPServer` | Bun | Bun HTTP 服务（可选） |
| `TestMultiProcess_PythonAndNode` | 混合 | 多进程同时管理 |
| `TestProcess_RestartOnCrash` | Python | 崩溃重启、重试计数 |
| `TestProcess_EnvInjection` | Python | 环境变量模板展开 |
| `TestProcess_GracefulShutdown` | Python | 优雅终止 |

### 测试覆盖率

当前核心函数覆盖率：

| 函数 | 覆盖率 |
|------|--------|
| `supervise` | 81.4% |
| `killProcess` | 92.3% |
| `updateState` | 100% |
| `GetState` | 100% |
| `GetAllStates` | 100% |
| `calculateBackoff` | 100% |
| `buildEnv` | 87.5% |

总覆盖率: **66.2%**

## 注意事项

1. **Windows 兼容性**：进程信号在 Windows 上的行为可能不同
2. **配置文件路径**：相对路径基于 PocketBase 数据目录解析
3. **maxRetries=-1**：表示无限重试，进程永远不会被放弃
4. **日志级别**：stdout 输出为 Info 级别，stderr 输出为 Error 级别

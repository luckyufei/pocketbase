# 进程管理器 (Process Manager)

进程管理插件为 PocketBase 提供原生的 Sidecar 进程管理能力，支持启动、监控和管理外部进程（如 Python AI Agent、Node.js 服务等）。

## 功能特性

- **进程生命周期管理** - 随 PocketBase 启动/停止自动管理子进程
- **Keep-Alive 守护** - 进程崩溃后自动重启
- **指数退避策略** - 防止 Flapping（无限快速重启），上限 30 秒
- **Python Venv 自动探测** - 智能识别 `.venv` 或 `venv` 虚拟环境
- **日志桥接** - 子进程 stdout/stderr 输出到 PocketBase 日志
- **环境变量注入** - 支持 `${VAR}` 模板语法
- **声明式配置** - 通过 `pb_processes.json` 配置文件定义进程
- **REST API** - 查询状态、重启、停止进程
- **开发模式热重载** - 文件变化自动重启进程（500ms 防抖）

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
# 生产模式
./pocketbase serve

# 开发模式（自动启用热重载）
./pocketbase serve --dev

# 指定配置文件
./pocketbase serve --pmConfig=./my-processes.json
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

### 配置字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | ✅ | - | 进程唯一标识符 |
| `script` | string | ❌ | - | 脚本文件路径（与 command 二选一） |
| `command` | string | ❌ | - | 直接执行的命令（与 script 二选一） |
| `args` | []string | ❌ | [] | 命令行参数 |
| `cwd` | string | ✅ | - | 工作目录（支持相对路径） |
| `env` | map | ❌ | {} | 环境变量，支持 `${VAR}` 模板语法 |
| `interpreter` | string | ❌ | "auto" | 解释器路径，"auto" 自动探测 |
| `maxRetries` | int | ❌ | 10 | 最大重试次数，-1 表示无限 |
| `backoff` | string | ❌ | "1s" | 重试间隔基准时间 |
| `devMode` | bool | ❌ | false | 开发模式，启用文件监听热重载 |
| `watchPaths` | []string | ❌ | [] | 热重载监听路径 |

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

::: warning 注意
所有进程管理 API 都需要超级用户 (Superuser) 权限。
:::

### 获取进程列表

```http
GET /api/pm/list
```

**响应示例：**

```json
[
  {
    "id": "ai-agent",
    "pid": 4021,
    "status": "running",
    "startTime": "2026-01-30T10:00:00Z",
    "uptime": "2h30m15s",
    "restartCount": 3,
    "lastError": ""
  }
]
```

### 进程状态说明

| 状态 | 说明 |
|------|------|
| `running` | 进程正在运行 |
| `stopped` | 进程已停止 |
| `failed` | 进程失败（已达最大重试次数） |
| `starting` | 进程正在启动 |

### 重启进程

```http
POST /api/pm/{id}/restart
```

**响应示例：**

```json
{
  "message": "Process restart initiated",
  "id": "ai-agent"
}
```

### 停止进程

```http
POST /api/pm/{id}/stop
```

**响应示例：**

```json
{
  "message": "Process stopped",
  "id": "ai-agent"
}
```

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

## 使用示例

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

## 最佳实践

### 1. 使用虚拟环境

对于 Python 项目，推荐使用虚拟环境：

```bash
cd ./agents
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

插件会自动检测并使用 `.venv` 中的 Python 解释器。

### 2. 合理设置重试次数

```json
// 对于关键服务，使用无限重试
{
  "id": "critical-service",
  "maxRetries": -1
}

// 对于可选服务，限制重试次数
{
  "id": "optional-service",
  "maxRetries": 3
}
```

### 3. 开发模式热重载

在开发环境使用 `--dev` 启动 PocketBase，所有进程自动启用热重载：

```bash
./pocketbase serve --dev
```

或在配置中单独启用：

```json
{
  "id": "my-agent",
  "devMode": true,
  "watchPaths": ["./src", "./config"]
}
```

### 4. 日志查看

子进程的 stdout 和 stderr 会输出到 PocketBase 日志：

- **stdout** → Info 级别
- **stderr** → Error 级别

使用 PocketBase 的日志系统查看进程输出。

## 注意事项

1. **Windows 兼容性**：进程信号在 Windows 上的行为可能不同
2. **配置文件路径**：相对路径基于 PocketBase 数据目录解析
3. **maxRetries=-1**：表示无限重试，进程永远不会被放弃
4. **日志级别**：stdout 输出为 Info 级别，stderr 输出为 Error 级别
5. **进程隔离**：每个进程在独立的进程组中运行，便于清理

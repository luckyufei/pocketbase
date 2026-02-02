# Process Manager UI - 研究笔记

## PM2 Monit 功能分析

PM2 monit 是一个终端实时监控界面，提供以下核心能力：

### 进程列表视图

```
┌─ Process List ───────────────────────────────────────────────────────────┐
│ App name │ id │ mode │ pid │ status │ restart │ uptime │ cpu │ mem      │
├──────────┼────┼──────┼─────┼────────┼─────────┼────────┼─────┼──────────┤
│ app      │ 0  │ fork │ 123 │ online │ 0       │ 5h     │ 0%  │ 52.5 MB  │
│ worker   │ 1  │ fork │ 456 │ online │ 3       │ 2h     │ 1%  │ 89.2 MB  │
└──────────┴────┴──────┴─────┴────────┴─────────┴────────┴─────┴──────────┘
```

### 日志面板

- 实时显示 stdout/stderr
- 按进程筛选
- 颜色区分不同日志级别

### 关键指标

1. **状态**: online, stopping, stopped, launching, errored, one-launch-status
2. **重启次数**: restart count
3. **运行时长**: uptime (human readable)
4. **资源占用**: CPU %, Memory (需要额外采集)

### PM2 CLI 命令对应

| PM2 命令 | UI 操作 | API 端点 |
|----------|---------|----------|
| `pm2 list` | 查看列表 | `GET /api/pm/list` |
| `pm2 restart <id>` | 重启按钮 | `POST /api/pm/{id}/restart` |
| `pm2 stop <id>` | 停止按钮 | `POST /api/pm/{id}/stop` |
| `pm2 start <id>` | 启动按钮 | `POST /api/pm/{id}/start` |
| `pm2 logs <id>` | 日志面板 | `GET /api/pm/{id}/logs` |
| `pm2 describe <id>` | 详情面板 | 复用 list 数据 |
| `pm2 monit` | 整个页面 | - |

## 现有 processman API 分析

### GET /api/pm/list

当前返回格式：
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

### 缺失的 API

1. **日志获取 API**: 需要新增 `GET /api/pm/{id}/logs`
   - 参数: `lines` (返回行数), `since` (时间戳)
   - 返回: 日志行数组

2. **进程配置 API**: 需要新增或扩展 list 返回配置信息
   - Command, Args, Cwd, Env, Interpreter 等

3. **启动 API**: 需要新增 `POST /api/pm/{id}/start`
   - 当前只有 restart/stop

## UI 组件参考

### Jobs 页面参考

`ui-v2/src/pages/settings/Jobs.tsx` 结构：

```
- JobsStats (统计卡片)
- JobsFilters (筛选器)
- JobsList (列表)
- AlertDialog (删除确认)
```

可复用模式：
- 统计卡片布局
- 筛选器设计
- 列表 + 分页
- 操作确认对话框

### shadcn/ui 组件选型

| 功能 | 组件 |
|------|------|
| 统计卡片 | Card + CardHeader + CardContent |
| 进程列表 | 自定义卡片列表 |
| 状态徽章 | Badge |
| 操作按钮 | Button (variant: outline/destructive) |
| 详情面板 | Sheet |
| 日志面板 | Drawer 或 Dialog |
| 筛选下拉 | Select |
| 搜索框 | Input |
| 确认对话框 | AlertDialog |
| 加载状态 | Skeleton |
| Toast 提示 | Toast (已集成) |

## 状态管理设计

### Jotai Atoms

```typescript
// 进程列表
export const processesAtom = atom<ProcessState[]>([])
export const processesLoadingAtom = atom(false)

// 筛选状态
export const processFilterAtom = atom<{
  status: 'all' | 'running' | 'stopped' | 'failed'
  search: string
}>({ status: 'all', search: '' })

// 选中的进程 (用于详情/日志面板)
export const selectedProcessIdAtom = atom<string | null>(null)

// 派生 atom: 筛选后的列表
export const filteredProcessesAtom = atom((get) => {
  const processes = get(processesAtom)
  const filter = get(processFilterAtom)
  
  return processes.filter(p => {
    if (filter.status !== 'all' && p.status !== filter.status) return false
    if (filter.search && !p.id.includes(filter.search)) return false
    return true
  })
})
```

### Hook 设计

```typescript
// useProcesses.ts
export function useProcesses() {
  // 列表状态
  const [processes, setProcesses] = useAtom(processesAtom)
  const [loading, setLoading] = useAtom(processesLoadingAtom)
  
  // API 操作
  const loadProcesses = async () => { ... }
  const restartProcess = async (id: string) => { ... }
  const stopProcess = async (id: string) => { ... }
  const startProcess = async (id: string) => { ... }
  
  // 自动刷新
  useEffect(() => {
    const interval = setInterval(loadProcesses, 5000)
    return () => clearInterval(interval)
  }, [])
  
  return {
    processes,
    loading,
    loadProcesses,
    restartProcess,
    stopProcess,
    startProcess,
  }
}
```

## 日志实现方案

### 方案 1: 轮询 (首选)

优点: 实现简单，不需要后端改动
缺点: 延迟较高 (1s)，带宽浪费

```typescript
// useProcessLogs.ts
function useProcessLogs(processId: string) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  
  useEffect(() => {
    const fetchLogs = async () => {
      const newLogs = await api.getProcessLogs(processId, { lines: 100 })
      setLogs(newLogs)
    }
    
    fetchLogs()
    const interval = setInterval(fetchLogs, 1000)
    return () => clearInterval(interval)
  }, [processId])
  
  return { logs, autoScroll, setAutoScroll }
}
```

### 方案 2: SSE (Server-Sent Events)

需要后端支持:
```go
// api.go
func (pm *ProcessManager) handleLogsStream(c echo.Context) error {
    c.Response().Header().Set("Content-Type", "text/event-stream")
    // ... 订阅日志流并推送
}
```

### 方案 3: WebSocket

最复杂，但支持双向通信（如发送命令）

**决策**: 首期使用轮询，后续根据需求升级

## 性能考虑

### 大量进程场景

当进程数 > 50 时：
1. 使用虚拟列表 (react-virtual)
2. 分页加载
3. 懒加载详情

### 日志大量输出

1. 限制显示行数 (最近 1000 行)
2. 虚拟滚动
3. 日志聚合 (相同内容折叠)

## 后端 API 扩展需求

### 新增: 日志获取 API

```
GET /api/pm/{id}/logs?lines=100&since=2026-01-30T10:00:00Z
```

响应:
```json
{
  "logs": [
    {
      "timestamp": "2026-01-30T10:00:01Z",
      "stream": "stdout",
      "content": "Starting server..."
    }
  ],
  "hasMore": true
}
```

### 新增: 启动 API

```
POST /api/pm/{id}/start
```

响应:
```json
{
  "message": "Process started",
  "id": "ai-agent"
}
```

### 扩展: 列表 API 返回配置

```json
{
  "id": "ai-agent",
  "pid": 4021,
  "status": "running",
  // ... 现有字段
  "config": {
    "command": "python3",
    "script": "agent.py",
    "args": ["--model", "gpt-4"],
    "cwd": "/app/agents",
    "env": {"OPENAI_API_KEY": "sk-****"},
    "interpreter": "/app/agents/.venv/bin/python",
    "maxRetries": 10,
    "backoff": "2s",
    "devMode": true,
    "watchPaths": ["./src"]
  }
}
```

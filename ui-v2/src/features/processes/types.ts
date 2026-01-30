/**
 * Process Manager 类型定义
 * 映射后端 processman 插件的数据结构
 */

/**
 * 进程状态
 * 对应后端 ProcessState.Status
 */
export type ProcessStatus = 'running' | 'stopped' | 'crashed' | 'starting'

/**
 * 进程运行时状态
 * 对应后端 ProcessState 结构
 */
export interface ProcessState {
  id: string
  pid: number
  status: ProcessStatus
  startTime: string
  uptime: string // 人类可读格式 "1h30m", "5s" 等
  restartCount: number
  lastError?: string
}

/**
 * 进程配置（只读展示）
 * 对应后端 ProcessConfig 结构
 */
export interface ProcessConfig {
  id: string
  script?: string
  command?: string
  args?: string[]
  cwd: string
  env?: Record<string, string>
  interpreter?: string
  maxRetries?: number
  backoff?: string
  devMode?: boolean
  watchPaths?: string[]
}

/**
 * 进程日志条目
 * 对应后端 LogEntry 结构
 */
export interface ProcessLog {
  timestamp: string
  processId: string
  stream: 'stdout' | 'stderr'
  content: string
}

/**
 * 进程统计数据
 */
export interface ProcessStats {
  total: number
  running: number
  stopped: number
  crashed: number
}

/**
 * 进程筛选条件
 */
export interface ProcessFilter {
  status: ProcessStatus | 'all'
  search: string
}

/**
 * API 响应 - 进程列表
 */
export type ProcessListResponse = ProcessState[]

/**
 * API 响应 - 操作结果
 */
export interface ProcessActionResponse {
  message: string
  id: string
}

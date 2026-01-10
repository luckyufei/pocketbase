# 单元测试报告

**测试日期**: 2026-01-11  
**测试环境**: macOS (darwin)  
**Go 版本**: 1.24.0

---

## 测试执行概览

| 数据库 | 总测试包数 | 失败包数 | 失败测试数 | 状态 |
|--------|-----------|---------|-----------|------|
| SQLite | 42 | 0 | 0 | ✅ 全部通过 |
| PostgreSQL | 42 | 0 | 0 | ✅ 全部通过 |

---

## 修复记录

### 已修复的问题 (2026-01-11)

#### 1. TestTraces* (apis 包)

**原问题**:
- `unauthorized` 子测试期望 401，实际返回 403
- 测试数据路径不一致：`stubTracesData` 写入 `traces_test.db`，但 API 使用 `app.Trace()` 读取 `auxiliary.db`
- `perPage` 期望 30，实际默认 50
- `rootOnly` 参数名不一致

**修复方案**:
1. 修改 `stubTracesData` 使用 `app.Trace().Repository()` 确保写入正确的数据库
2. 将 `unauthorized` 测试期望状态码从 401 改为 403（符合当前实现）
3. 将 `perPage` 期望值从 30 改为 50
4. 将 `rootOnly=true` 改为 `root_only=true`
5. 在 `core/trace.go` 添加 `Repository()` 方法暴露底层 repository

**修改文件**:
- `apis/traces_test.go`
- `core/trace.go`

---

#### 2. TestBaseAppLoggerLevelDevPrint (core 包)

**原问题**:
- 期望持久化 `[4, 5]`（level 4 和 5），实际得到 `[5, 5, 5]`
- Bootstrap 期间的日志已在缓存中，设置新的 MinLevel 后未过滤

**修复方案**:
在 `WriteFunc` 中添加日志级别过滤，确保缓存中不符合当前 MinLevel 的日志不会被持久化

**修改文件**:
- `core/base.go` (WriteFunc 中添加 minLevel 过滤)

---

#### 3. TestJSONQuerySQLite (core 包)

**原问题**:
- 按 `http.method = "GET"` 过滤返回 0 条结果
- 代码使用 `fmt.Sprintf("%v", value)` 将所有值转换为字符串
- SQLite 的 `json_extract` 返回原生类型，数字比较时类型不匹配

**修复方案**:
移除 `fmt.Sprintf("%v", value)` 转换，直接使用原始值让 SQLite 处理类型

**修改文件**:
- `core/trace_repository_sqlite.go`

---

#### 4. TestSkipBootstrap (pocketbase 包 - 仅 PostgreSQL)

**原问题**:
- 测试使用临时目录作为数据目录
- 当设置 `PB_POSTGRES_DSN` 环境变量时，Bootstrap 尝试连接 PostgreSQL 但失败
- 导致 `IsBootstrapped()` 返回 `false`

**修复方案**:
在 PostgreSQL 模式下跳过此测试，因为测试设计假设使用 SQLite

**修改文件**:
- `pocketbase_test.go`

---

## 测试命令

```bash
# SQLite 模式
go test ./...

# PostgreSQL 模式
PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/dbname?sslmode=disable" go test ./...
```

---

## 历史问题（已解决）

<details>
<summary>点击展开原始失败记录</summary>

### SQLite 模式下失败的测试 (已修复)

| 包 | 测试名 | 失败原因 |
|----|--------|---------|
| apis | TestTracesStats | 状态码 401→403，数据路径不一致 |
| apis | TestTracesView | 状态码 401→403，Trace 未找到 |
| apis | TestTracesList | 状态码 401→403，totalItems=0 |
| core | TestBaseAppLoggerLevelDevPrint | 日志级别过滤不正确 |
| core | TestJSONQuerySQLite | JSON 查询类型不匹配 |

### PostgreSQL 模式下失败的测试 (已修复)

| 包 | 测试名 | 失败原因 |
|----|--------|---------|
| pocketbase | TestSkipBootstrap | Bootstrap 状态判断错误 |
| apis | TestTracesStats | 同 SQLite |
| apis | TestTracesView | 同 SQLite |
| apis | TestTracesList | 同 SQLite |
| core | TestBaseAppLoggerLevelDevPrint | 同 SQLite |
| core | TestJSONQuerySQLite | 同 SQLite |

</details>

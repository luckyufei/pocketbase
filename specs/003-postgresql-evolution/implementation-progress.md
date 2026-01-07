# PostgreSQL 迁移实现进度

> 最后更新: 2026-01-07

## 已完成的工作

### 1. 基础设施 (T-1.4.x)

#### T-1.4.1: 集成 dockertest 库 ✅
- 添加依赖: `github.com/ory/dockertest/v3`
- 添加依赖: `github.com/jackc/pgx/v5` 及其 stdlib

#### T-1.4.2: PostgreSQL 容器启动逻辑 ✅
- 文件: `tests/postgres.go`
- 实现:
  - `PostgresContainer` 结构体
  - `NewPostgresContainer()` 函数
  - 支持自定义 PostgreSQL 版本 (默认 15)
  - 自动连接验证和超时设置
  - 容器自动清理
  - 支持 macOS colima Docker 环境

#### T-1.4.3: 测试 Schema 自动注入 ✅
- 文件: `tests/postgres_schema.go`
- 实现:
  - `PostgresTestSchema()` 返回完整测试 Schema
  - `InitTestSchema()` 初始化数据库结构
  - `InsertTestSuperuser()` 插入测试超级用户
  - `InsertTestUser()` 插入测试用户
  - `InsertTestCollection()` 插入测试 Collection

#### T-1.4.4: PostgreSQL 错误码测试用例 ✅
- 文件: `tests/postgres_errors_test.go`
- 测试覆盖:
  - 唯一约束违反 (23505)
  - 外键约束违反 (23503)
  - 非空约束违反 (23502)
  - 检查约束违反 (23514)
  - 未定义表 (42P01)
  - 未定义列 (42703)
  - 语法错误 (42601)
  - 事务回滚和隔离测试

### 2. 数据库类型检测 (T-1.1.1) ✅

- 文件: `tools/dbutils/dbtype.go`
- 实现:
  - `DBType` 枚举类型 (SQLite, PostgreSQL, Unknown)
  - `DetectDBType()` 从 `*dbx.DB` 检测
  - `DetectDBTypeFromBuilder()` 从 `dbx.Builder` 检测
  - `DetectDBTypeFromDriverName()` 从驱动名称检测

### 3. 类型转换 (T-1.1.5) ✅

- 文件: `tools/dbutils/type_conversion.go`
- 实现:
  - `BoolValue()` - 布尔值转换 (支持 SQLite 0/1 和 PostgreSQL true/false)
  - `IntValue()` - 整数转换
  - `FloatValue()` - 浮点数转换
  - `StringValue()` - 字符串转换
  - `TimeValue()` - 时间转换 (支持 PostgreSQL TIMESTAMPTZ)
  - `FormatTimeForDB()` - 格式化时间为数据库格式
  - `FormatBoolForDB()` - 格式化布尔值为数据库格式
  - `NullString/NullInt64/NullFloat64/NullBool/NullTime` 辅助函数

### 4. JSON 函数转换 (T-1.2.2, T-1.2.6) ✅

#### SQLite 兼容函数 (保持不变)
- 文件: `tools/dbutils/json.go`
- 函数: `JSONEach()`, `JSONArrayLength()`, `JSONExtract()`

#### PostgreSQL 兼容函数 (新增)
- 文件: `tools/dbutils/json_pg.go`
- 函数:
  - `JSONEachPG()` - 使用 `jsonb_array_elements`
  - `JSONArrayLengthPG()` - 使用 `jsonb_array_length`
  - `JSONExtractPG()` - 使用 `jsonb_path_query_first` (PG 12+)
  - `JSONExtractTextPG()` - 使用 `#>>` 操作符
  - `JSONContainsPG()` - 使用 `@>` 操作符
  - `JSONExistsPG()` - 使用 `?` 操作符
  - `JSONTypePG()` - 使用 `jsonb_typeof`
  - `JSONValidPG()` - 使用自定义 `pb_is_json` 函数
  - `CreatePGHelperFunctions()` - 创建 PostgreSQL 辅助函数 SQL

#### 统一接口 (新增)
- 文件: `tools/dbutils/json_unified.go`
- `JSONFunctions` 结构体，根据数据库类型自动选择正确的实现

#### JSON 集成测试 ✅
- 文件: `tests/postgres_json_test.go`
- 测试覆盖:
  - JSON 路径提取 (简单/嵌套/数组)
  - JSON 数组操作 (长度/包含/展开)
  - JSON 比较操作 (数值/字符串/LIKE/IN)
  - JSON 修改操作 (jsonb_set/concat/delete)
  - JSON 聚合操作 (jsonb_agg/jsonb_object_agg)

### 5. 错误处理 (T-1.4.4) ✅

- 文件: `tools/dbutils/errors.go`
- 实现:
  - PostgreSQL 错误码常量
  - `GetPGErrorCode()` - 提取错误码
  - `GetPGErrorDetail()` - 提取错误详情
  - `GetPGErrorConstraint()` - 提取约束名称
  - `IsUniqueViolation()` - 检测唯一约束违反
  - `IsForeignKeyViolation()` - 检测外键约束违反
  - `IsNotNullViolation()` - 检测非空约束违反
  - `IsCheckViolation()` - 检测检查约束违反
  - `IsDeadlock()` - 检测死锁
  - `IsRetryable()` - 检测可重试错误
  - `IsTableNotFound()` - 检测表不存在
  - `IsColumnNotFound()` - 检测列不存在

### 6. 连接池监控 (T-1.5.3) ✅

- 文件: `tools/dbutils/pool_monitor.go`
- 实现:
  - `PoolStats` - 连接池统计信息
  - `GetPoolStats()` - 获取连接池统计
  - `LeakDetector` - 连接泄漏检测器
  - `PoolMonitor` - 连接池监控器
  - 支持泄漏阈值配置
  - 支持泄漏回调通知
  - 支持调用栈追踪

### 7. PostgreSQL 连接支持 (T-1.5.1, T-1.5.2) ✅

- 文件: `core/db_connect_pg.go`
- 实现:
  - `PostgresConfig` 配置结构体
  - `PostgresDBConnect()` 连接函数
  - `IsPostgresDSN()` DSN 格式检测
  - `IsSQLitePath()` SQLite 路径检测
  - `DBConnect()` 自动选择数据库类型

### 8. PostgreSQL 迁移脚本 (T-0.1.5) ✅

- 文件: `migrations/postgres_init.go`
- 实现:
  - `PostgresInitSQL()` 初始化 SQL (辅助函数 + 扩展)
  - `InitPostgresHelpers()` 初始化辅助函数
  - `PostgresCollectionsTableSQL()` _collections 表
  - `PostgresParamsTableSQL()` _params 表
  - `GeneratePostgresRecordTableSQL()` 动态生成记录表
  - `ConvertSQLiteTypeToPostgres()` 类型映射

### 9. PostgreSQL 15 集成测试 (T-0.1.7) ✅

- 文件: `tests/postgres_integration_test.go`
- 测试覆盖:
  - 辅助函数测试 (pb_is_json, pb_json_array_length, uuid_generate_v7)
  - JSONB 路径查询测试
  - JSONB 操作符测试
  - JSONFunctions 适配器测试
  - 类型转换测试 (BOOLEAN, TIMESTAMPTZ, TEXT 主键)
  - GIN 索引测试
  - 事务测试

## 新增文件列表

```
tools/dbutils/
├── dbtype.go               # 数据库类型检测
├── dbtype_test.go          # 类型检测测试
├── json_pg.go              # PostgreSQL JSON 函数
├── json_pg_test.go         # PostgreSQL JSON 测试
├── json_unified.go         # 统一 JSON 接口
├── json_unified_test.go    # 统一接口测试
├── type_conversion.go      # 类型转换函数
├── type_conversion_test.go # 类型转换测试
├── errors.go               # 错误处理函数
├── pool_monitor.go         # 连接池监控
└── pool_monitor_test.go    # 监控测试

core/
├── db_adapter.go           # DBAdapter 接口定义
├── db_adapter_test.go      # 适配器接口测试
├── db_adapter_sqlite.go    # SQLite 适配器实现
├── db_adapter_sqlite_test.go # SQLite 适配器测试
├── db_adapter_postgres.go  # PostgreSQL 适配器实现
├── db_adapter_postgres_test.go # PostgreSQL 适配器测试
├── base_adapter_test.go    # BaseApp 适配器集成测试
├── db_connect_pg.go        # PostgreSQL 连接
└── db_connect_pg_test.go   # 连接测试

migrations/
├── postgres_init.go        # PostgreSQL 初始化迁移
└── postgres_init_test.go   # 迁移测试

tests/
├── postgres.go             # PostgreSQL 容器管理
├── postgres_test.go        # 容器测试
├── postgres_schema.go      # 测试 Schema
├── postgres_integration_test.go  # PostgreSQL 15 集成测试
├── postgres_json_test.go   # JSON 操作测试
└── postgres_errors_test.go # 错误码测试
```

## 修改文件列表

```
go.mod                  # 添加 pgx, dockertest 依赖
go.sum                  # 依赖锁定
core/base.go            # 添加 DBAdapter 字段和相关方法
```

## 测试覆盖

所有新增代码都有对应的单元测试：

```bash
# 运行所有新增测试
go test ./tools/dbutils/... -v
go test ./core/... -run "Postgres|SQLite|DBAdapter|BaseApp" -v
go test ./migrations/... -run "Postgres" -v
go test ./tests/... -run "Postgres" -v -timeout 600s
```

## 下一步工作

### 高优先级
1. T-1.4.5: 配置 CI/CD 双数据库测试
2. T-1.2.5: 实现 GIN 索引自动创建逻辑
3. T-2.1.x: LISTEN/NOTIFY 基础设施

### 中优先级
1. T-3.x.x: 可观测性系统
2. T-4.x.x: 行级安全性

### 已完成验证
- ✅ PostgreSQL 15 容器集成测试
- ✅ 完整 Schema 初始化测试
- ✅ JSON 查询功能测试
- ✅ 错误码处理测试
- ✅ 连接泄漏检测测试
- ✅ DBAdapter 接口定义和实现
- ✅ SQLite/PostgreSQL 适配器
- ✅ BaseApp 适配器集成
- ✅ **STORY-5.1: WAL 消费者实现** (2026-01-07)
  - WAL 消费者配置和生命周期管理
  - 复制槽管理 (创建/删除/检查)
  - 流式连接建立
  - WAL 消息解码器 (pgoutput 协议)
  - WAL 消息到 Record 事件转换
  - Realtime 订阅管理器集成
- ✅ **STORY-5.2: 事件权限过滤** (2026-01-07)
  - 订阅者迭代器 (遍历/过滤)
  - ViewRule 评估器增强 (角色规则支持)
  - 规则分类器 (静态/动态)
  - 静态规则广播器
  - 动态规则精确推送
  - 布隆过滤器优化
  - 角色分组优化
  - 权限过滤器集成
- ✅ **STORY-7.1: 向量字段类型** (2026-01-07)
  - Vector 类型定义和序列化
  - VectorField 字段类型实现
  - HNSW/IVFFlat 索引支持
  - 距离查询操作符 (<->, <=>, <#>)
  - pgvector 扩展自动创建
- ✅ **STORY-7.2: 全文搜索优化** (2026-01-07)
  - pg_trgm 扩展支持
  - GIN 索引加速 LIKE 查询
  - tsvector 全文搜索实现
  - 搜索结果高亮
  - 性能对比测试辅助
- ✅ **STORY-8.1: 启动引导改造** (2026-01-07)
  - PostgreSQL 连接检查和验证
  - Schema 检查器
  - 初始化 SQL 生成
  - 超级用户引导
  - 启动状态管理
- ✅ **STORY-8.2: 备份导出集成** (2026-01-07)
  - 备份请求拦截器
  - pg_dump 命令生成
  - ZIP 写入器
  - 文件收集器
  - 自动备份调度器
- ✅ **STORY-8.3: 容器化部署模板** (2026-01-07)
  - Dockerfile 生成器
  - docker-compose 生成器
  - 环境变量配置
  - 健康检查配置
  - 持久化卷配置

## 新增文件 (STORY-5.1)

```
core/
├── db_wal_consumer.go           # WAL 消费者配置和生命周期
├── db_wal_consumer_test.go      # WAL 消费者测试
├── db_wal_replication.go        # 复制连接和槽管理
├── db_wal_replication_test.go   # 复制连接测试
├── db_wal_decoder.go            # WAL 消息解码器
├── db_wal_decoder_test.go       # 解码器测试
├── db_wal_integration.go        # Realtime 引擎集成
└── db_wal_integration_test.go   # 集成测试
```

## 新增文件 (STORY-5.2)

```
core/
├── db_permission_filter.go      # 权限过滤器实现
└── db_permission_filter_test.go # 权限过滤器测试
```

## 新增文件 (STORY-7.1)

```
tools/types/
├── vector.go                    # Vector 类型定义
└── vector_test.go               # Vector 类型测试

core/
├── field_vector.go              # VectorField 字段类型
└── field_vector_test.go         # VectorField 测试
```

## 新增文件 (STORY-7.2)

```
tools/dbutils/
├── fulltext_pg.go               # 全文搜索实现
└── fulltext_pg_test.go          # 全文搜索测试
```

## 新增文件 (STORY-8.1)

```
core/
├── db_bootstrap_pg.go           # PostgreSQL 启动引导
└── db_bootstrap_pg_test.go      # 启动引导测试
```

## 新增文件 (STORY-8.2)

```
core/
├── db_backup_pg.go              # PostgreSQL 备份实现
└── db_backup_pg_test.go         # 备份测试
```

## 新增文件 (STORY-8.3)

```
core/
├── db_container_pg.go           # 容器化部署配置
└── db_container_pg_test.go      # 容器化测试
```

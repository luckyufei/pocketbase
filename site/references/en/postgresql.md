# PostgreSQL 使用指南

本文档详细说明如何在 PocketBase 中使用 PostgreSQL 作为数据库后端。

## 快速开始

### 1. 准备 PostgreSQL 数据库

```bash
# 使用 Docker 快速启动 PostgreSQL
docker run -d \
  --name pocketbase-postgres \
  -e POSTGRES_USER=pocketbase \
  -e POSTGRES_PASSWORD=pocketbase \
  -e POSTGRES_DB=pocketbase \
  -p 5432:5432 \
  postgres:16
```

### 2. 启动 PocketBase

```bash
# 方式一：使用命令行参数
./pocketbase serve --pg="postgres://pocketbase:pocketbase@localhost:5432/pocketbase?sslmode=disable"

# 方式二：使用环境变量
export PB_POSTGRES_DSN="postgres://pocketbase:pocketbase@localhost:5432/pocketbase?sslmode=disable"
./pocketbase serve
```

### 3. 访问管理界面

打开浏览器访问 `http://localhost:8090/_/` 创建管理员账户。

## 系统要求

### PostgreSQL 版本

| 版本 | 支持状态 | 说明 |
|------|----------|------|
| PostgreSQL 16 | ✅ 推荐 | 最新稳定版，完整功能支持 |
| PostgreSQL 15 | ✅ 支持 | 完整功能支持 |
| PostgreSQL 14 | ⚠️ 有限支持 | 基础功能可用，部分高级特性不可用 |
| PostgreSQL 13 及以下 | ❌ 不支持 | 缺少必要的 JSONB 函数 |

### 必需扩展

```sql
-- pg_trgm 扩展用于模糊搜索（可选但推荐）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## 配置方式

### 命令行参数

```bash
./pocketbase serve --pg="postgres://user:password@host:port/dbname?sslmode=disable"
```

### 环境变量

```bash
# 设置 PostgreSQL 连接字符串
export PB_POSTGRES_DSN="postgres://user:password@host:port/dbname?sslmode=disable"

# 启动服务
./pocketbase serve
```

### 优先级

命令行参数 > 环境变量 > 默认值（SQLite）

## 连接字符串格式

### 标准 URI 格式

```
postgres://[user[:password]@][host][:port][/dbname][?param1=value1&...]
```

### 示例

```bash
# 基础连接
postgres://user:password@localhost:5432/pocketbase

# 禁用 SSL（开发环境）
postgres://user:password@localhost:5432/pocketbase?sslmode=disable

# 启用 SSL（生产环境）
postgres://user:password@db.example.com:5432/pocketbase?sslmode=require

# 完整配置
postgres://user:password@localhost:5432/pocketbase?sslmode=disable&connect_timeout=10&application_name=pocketbase
```

### 连接参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `sslmode` | SSL 连接模式 | `prefer` |
| `connect_timeout` | 连接超时（秒） | 无限制 |
| `application_name` | 应用程序名称 | `pocketbase` |
| `timezone` | 时区设置 | `UTC` |

### SSL 模式

| 模式 | 说明 |
|------|------|
| `disable` | 禁用 SSL |
| `allow` | 优先非 SSL，失败时尝试 SSL |
| `prefer` | 优先 SSL，失败时尝试非 SSL |
| `require` | 必须使用 SSL |
| `verify-ca` | 验证服务器证书 |
| `verify-full` | 验证服务器证书和主机名 |

## Docker 部署

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: pocketbase-postgres
    environment:
      POSTGRES_USER: pocketbase
      POSTGRES_PASSWORD: pocketbase
      POSTGRES_DB: pocketbase
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pocketbase"]
      interval: 10s
      timeout: 5s
      retries: 5

  pocketbase:
    image: pocketbase/pocketbase:latest
    container_name: pocketbase
    environment:
      PB_POSTGRES_DSN: postgres://pocketbase:pocketbase@postgres:5432/pocketbase?sslmode=disable
    ports:
      - "8090:8090"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pocketbase_data:/pb_data

volumes:
  postgres_data:
  pocketbase_data:
```

### 启动服务

```bash
docker-compose up -d
```

## 连接池配置

### 架构差异

| 特性 | SQLite | PostgreSQL |
|------|--------|------------|
| 主数据库 | `data.db` 文件 | 同一数据库 |
| 辅助数据库 | `auxiliary.db` 文件 | 共享主数据库连接 |
| 连接池数量 | 4 个（主+辅助，各有并发/非并发） | 2 个（共享连接池） |

**PostgreSQL 优化**：由于所有表都在同一个数据库中，PostgreSQL 模式自动共享连接池，减少资源占用。

### 默认配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `dataMaxOpenConns` | 120 | 最大打开连接数 |
| `dataMaxIdleConns` | 15 | 最大空闲连接数 |
| `auxMaxOpenConns` | 20 | 辅助数据库最大打开连接数（仅 SQLite） |
| `auxMaxIdleConns` | 3 | 辅助数据库最大空闲连接数（仅 SQLite） |

### 命令行参数配置

```bash
# PostgreSQL 模式 - 只需配置主数据库连接池
./pocketbase serve \
  --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable" \
  --dataMaxOpenConns=100 \
  --dataMaxIdleConns=25

# SQLite 模式 - 可配置主数据库和辅助数据库连接池
./pocketbase serve \
  --dataMaxOpenConns=120 \
  --dataMaxIdleConns=15 \
  --auxMaxOpenConns=20 \
  --auxMaxIdleConns=3
```

::: info 注意
PostgreSQL 模式下 `--auxMaxOpenConns` 和 `--auxMaxIdleConns` 参数会被忽略，因为辅助数据库共享主数据库连接池。
:::

### 代码配置

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DefaultPostgresDSN: "postgres://user:pass@localhost:5432/pocketbase?sslmode=disable",
        DataMaxOpenConns:   100,  // 最大打开连接数
        DataMaxIdleConns:   25,   // 最大空闲连接数
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 连接池调优建议

| 场景 | dataMaxOpenConns | dataMaxIdleConns |
|------|------------------|------------------|
| 低并发（< 100 QPS） | 25-50 | 5-10 |
| 中等并发（100-500 QPS） | 50-100 | 10-25 |
| 高并发（> 500 QPS） | 100-200 | 25-50 |

::: warning 重要
确保 PostgreSQL 服务器的 `max_connections` 设置大于 `dataMaxOpenConns`。
:::

## PostgreSQL 特性

### JSONB 支持

PocketBase 在 PostgreSQL 中使用 JSONB 类型存储 JSON 字段，支持：

- 高效的 JSON 查询
- GIN 索引加速
- 部分更新

### GIN 索引

自动为 JSONB 字段创建 GIN 索引，优化查询性能：

```sql
-- 自动创建的索引示例
CREATE INDEX idx_posts_data_gin ON posts USING GIN (data jsonb_path_ops);
```

### 行级安全策略 (RLS)

PostgreSQL 版本支持原生 RLS，可通过 SQL 直接配置：

```sql
-- 启用 RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY posts_view ON posts FOR SELECT USING (true);
CREATE POLICY posts_owner ON posts FOR ALL USING (user_id = current_setting('pb.auth.id', true));
```

### 全文搜索

利用 PostgreSQL 原生全文搜索功能：

```sql
-- 创建全文搜索索引
CREATE INDEX idx_posts_content_fts ON posts USING GIN (to_tsvector('english', content));
```

## 从 SQLite 迁移

### 导出 SQLite 数据

```bash
# 使用 pocketbase 导出数据
./pocketbase export --output=backup.zip
```

### 导入到 PostgreSQL

```bash
# 使用 PostgreSQL 模式启动并导入
./pocketbase serve --pg="postgres://..." --import=backup.zip
```

### 注意事项

1. **数据类型差异**：SQLite 的动态类型会自动转换为 PostgreSQL 的强类型
2. **日期时间**：确保时区设置一致（推荐 UTC）
3. **自增 ID**：SQLite 的 ROWID 会转换为 PostgreSQL 的 SERIAL

## 性能优化

### 1. 连接池调优

通过命令行参数调整连接池大小：

```bash
# 高并发场景
./pocketbase serve --pg="postgres://..." --dataMaxOpenConns=100 --dataMaxIdleConns=25

# 低并发场景
./pocketbase serve --pg="postgres://..." --dataMaxOpenConns=25 --dataMaxIdleConns=5
```

### 2. 索引优化

为常用查询字段创建索引：

```sql
-- 为 email 字段创建索引
CREATE INDEX idx_users_email ON users (email);

-- 为 JSONB 字段创建 GIN 索引
CREATE INDEX idx_posts_tags ON posts USING GIN ((data->'tags'));
```

### 3. 查询优化

使用 EXPLAIN ANALYZE 分析慢查询：

```sql
EXPLAIN ANALYZE SELECT * FROM posts WHERE data @> '{"status": "published"}';
```

### 4. 配置优化

PostgreSQL 服务器配置建议：

```ini
# postgresql.conf
shared_buffers = 256MB          # 25% 系统内存
effective_cache_size = 768MB    # 75% 系统内存
work_mem = 16MB
maintenance_work_mem = 128MB
random_page_cost = 1.1          # SSD 存储
```

## 故障排除

### 连接失败

```
错误: PostgreSQL 连接验证失败: dial tcp: connection refused
```

**解决方案**：
1. 检查 PostgreSQL 服务是否运行
2. 验证主机和端口是否正确
3. 检查防火墙设置

### 认证失败

```
错误: password authentication failed for user "pocketbase"
```

**解决方案**：
1. 验证用户名和密码
2. 检查 `pg_hba.conf` 认证配置
3. 确保用户有数据库访问权限

### SSL 错误

```
错误: SSL is not enabled on the server
```

**解决方案**：
- 开发环境：使用 `sslmode=disable`
- 生产环境：配置 PostgreSQL SSL 证书

### 权限不足

```
错误: permission denied for table xxx
```

**解决方案**：
```sql
GRANT ALL PRIVILEGES ON DATABASE pocketbase TO pocketbase;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pocketbase;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pocketbase;
```

### 扩展缺失

```
错误: function similarity does not exist
```

**解决方案**：
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## 注意事项

### 1. 备份策略

PostgreSQL 需要独立的备份策略：

```bash
# 使用 pg_dump 备份
pg_dump -U pocketbase -h localhost pocketbase > backup.sql

# 恢复
psql -U pocketbase -h localhost pocketbase < backup.sql
```

### 2. 事务隔离

PostgreSQL 默认使用 `READ COMMITTED` 隔离级别，与 SQLite 的 `SERIALIZABLE` 不同。高并发场景下可能需要调整：

```sql
SET default_transaction_isolation = 'serializable';
```

### 3. 连接限制

注意 PostgreSQL 的 `max_connections` 设置，确保大于应用的连接池大小。

### 4. 数据目录

使用 PostgreSQL 时，`pb_data` 目录仍然需要，用于存储：
- 上传的文件
- 备份文件
- 缓存数据
- 配置文件

### 5. 版本兼容性

- 升级 PostgreSQL 版本前，请先备份数据
- 建议使用 PostgreSQL 15 或 16 以获得最佳兼容性

### 6. 生产环境检查清单

- [ ] 使用 SSL 连接（`sslmode=require` 或更高）
- [ ] 配置适当的连接池大小
- [ ] 设置定期备份任务
- [ ] 监控数据库性能
- [ ] 配置日志记录
- [ ] 设置连接超时
- [ ] 使用独立的数据库用户

## 相关资源

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [PocketBase 官方文档](https://pocketbase.io/docs/)
- [pgx 驱动文档](https://github.com/jackc/pgx)

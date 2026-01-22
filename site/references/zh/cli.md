# 命令行接口 (CLI)

PocketBase 提供了一组 CLI 命令来管理你的应用程序。你可以通过运行以下命令查看所有可用的命令：

```bash
./pocketbase --help
```

## 全局标志

这些标志适用于所有命令：

| 标志 | 描述 | 默认值 |
|------|------|--------|
| `--dir` | PocketBase 数据目录 | `./pb_data` |
| `--encryptionEnv` | 环境变量名称，其值（32 个字符）将用作应用设置的加密密钥 | (无) |
| `--dev` | 启用开发模式（将日志和 SQL 语句打印到控制台） | `false`（使用 `go run` 时自动启用） |
| `--queryTimeout` | 默认 SELECT 查询超时时间（秒） | `30` |
| `--pg` | PostgreSQL 连接字符串。设置后，PocketBase 使用 PostgreSQL 而不是 SQLite | (无) |
| `--dataMaxOpenConns` | 主数据库最大打开连接数 | `100` |
| `--dataMaxIdleConns` | 主数据库最大空闲连接数 | `20` |
| `--auxMaxOpenConns` | 辅助数据库最大打开连接数（仅 SQLite） | `4` |
| `--auxMaxIdleConns` | 辅助数据库最大空闲连接数（仅 SQLite） | `2` |

## serve

启动 Web 服务器。

```bash
./pocketbase serve [domain(s)] [flags]
```

### 标志

| 标志 | 描述 | 默认值 |
|------|------|--------|
| `--http` | HTTP 服务器监听的 TCP 地址 | `127.0.0.1:8090`（或指定域名时为 `0.0.0.0:80`） |
| `--https` | HTTPS 服务器监听的 TCP 地址 | (空，或指定域名时为 `0.0.0.0:443`) |
| `--origins` | CORS 允许的域名来源列表 | `*` |

### 示例

```bash
# 使用默认设置启动（localhost:8090）
./pocketbase serve

# 使用自定义 HTTP 地址启动
./pocketbase serve --http="0.0.0.0:8080"

# 为特定域名启用自动 TLS 启动
./pocketbase serve yourdomain.com www.yourdomain.com

# 为 CORS 使用自定义来源启动
./pocketbase serve --origins="https://example.com,https://app.example.com"

# 以开发模式启动并启用 SQL 日志
./pocketbase serve --dev

# 使用 PostgreSQL 后端启动
./pocketbase serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"
```

## superuser

管理超级用户账户。此命令有几个子命令。

### superuser create

创建新的超级用户账户。

```bash
./pocketbase superuser create EMAIL PASSWORD
```

**示例：**
```bash
./pocketbase superuser create admin@example.com MySecurePassword123
```

### superuser upsert

创建新的超级用户，如果电子邮件已存在则更新密码。

```bash
./pocketbase superuser upsert EMAIL PASSWORD
```

**示例：**
```bash
./pocketbase superuser upsert admin@example.com NewPassword456
```

### superuser update

更改现有超级用户的密码。

```bash
./pocketbase superuser update EMAIL PASSWORD
```

**示例：**
```bash
./pocketbase superuser update admin@example.com UpdatedPassword789
```

### superuser delete

删除现有的超级用户账户。

```bash
./pocketbase superuser delete EMAIL
```

**示例：**
```bash
./pocketbase superuser delete admin@example.com
```

### superuser otp

为超级用户生成新的 OTP（一次性密码）。必须为 `_superusers` 集合启用 OTP 认证。

```bash
./pocketbase superuser otp EMAIL
```

**示例：**
```bash
./pocketbase superuser otp admin@example.com
# 输出：
# Successfully created OTP for superuser "admin@example.com":
# ├─ Id:    abc123xyz
# ├─ Pass:  847291
# └─ Valid: 300s
```

## migrate

::: info 注意
`migrate` 命令在将 PocketBase 作为框架使用并注册了 `migratecmd` 插件时可用。
:::

执行数据库迁移脚本。

```bash
./pocketbase migrate [command] [flags]
```

### 子命令

| 命令 | 描述 |
|------|------|
| `up` | 运行所有可用的迁移 |
| `down [number]` | 回滚最后 `[number]` 个已应用的迁移 |
| `create name` | 创建新的空白迁移模板文件 |
| `collections` | 创建包含所有集合快照的新迁移文件 |
| `history-sync` | 确保 `_migrations` 历史表没有对已删除迁移文件的引用 |

### 示例

```bash
# 运行所有待处理的迁移
./pocketbase migrate up

# 回滚上一个迁移
./pocketbase migrate down 1

# 回滚最后 3 个迁移
./pocketbase migrate down 3

# 创建新的迁移文件
./pocketbase migrate create add_posts_collection

# 创建所有集合的快照
./pocketbase migrate collections
```

### 部署前最佳实践

在部署到生产环境之前，建议清理本地迁移文件夹。在开发过程中，自动迁移会创建许多增量的 `*_created.js`、`*_updated.js` 和 `*_deleted.js` 文件。这些可以合并成一个快照以便更干净地部署。

**推荐的工作流程：**

1. **将数据库状态同步到本地迁移文件夹**
   ```bash
   # 创建所有当前集合的快照
   ./pocketbase migrate collections
   ```

2. **清理增量迁移文件**
   
   删除所有自动生成的迁移文件（以 `_created.js`、`_updated.js`、`_deleted.js` 结尾的文件），但**保留你的种子迁移**（例如 `*_seed_*.js`，或任何插入初始数据的自定义迁移）。
   
   ```bash
   # 示例：删除自动生成的迁移（根据需要调整模式）
   rm pb_migrations/*_created.js
   rm pb_migrations/*_updated.js
   rm pb_migrations/*_deleted.js
   ```

3. **同步迁移历史**
   ```bash
   # 从 _migrations 表中删除对已删除迁移文件的引用
   ./pocketbase migrate history-sync
   ```

4. **验证迁移**
   ```bash
   # 确保所有迁移成功运行
   ./pocketbase migrate up
   ```

::: tip 为什么要保留种子迁移？
种子迁移包含初始数据（例如默认分类、管理员用户、配置记录），在设置新数据库时应该应用这些数据。与可以通过 `migrate collections` 重新生成的架构迁移不同，种子数据需要保留。
:::

::: warning
在清理迁移之前始终备份数据库。在新数据库上测试迁移过程，确保没有问题。
:::

## 环境变量

PocketBase 也支持通过环境变量进行配置：

| 变量 | 描述 |
|------|------|
| `PB_POSTGRES_DSN` | PostgreSQL 连接字符串（`--pg` 标志的替代方式） |

**示例：**
```bash
PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/pocketbase" ./pocketbase serve
```

## 示例

### 开发环境设置

```bash
# 启用开发模式运行
./pocketbase serve --dev

# 或使用 go run（自动启用开发模式）
go run main.go serve
```

### 带 TLS 的生产环境设置

```bash
# 通过 Let's Encrypt 自动获取 TLS 证书
./pocketbase serve yourdomain.com --http="0.0.0.0:80" --https="0.0.0.0:443"
```

### 使用 PostgreSQL

```bash
# 通过命令行标志
./pocketbase serve --pg="postgres://user:password@localhost:5432/pocketbase?sslmode=disable"

# 通过环境变量
export PB_POSTGRES_DSN="postgres://user:password@localhost:5432/pocketbase?sslmode=disable"
./pocketbase serve
```

### 自定义数据目录

```bash
# 将数据存储在自定义位置
./pocketbase serve --dir="/var/lib/pocketbase"
```

### 加密设置

```bash
# 使用环境变量中的加密密钥
export PB_ENCRYPTION_KEY="12345678901234567890123456789012"
./pocketbase serve --encryptionEnv="PB_ENCRYPTION_KEY"
```

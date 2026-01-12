# 快速开始

## 运行方式

```bash
# SQLite 模式（默认）
./pocketbase serve

# PostgreSQL 模式
./pocketbase serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"

# 或使用环境变量
PB_POSTGRES_DSN="postgres://..." ./pocketbase serve

# 创建超级用户
./pocketbase superuser create EMAIL PASS

# 启用 HTTPS
./pocketbase serve yourdomain.com
```

## 默认路由

| 路由 | 描述 |
|------|------|
| `http://127.0.0.1:8090` | 静态文件服务（`pb_public` 目录） |
| `http://127.0.0.1:8090/_/` | 超级用户管理仪表板 |
| `http://127.0.0.1:8090/api/` | REST API |

## 目录结构

| 目录 | 描述 |
|------|------|
| `pb_data` | 应用数据、上传文件（应加入 `.gitignore`） |
| `pb_migrations` | JS 迁移文件 |
| `pb_hooks` | JavaScript 钩子文件（`*.pb.js`） |
| `pb_public` | 静态文件目录 |

## 开发模式

```bash
# 使用 go run（开发）
cd examples/base && go run main.go serve

# 构建可执行文件
cd examples/base
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build
```

## 基本项目结构

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.New()

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

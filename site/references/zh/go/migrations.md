# 数据库迁移

PocketBase 支持 Go 迁移，用于版本控制你的数据库架构。

## 创建迁移

迁移是放置在 `pb_migrations` 目录中的 Go 文件。每个迁移文件应该有一个唯一的名称（通常带有时间戳前缀）。

```go
// pb_migrations/1234567890_create_posts.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // 向上迁移
        collection := core.NewBaseCollection("posts")
        
        collection.Fields.Add(&core.TextField{
            Name:     "title",
            Required: true,
        })
        
        return app.Save(collection)
    }, func(app core.App) error {
        // 向下迁移（可选）
        collection, err := app.FindCollectionByNameOrId("posts")
        if err != nil {
            return err
        }
        return app.Delete(collection)
    })
}
```

## 运行迁移

启动 PocketBase 时会自动执行迁移。你也可以手动运行：

```bash
./pocketbase migrate up    # 运行所有待处理的迁移
./pocketbase migrate down  # 回滚上一次迁移
```

## 自动生成迁移

PocketBase 可以从仪表板更改自动生成迁移文件：

```bash
./pocketbase migrate collections
```

这会创建所有当前集合的快照迁移。

## 最佳实践

1. **始终测试迁移** - 在开发环境中测试向上和向下迁移。

2. **保持迁移简小** - 每个迁移应该只做一件事。

3. **使用事务** - 将复杂迁移包装在事务中。

4. **版本控制** - 将迁移文件提交到版本控制系统。

5. **不要修改旧迁移** - 创建新迁移而不是修改现有迁移。

# 数据库迁移（JavaScript）

PocketBase 支持 JavaScript 迁移，用于版本控制你的数据库架构。

## 创建迁移

迁移是放置在 `pb_migrations` 目录中的 JavaScript 文件。

```javascript
// pb_migrations/1234567890_create_posts.js

migrate((app) => {
    // 向上迁移
    const collection = new Collection()
    collection.name = "posts"
    collection.type = "base"
    
    collection.fields.add(new TextField({
        name: "title",
        required: true
    }))
    
    app.save(collection)
}, (app) => {
    // 向下迁移（可选）
    const collection = app.findCollectionByNameOrId("posts")
    app.delete(collection)
})
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

## 迁移文件命名

文件应该使用时间戳前缀命名以确保正确的顺序：

```
pb_migrations/
    1704067200_create_users.js
    1704067300_create_posts.js
    1704067400_add_categories.js
```

## 最佳实践

1. **测试迁移** - 测试向上和向下迁移
2. **保持迁移简小** - 每个迁移一个更改
3. **版本控制** - 将迁移文件提交到 git
4. **不要修改旧迁移** - 创建新的迁移

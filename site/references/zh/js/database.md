# 数据库（JavaScript）

`$app` 全局对象提供对数据库操作的访问。

## 原始查询

```javascript
// 执行查询
$app.db().newQuery("DELETE FROM posts WHERE status = 'archived'").execute()

// 选择单行
const result = new DynamicModel({
    id: "",
    title: "",
    created: ""
})
$app.db()
    .newQuery("SELECT id, title, created FROM posts WHERE id = {:id}")
    .bind({ id: "abc123" })
    .one(result)

// 选择多行
const results = arrayOf(new DynamicModel({
    id: "",
    title: ""
}))
$app.db()
    .newQuery("SELECT id, title FROM posts LIMIT 100")
    .all(results)
```

## 查询构建器

```javascript
// 带条件的查询
const results = arrayOf(new DynamicModel({
    id: "",
    title: ""
}))
$app.db()
    .select("id", "title")
    .from("posts")
    .where($dbx.hashExp({ status: "published" }))
    .orderBy("created DESC")
    .limit(10)
    .all(results)

// 插入
$app.db()
    .insert("posts", {
        id: $security.randomString(15),
        title: "New Post",
        created: new Date().toISOString()
    })
    .execute()

// 更新
$app.db()
    .update("posts", { title: "Updated Title" }, $dbx.hashExp({ id: "abc123" }))
    .execute()

// 删除
$app.db()
    .delete("posts", $dbx.hashExp({ id: "abc123" }))
    .execute()
```

## 事务

```javascript
$app.runInTransaction((txApp) => {
    // 对事务中的所有操作使用 txApp
    const collection = txApp.findCollectionByNameOrId("posts")
    const record = new Record(collection)
    record.set("title", "New Post")
    txApp.save(record)
    
    // 返回 null 提交事务，抛出错误回滚事务
})
```

## 表达式辅助函数

```javascript
// 哈希表达式（AND 条件）
$dbx.hashExp({ status: "active", published: true })

// NOT 表达式
$dbx.not($dbx.hashExp({ status: "draft" }))

// OR 表达式
$dbx.or(
    $dbx.hashExp({ status: "active" }),
    $dbx.hashExp({ featured: true })
)

// AND 表达式
$dbx.and(
    $dbx.hashExp({ status: "active" }),
    $dbx.exp("created > {:date}", { date: "2023-01-01" })
)

// LIKE 表达式
$dbx.like("title", "hello")

// IN 表达式
$dbx.in("status", "active", "pending", "review")
```

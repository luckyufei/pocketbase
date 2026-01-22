# 记录代理

PocketBase 允许你创建自定义记录类型，包装基础 `core.Record` 类型，为你的集合字段提供类型安全的访问器。

## 创建记录代理

```go
type Post struct {
    core.Record
}

// title 字段的类型安全 getter
func (p *Post) Title() string {
    return p.GetString("title")
}

// title 字段的类型安全 setter
func (p *Post) SetTitle(title string) {
    p.Set("title", title)
}

// author 关联的类型安全 getter
func (p *Post) Author() *core.Record {
    return p.ExpandedOne("author")
}

// 发布状态的类型安全 getter
func (p *Post) IsPublished() bool {
    return p.GetBool("published")
}

// 自定义方法
func (p *Post) Summary() string {
    content := p.GetString("content")
    if len(content) > 100 {
        return content[:100] + "..."
    }
    return content
}
```

## 使用记录代理

```go
// 获取记录并转换为代理
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

post := &Post{Record: *record}

// 现在你可以使用类型安全的方法
title := post.Title()
author := post.Author()

// 设置值
post.SetTitle("New Title")
app.Save(&post.Record)
```

## 使用代理创建新记录

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

post := &Post{Record: *core.NewRecord(collection)}
post.SetTitle("My First Post")
post.Set("content", "Hello World!")
post.Set("published", true)

if err := app.Save(&post.Record); err != nil {
    return err
}
```

## 注册记录工厂

用于获取记录时的自动转换：

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // 为 "posts" 集合注册工厂
    e.App.RegisterRecordFactory("posts", func(record *core.Record) core.RecordProxy {
        return &Post{Record: *record}
    })
    
    return e.Next()
})
```

## 优势

1. **类型安全** - 在编译时捕获字段名拼写错误。

2. **IDE 支持** - 获得字段的自动完成和文档。

3. **封装** - 向记录添加自定义方法和业务逻辑。

4. **验证** - 在 setter 中添加字段级验证。

5. **计算字段** - 基于记录数据创建计算属性。

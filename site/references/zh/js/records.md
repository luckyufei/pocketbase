# 记录操作（JavaScript）

## 设置字段值

```javascript
// 设置单个字段
record.set("title", "example")
record.set("users+", "6jyr1y02438et52") // 追加到现有值

// 从对象加载
record.load({
    title: "example",
    content: "Hello World"
})
```

## 获取字段值

```javascript
// 获取字段值
record.get("someField")           // any
record.getBool("someField")       // boolean
record.getString("someField")     // string
record.getInt("someField")        // number
record.getFloat("someField")      // number
record.getDateTime("someField")   // DateTime
record.getStringSlice("someField") // string[]

// 获取展开的关联
record.expandedOne("author")      // Record 或 null
record.expandedAll("categories")  // Record[]
```

## 认证记录方法

```javascript
record.isSuperuser()
record.email()
record.setEmail("new@example.com")
record.verified()
record.setVerified(true)
record.setPassword("newpassword")
record.validatePassword("password")
```

## 获取记录

```javascript
// 通过 ID 查找
const record = $app.findRecordById("posts", "RECORD_ID")

// 通过字段值查找
const record = $app.findFirstRecordByData("posts", "slug", "example")

// 通过过滤器查找
const record = $app.findFirstRecordByFilter("posts", "status = 'active'")

// 查找多个记录
const records = $app.findRecordsByFilter(
    "posts",
    "status = 'active'",
    "-created", // 排序
    100,        // 限制
    0           // 偏移
)

// 查找所有记录
const records = $app.findAllRecords("posts")
```

## 创建记录

```javascript
const collection = $app.findCollectionByNameOrId("posts")
const record = new Record(collection)

record.set("title", "Hello World")
record.set("content", "Lorem ipsum...")

$app.save(record)
```

## 更新记录

```javascript
const record = $app.findRecordById("posts", "RECORD_ID")

record.set("title", "Updated Title")

$app.save(record)
```

## 删除记录

```javascript
const record = $app.findRecordById("posts", "RECORD_ID")

$app.delete(record)
```

## 隐藏/取消隐藏字段

```javascript
onRecordEnrich((e) => {
    // 从响应中隐藏字段
    e.record.hide("secretField")
    
    // 取消隐藏已隐藏的字段
    e.record.unhide("someField")
    
    e.next()
}, "posts")
```

## 记录副本

```javascript
// 原始状态（修改前）
const original = record.original()

// 新副本（最新状态，无展开）
const fresh = record.fresh()

// 完整克隆（带展开和可见性标志）
const clone = record.clone()
```

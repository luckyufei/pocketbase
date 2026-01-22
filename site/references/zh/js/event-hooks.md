# 事件钩子（JavaScript）

修改 PocketBase 的标准方式是通过 JavaScript 代码中的**事件钩子**。

## 钩子结构

所有钩子处理函数都期望你调用 `e.next()` 以继续执行链。

```javascript
onRecordCreateRequest((e) => {
    // 你的逻辑
    e.next() // 继续默认行为
}, "posts")
```

## 应用钩子

### onServe

当应用启动时触发。

```javascript
onServe((e) => {
    // 注册自定义路由、中间件等
    e.next()
})
```

### onBootstrap

当应用启动时触发。

```javascript
onBootstrap((e) => {
    // 自定义初始化逻辑
    e.next()
})
```

## 记录钩子

### onRecordCreate

当创建新记录时触发。

```javascript
onRecordCreate((e) => {
    console.log("Creating record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordUpdate

当更新记录时触发。

```javascript
onRecordUpdate((e) => {
    console.log("Updating record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordDelete

当删除记录时触发。

```javascript
onRecordDelete((e) => {
    console.log("Deleting record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordCreateRequest

在记录创建 API 请求时触发。

```javascript
onRecordCreateRequest((e) => {
    // 如果不是超级用户，将状态覆盖为待审核
    if (!e.hasSuperuserAuth()) {
        e.record.set("status", "pending")
    }
    e.next()
}, "posts")
```

### onRecordUpdateRequest

在记录更新 API 请求时触发。

```javascript
onRecordUpdateRequest((e) => {
    // 自定义验证或修改
    e.next()
}, "posts")
```

### onRecordDeleteRequest

在记录删除 API 请求时触发。

```javascript
onRecordDeleteRequest((e) => {
    // 删除前的自定义验证
    e.next()
}, "posts")
```

### onRecordEnrich

在每次记录丰富时触发。

```javascript
onRecordEnrich((e) => {
    // 动态显示/隐藏记录字段
    if (!e.requestInfo.auth || !e.requestInfo.auth.isSuperuser()) {
        e.record.hide("someSecretField")
    }
    e.next()
}, "articles")
```

## 集合过滤器

大多数记录钩子接受一个可选的集合过滤器作为最后一个参数：

```javascript
// 单个集合
onRecordCreate((e) => { e.next() }, "posts")

// 多个集合
onRecordCreate((e) => { e.next() }, "posts", "comments")

// 所有集合（无过滤器）
onRecordCreate((e) => { e.next() })
```

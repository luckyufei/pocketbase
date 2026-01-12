# API 规则与过滤器

## 规则类型

| 规则 | 描述 | 不满足时返回 |
|------|------|-------------|
| `listRule` | 列表访问 | 200 空列表 |
| `viewRule` | 查看记录 | 404 |
| `createRule` | 创建记录 | 400 |
| `updateRule` | 更新记录 | 404 |
| `deleteRule` | 删除记录 | 404 |

## 规则值

- `null`（锁定）：仅超级用户可执行
- 空字符串：任何人可执行
- 非空字符串：满足过滤表达式的用户可执行

## 过滤器语法

### 操作符

```javascript
=, !=, >, >=, <, <=      // 比较
~, !~                     // LIKE 包含/不包含
?=, ?!=, ?~, ?!~          // 任意匹配（多值字段）
&&, ||, ()                // 逻辑操作
```

### 可用字段

```javascript
someField = "value"
someRelField.status != "pending"
@request.auth.id != ""
@request.body.title != ""
@collection.news.categoryId ?= categoryId
```

### 日期宏

```javascript
@now, @yesterday, @tomorrow
@todayStart, @todayEnd
@monthStart, @monthEnd
@yearStart, @yearEnd
@weekdayStart, @weekdayEnd
```

### 字段修饰符

```javascript
:isset   // 检查字段是否已提交
:changed // 检查字段是否已更改
:length  // 数组字段长度
:each    // 对数组每个元素应用条件
```

## 常用规则示例

```javascript
// 需要登录
@request.auth.id != ""

// 仅作者可操作
author = @request.auth.id

// 基于角色
@request.auth.role = "staff"

// 组合条件
@request.auth.id != "" && status = "published"

// 地理距离过滤
geoDistance(address.lon, address.lat, 23.32, 42.69) < 25

// 检查字段是否修改
@request.body.status:isset = false || @request.auth.role = "admin"

// 关系字段检查
@request.auth.id ?= members.id
```

## API 过滤查询

```javascript
// 列表查询带过滤
const records = await pb.collection('posts').getList(1, 20, {
    filter: 'status = "published" && created > "2024-01-01"',
    sort: '-created',
    expand: 'author'
});
```

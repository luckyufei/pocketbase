# API Contracts: Record CRUD 权限检查

**Feature**: 033-pocketless-check  
**相关 FR**: FR-001, FR-002, FR-003

## 概述

以下 API 端点已存在但缺少权限检查。本契约定义权限检查后的行为变更。

---

## GET /api/collections/{collection}/records

**变更**: 添加 `listRule` 强制执行

### 场景 1: Rule = null (Admin Only)

**Request**:
```http
GET /api/collections/private_posts/records
Authorization: (non-superuser or none)
```

**Response** (403):
```json
{
  "code": 403,
  "message": "Only superusers can perform this action.",
  "data": {}
}
```

### 场景 2: Rule = "" (Public)

**Request**:
```http
GET /api/collections/public_posts/records
```

**Response** (200): 正常返回列表（行为不变）

### 场景 3: Rule = "@request.auth.id != ''" (需认证)

**Request** (无 token):
```http
GET /api/collections/posts/records
```

**Response** (200): 返回空列表
```json
{
  "page": 1,
  "perPage": 30,
  "totalItems": 0,
  "totalPages": 0,
  "items": []
}
```

**Request** (有 token):
```http
GET /api/collections/posts/records
Authorization: Bearer <valid_token>
```

**Response** (200): 返回该用户有权访问的记录

### 场景 4: Rule = "@request.auth.id = author" (记录级权限)

**Request**:
```http
GET /api/collections/posts/records
Authorization: Bearer <user_A_token>
```

**Response** (200): 仅返回 `author = user_A.id` 的记录

---

## GET /api/collections/{collection}/records/{id}

**变更**: 添加 `viewRule` 强制执行

### 场景: 记录不满足 viewRule

**Request**:
```http
GET /api/collections/posts/records/abc123
Authorization: Bearer <user_B_token>
```
(viewRule = "@request.auth.id = author", 且 abc123 的 author != user_B)

**Response** (404):
```json
{
  "code": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```

---

## POST /api/collections/{collection}/records

**变更**: 添加 `createRule` 强制执行

### 场景: Rule = null

**Request**:
```http
POST /api/collections/admin_logs/records
Authorization: Bearer <non_superuser_token>
Content-Type: application/json

{"message": "test"}
```

**Response** (403):
```json
{
  "code": 403,
  "message": "Only superusers can perform this action.",
  "data": {}
}
```

---

## PATCH /api/collections/{collection}/records/{id}

**变更**: 添加 `updateRule` 强制执行

### 场景: 用户无权更新他人的记录

**Request**:
```http
PATCH /api/collections/posts/records/abc123
Authorization: Bearer <user_B_token>
Content-Type: application/json

{"title": "hacked"}
```
(updateRule = "@request.auth.id = author", 且 abc123 的 author != user_B)

**Response** (404):
```json
{
  "code": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```

---

## DELETE /api/collections/{collection}/records/{id}

**变更**: 添加 `deleteRule` 强制执行

### 场景: 用户无权删除他人的记录

**Request**:
```http
DELETE /api/collections/posts/records/abc123
Authorization: Bearer <user_B_token>
```
(deleteRule = "@request.auth.id = author", 且 abc123 的 author != user_B)

**Response** (404):
```json
{
  "code": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```

---

## fields 参数 (Picker)

**新增**: 所有 Record 端点支持 `?fields=` 参数

### 场景: 选择性返回字段

**Request**:
```http
GET /api/collections/posts/records?fields=id,title,author
```

**Response** (200):
```json
{
  "page": 1,
  "perPage": 30,
  "totalItems": 5,
  "totalPages": 1,
  "items": [
    { "id": "abc123", "title": "Hello", "author": "user1" },
    { "id": "def456", "title": "World", "author": "user2" }
  ]
}
```

### 场景: 使用 excerpt 修饰符

**Request**:
```http
GET /api/collections/posts/records?fields=id,title,content:excerpt(100,true)
```

**Response** (200):
```json
{
  "items": [
    { "id": "abc123", "title": "Hello", "content": "This is the first 100 chars of content..." }
  ]
}
```

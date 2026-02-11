# API Contracts: Collection 验证与 View 集合

**Feature**: 033-pocketless-check  
**相关 FR**: FR-004, FR-005, FR-006, FR-007

## 概述

集合 CRUD 端点添加验证逻辑；支持 View 类型集合。

---

## POST /api/collections

**变更**: 添加验证 + 自动表同步

### 场景 1: 重复字段名

**Request**:
```json
{
  "name": "test",
  "type": "base",
  "fields": [
    { "name": "title", "type": "text" },
    { "name": "title", "type": "number" }
  ]
}
```

**Response** (400):
```json
{
  "code": 400,
  "message": "Failed to create collection.",
  "data": {
    "fields": {
      "code": "validation_duplicated_field_name",
      "message": "Duplicated field name 'title'."
    }
  }
}
```

### 场景 2: 系统字段修改

**Request**:
```json
{
  "name": "test",
  "type": "base",
  "fields": [
    { "name": "created", "type": "text" }
  ]
}
```

**Response** (400):
```json
{
  "code": 400,
  "message": "Failed to create collection.",
  "data": {
    "fields": {
      "code": "validation_system_field_change",
      "message": "Cannot modify system field 'created'."
    }
  }
}
```

### 场景 3: 创建 View 集合

**Request**:
```json
{
  "name": "post_stats",
  "type": "view",
  "options": {
    "viewQuery": "SELECT author as id, COUNT(*) as count FROM posts GROUP BY author"
  }
}
```

**Response** (200):
```json
{
  "id": "xyz...",
  "name": "post_stats",
  "type": "view",
  "fields": [
    { "id": "...", "name": "id", "type": "relation", "options": { "collectionId": "posts_id" } },
    { "id": "...", "name": "count", "type": "number" }
  ]
}
```

---

## PATCH /api/collections/{id}

**变更**: 添加验证 + 自动表同步

### 场景: 添加新字段

**Request**:
```json
{
  "fields": [
    { "name": "title", "type": "text" },
    { "name": "summary", "type": "text" }
  ]
}
```

**Response** (200): 成功，底层表自动添加 `summary TEXT DEFAULT ''` 列

### 场景: 尝试改变字段类型

**Request**:
```json
{
  "fields": [
    { "id": "existing_field_id", "name": "title", "type": "number" }
  ]
}
```
(原 title 为 text 类型)

**Response** (400):
```json
{
  "code": 400,
  "message": "Failed to update collection.",
  "data": {
    "fields": {
      "code": "validation_field_type_change",
      "message": "Cannot change field type for 'title'."
    }
  }
}
```

---

## View 集合 CRUD 限制

### 场景: 尝试向 View 集合写入

**Request**:
```http
POST /api/collections/post_stats/records
Content-Type: application/json

{"count": 10}
```

**Response** (400):
```json
{
  "code": 400,
  "message": "View collections are read-only.",
  "data": {}
}
```

### 场景: View 集合列表查询

**Request**:
```http
GET /api/collections/post_stats/records
```

**Response** (200): 正常返回 View 查询结果

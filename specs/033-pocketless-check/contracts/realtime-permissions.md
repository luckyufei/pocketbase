# API Contracts: Realtime SSE 权限过滤

**Feature**: 033-pocketless-check  
**相关 FR**: FR-003

## 概述

Realtime SSE 连接和广播需要添加认证验证和权限过滤。

---

## GET /api/realtime (SSE Connect)

**变更**: 添加 auth token 验证 + `onRealtimeConnectRequest` hook

### 场景 1: 正常连接

**Request**:
```http
GET /api/realtime
Authorization: Bearer <valid_token>
Accept: text/event-stream
```

**Response**: SSE stream opened，客户端绑定 auth record

### 场景 2: 无 token 连接

**Request**:
```http
GET /api/realtime
Accept: text/event-stream
```

**Response**: SSE stream opened，客户端为未认证状态（仍可连接，但只能订阅 public 集合）

### 场景 3: Hook 拒绝连接

**Request**: (hook 返回错误)

**Response** (403):
```json
{
  "code": 403,
  "message": "Connection rejected.",
  "data": {}
}
```

---

## POST /api/realtime (Subscribe)

**变更**: 添加 `onRealtimeSubscribeRequest` hook

### 场景: 订阅请求

**Request**:
```json
{
  "clientId": "abc123",
  "subscriptions": ["posts", "posts/record_id"]
}
```

**Response**: Hook 触发，可修改/拒绝订阅

---

## Realtime Broadcast (Internal)

**变更**: 广播前检查 viewRule/listRule

### 场景 1: 客户端有权查看

Record 变更 → 检查客户端 auth 是否满足 collection.viewRule → 发送 SSE 事件

### 场景 2: 客户端无权查看

Record 变更 → 检查客户端 auth 不满足 collection.viewRule → **不发送** SSE 事件

### SSE Event Format (不变)

```
event: PB_CONNECT
data: {"clientId":"abc123"}

event: posts
data: {"action":"create","record":{"id":"xyz","title":"Hello"}}
```

# Data Model: Pocketless

**Feature**: 032-pocketless  
**Date**: 2026-02-10

> 以下数据模型与 Go 版 PocketBase 100% 对齐。Pocketless 不引入新表或新字段，仅复用现有 schema。

---

## System Tables (主数据库)

### _params

系统参数存储，最重要的是 `settings` 键。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| key | TEXT | TEXT | UNIQUE, NOT NULL |
| value | JSON | JSONB | DEFAULT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _collections

Collection 定义（包含字段列表、API 规则、类型选项）。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| type | TEXT | TEXT | NOT NULL, DEFAULT 'base' |
| name | TEXT | TEXT | UNIQUE, NOT NULL |
| system | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| fields | JSON | JSONB | DEFAULT '[]' |
| indexes | JSON | JSONB | DEFAULT '[]' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |
| listRule | TEXT | TEXT | DEFAULT NULL |
| viewRule | TEXT | TEXT | DEFAULT NULL |
| createRule | TEXT | TEXT | DEFAULT NULL |
| updateRule | TEXT | TEXT | DEFAULT NULL |
| deleteRule | TEXT | TEXT | DEFAULT NULL |
| options | JSON | JSONB | DEFAULT '{}' |

### _migrations

迁移历史记录（Go 版和 Pocketless 共享）。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| file | TEXT | TEXT | NOT NULL |
| applied | INTEGER | INTEGER | NOT NULL, DEFAULT 0 |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _superusers (Auth Collection)

超级管理员用户表。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| email | TEXT | TEXT | UNIQUE, NOT NULL |
| emailVisibility | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| verified | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| tokenKey | TEXT | TEXT | NOT NULL |
| password | TEXT | TEXT | NOT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### users (Default Auth Collection)

默认用户表。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| email | TEXT | TEXT | UNIQUE |
| emailVisibility | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| verified | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| tokenKey | TEXT | TEXT | NOT NULL |
| password | TEXT | TEXT | NOT NULL |
| name | TEXT | TEXT | DEFAULT '' |
| avatar | TEXT | TEXT | DEFAULT '' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _mfas

MFA 会话记录。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| collectionRef | TEXT | TEXT | NOT NULL |
| recordRef | TEXT | TEXT | NOT NULL |
| method | TEXT | TEXT | NOT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _otps

一次性密码记录。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| collectionRef | TEXT | TEXT | NOT NULL |
| recordRef | TEXT | TEXT | NOT NULL |
| password | TEXT | TEXT | NOT NULL |
| sentTo | TEXT | TEXT | DEFAULT '' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _externalAuths

OAuth2 外部认证关联。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| collectionRef | TEXT | TEXT | NOT NULL |
| recordRef | TEXT | TEXT | NOT NULL |
| provider | TEXT | TEXT | NOT NULL |
| providerId | TEXT | TEXT | NOT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _authOrigins

认证来源记录。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| collectionRef | TEXT | TEXT | NOT NULL |
| recordRef | TEXT | TEXT | NOT NULL |
| fingerprint | TEXT | TEXT | NOT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

---

## System Tables (辅助数据库)

### _logs

请求日志，存储在辅助数据库（auxiliary.db / 辅助 PG schema）。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| level | INTEGER | INTEGER | NOT NULL, DEFAULT 0 |
| message | TEXT | TEXT | DEFAULT '' |
| data | JSON | JSONB | DEFAULT '{}' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |

---

## Plugin Tables

### _proxies (Gateway 插件)

代理网关配置。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| name | TEXT | TEXT | UNIQUE, NOT NULL |
| target | TEXT | TEXT | NOT NULL |
| pathPrefix | TEXT | TEXT | NOT NULL |
| enabled | BOOLEAN | BOOLEAN | DEFAULT TRUE |
| stripPrefix | BOOLEAN | BOOLEAN | DEFAULT TRUE |
| timeout | INTEGER | INTEGER | DEFAULT 30 |
| maxRetries | INTEGER | INTEGER | DEFAULT 0 |
| circuitBreakerThreshold | INTEGER | INTEGER | DEFAULT 5 |
| rateLimitRequests | INTEGER | INTEGER | DEFAULT 0 |
| rateLimitDuration | INTEGER | INTEGER | DEFAULT 0 |
| headers | JSON | JSONB | DEFAULT '{}' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _secrets (Secrets 插件)

加密密钥存储。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| key | TEXT | TEXT | UNIQUE, NOT NULL |
| value | TEXT | TEXT | NOT NULL (encrypted) |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _jobs (Jobs 插件)

后台任务队列。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| topic | TEXT | TEXT | NOT NULL |
| payload | TEXT | TEXT | DEFAULT NULL |
| status | TEXT | TEXT | NOT NULL, DEFAULT 'pending' |
| run_at | TEXT | TIMESTAMPTZ | NOT NULL |
| locked_until | TEXT | TIMESTAMPTZ | DEFAULT NULL |
| retries | INTEGER | INTEGER | NOT NULL, DEFAULT 0 |
| max_retries | INTEGER | INTEGER | NOT NULL, DEFAULT 3 |
| last_error | TEXT | TEXT | DEFAULT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

**Indexes**:
- `idx_jobs_pending ON _jobs(status, run_at) WHERE status = 'pending'`
- `idx_jobs_topic ON _jobs(topic)`
- `idx_jobs_locked ON _jobs(locked_until) WHERE status = 'processing'`

### _metrics (Metrics 插件)

系统指标。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| timestamp | TEXT | TIMESTAMPTZ | NOT NULL |
| cpu_usage_percent | REAL | DOUBLE PRECISION | DEFAULT 0 |
| memory_alloc_mb | REAL | DOUBLE PRECISION | DEFAULT 0 |
| goroutines_count | INTEGER | INTEGER | DEFAULT 0 |
| db_open_conns | INTEGER | INTEGER | DEFAULT 0 |
| p95_latency_ms | REAL | DOUBLE PRECISION | DEFAULT 0 |
| http_5xx_count | INTEGER | INTEGER | DEFAULT 0 |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _analytics_events (Analytics 插件)

事件缓冲表。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| name | TEXT | TEXT | NOT NULL |
| source | TEXT | TEXT | DEFAULT '' |
| user_id | TEXT | TEXT | DEFAULT '' |
| session_id | TEXT | TEXT | DEFAULT '' |
| url | TEXT | TEXT | DEFAULT '' |
| referrer | TEXT | TEXT | DEFAULT '' |
| user_agent | TEXT | TEXT | DEFAULT '' |
| country | TEXT | TEXT | DEFAULT '' |
| data | JSON | JSONB | DEFAULT '{}' |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |

### _analytics_stats (Analytics 插件)

聚合统计表。

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| date | TEXT | DATE | NOT NULL |
| name | TEXT | TEXT | NOT NULL |
| dimension | TEXT | TEXT | DEFAULT '' |
| value | TEXT | TEXT | DEFAULT '' |
| count | INTEGER | INTEGER | DEFAULT 0 |
| unique_count | INTEGER | INTEGER | DEFAULT 0 |
| hll | BLOB | BYTEA | DEFAULT NULL |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |

---

## Dynamic Tables (用户创建)

用户通过 Collection API 创建的表。表名为 Collection 名称。

### Base Collection 表结构

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| id | TEXT | TEXT | PRIMARY KEY |
| created | TEXT | TIMESTAMPTZ | DEFAULT '' |
| updated | TEXT | TIMESTAMPTZ | DEFAULT '' |
| *[user fields]* | *varies* | *varies* | *based on field type* |

### Auth Collection 表结构

继承 Base 字段，额外包含：

| Field | Type (SQLite) | Type (PostgreSQL) | Constraints |
|-------|--------------|-------------------|-------------|
| email | TEXT | TEXT | UNIQUE |
| emailVisibility | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| verified | BOOLEAN | BOOLEAN | DEFAULT FALSE |
| tokenKey | TEXT | TEXT | NOT NULL |
| password | TEXT | TEXT | NOT NULL |
| *[user fields]* | *varies* | *varies* | *based on field type* |

### View Collection

不创建表，仅存储 `viewQuery` SQL SELECT，作为虚拟视图。

---

## Field → Column Type Mapping

| Field Type | SQLite Column | PostgreSQL Column | Notes |
|-----------|---------------|-------------------|-------|
| text | TEXT DEFAULT '' | TEXT DEFAULT '' | |
| number | NUMERIC DEFAULT 0 | DOUBLE PRECISION DEFAULT 0 | |
| bool | BOOLEAN DEFAULT FALSE | BOOLEAN DEFAULT FALSE | |
| email | TEXT DEFAULT '' | TEXT DEFAULT '' | |
| url | TEXT DEFAULT '' | TEXT DEFAULT '' | |
| editor | TEXT DEFAULT '' | TEXT DEFAULT '' | |
| date | TEXT DEFAULT '' | TEXT DEFAULT '' | ISO format |
| autodate | TEXT DEFAULT '' | TIMESTAMPTZ DEFAULT '' | Auto-set |
| select (single) | TEXT DEFAULT '' | TEXT DEFAULT '' | |
| select (multi) | JSON DEFAULT '[]' | JSONB DEFAULT '[]' | |
| file (single) | TEXT DEFAULT '' | TEXT DEFAULT '' | filename |
| file (multi) | JSON DEFAULT '[]' | JSONB DEFAULT '[]' | |
| relation (single) | TEXT DEFAULT '' | TEXT DEFAULT '' | record id |
| relation (multi) | JSON DEFAULT '[]' | JSONB DEFAULT '[]' | |
| json | JSON DEFAULT NULL | JSONB DEFAULT NULL | |
| password | TEXT DEFAULT '' | TEXT DEFAULT '' | bcrypt hash |
| geoPoint | JSON DEFAULT '{"lon":0,"lat":0}' | JSONB DEFAULT '{"lon":0,"lat":0}' | |
| secret | TEXT DEFAULT '' | TEXT DEFAULT '' | AES encrypted |
| vector | JSON DEFAULT '[]' | VECTOR(dim) | PG 使用 pgvector |

---

## Entity Relationships

```text
┌──────────────┐       ┌──────────────┐
│  _collections │──1:N──│ [user_tables]│ (dynamic)
│  (schema def) │       │  (records)   │
└──────┬───────┘       └──────┬───────┘
       │                      │
       │                      │ 1:N
       │                ┌─────▼──────┐
       │                │_externalAuths│ (Auth collections only)
       │                └────────────┘
       │                      │
       │                ┌─────▼──────┐
       │                │  _mfas     │
       │                └────────────┘
       │                      │
       │                ┌─────▼──────┐
       │                │  _otps     │
       │                └────────────┘
       │                      │
       │                ┌─────▼──────┐
       │                │_authOrigins │
       │                └────────────┘
       │
┌──────▼───────┐
│   _params    │ (settings, key-value)
└──────────────┘

┌──────────────┐
│  _migrations │ (shared by Go & Bun versions)
└──────────────┘

┌──────────────┐
│    _logs     │ (auxiliary database)
└──────────────┘

┌──────────────────────────────┐
│    Plugin Tables             │
│  _secrets, _jobs, _metrics,  │
│  _proxies, _analytics_*      │
└──────────────────────────────┘
```

---

## ID Generation

所有表的 `id` 字段使用 15 字符随机字符串（与 Go 版对齐）：

```typescript
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateId(length: number = 15): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
```

Go 版使用相同的字母表和长度，确保 ID 格式互通。

---

## Data Volume Estimation

| Table | Records/Day | Retention | Total |
|-------|------------|-----------|-------|
| _collections | ~10-50 | Permanent | <100 |
| user records | ~1K-100K | Permanent | Varies |
| _logs | ~10K-100K | 5 days | ~500K |
| _migrations | ~12 system | Permanent | <50 |
| _metrics | 1440/day | 7 days | ~10K |
| _jobs | ~100-10K | 30 days | ~300K |
| _analytics_events | ~10K | 7 days | ~70K |
| _analytics_stats | ~1K | 365 days | ~365K |

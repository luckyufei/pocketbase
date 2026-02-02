# 数据库层

## 双数据库适配器

```go
// DBAdapter 接口 - 抽象不同数据库差异
type DBAdapter interface {
    Type() dbutils.DBType
    Connect(ctx context.Context, config DBConfig) (*dbx.DB, error)
    HasTable(tableName string) (bool, error)
    JSONFunctions() *dbutils.JSONFunctions
    IsUniqueViolation(err error) bool
    // ...
}

// 自动检测数据库类型
dbType := DetectAdapterType(dsn) // DBTypePostgres 或 DBTypeSQLite
```

## 双连接池架构（SQLite）

```go
type BaseApp struct {
    concurrentDB    *dbx.DB  // 只读操作，支持并发
    nonconcurrentDB *dbx.DB  // 写操作，串行执行
}

// 使用
app.ConcurrentDB().Select("*").From("users").All(&users)  // 读
app.NonconcurrentDB().Insert("users", data).Execute()      // 写
app.Save(record)  // 自动选择正确连接
```

## 事务处理

```go
app.RunInTransaction(func(txApp App) error {
    if err := txApp.Save(record1); err != nil {
        return err // 自动回滚
    }
    return txApp.Save(record2) // 成功则自动提交
})
```

## Query Builder

```go
app.RecordQuery(collection).
    AndWhere(dbx.HashExp{"status": "active"}).
    AndWhere(dbx.NewExp("age > {:age}", dbx.Params{"age": 18})).
    OrderBy("created DESC").
    Limit(10).
    All(&records)
```

## 常用查询方法

```go
// 原始 SQL
app.DB().NewQuery("SELECT * FROM users WHERE age > {:age}").
    Bind(dbx.Params{"age": 18}).
    All(&users)

// 条件构建
dbx.HashExp{"field": "value"}           // field = value
dbx.NewExp("field > {:val}", params)    // 自定义表达式
dbx.Or(exp1, exp2)                      // OR 条件
dbx.And(exp1, exp2)                     // AND 条件
dbx.Not(exp)                            // NOT 条件
dbx.In("field", val1, val2)             // IN 条件
dbx.Like("field", "pattern")            // LIKE 条件
```

## PostgreSQL 特性

- 支持 PostgreSQL 15+ 版本
- 完整的 JSONB 支持，GIN 索引优化
- 行级安全策略 (RLS) 支持
- 使用 `app.IsPostgres()` 检测数据库类型

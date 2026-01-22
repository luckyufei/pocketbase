# 任务调度（JavaScript）

PocketBase 内置支持使用 cron 表达式调度周期性任务。

## 注册 cron 任务

```javascript
cronAdd("myJob", "*/5 * * * *", () => {
    // 每 5 分钟运行一次
    console.log("Running scheduled job")
    
    // 执行某些操作...
})
```

## Cron 表达式格式

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 月份中的日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期几 (0 - 6)
│ │ │ │ │
* * * * *
```

示例：
- `*/5 * * * *` - 每 5 分钟
- `0 * * * *` - 每小时
- `0 0 * * *` - 每天午夜
- `0 0 * * 0` - 每周日午夜
- `0 0 1 * *` - 每月第一天

## 删除 cron 任务

```javascript
cronRemove("myJob")
```

## 示例：每日清理

```javascript
cronAdd("dailyCleanup", "0 0 * * *", () => {
    // 删除旧记录
    const records = $app.findRecordsByFilter(
        "logs",
        "created < {:date}",
        "",
        1000,
        0,
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    )
    
    for (const record of records) {
        $app.delete(record)
    }
    
    console.log(`Cleaned up ${records.length} old log records`)
})
```

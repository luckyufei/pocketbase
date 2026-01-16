# Jobs Scheduling (JavaScript)

PocketBase has built-in support for scheduling recurring jobs using cron expressions.

## Registering cron jobs

```javascript
cronAdd("myJob", "*/5 * * * *", () => {
    // This runs every 5 minutes
    console.log("Running scheduled job")
    
    // do something...
})
```

## Cron expression format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6)
│ │ │ │ │
* * * * *
```

Examples:
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Every day at midnight
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month

## Removing cron jobs

```javascript
cronRemove("myJob")
```

## Example: Daily cleanup

```javascript
cronAdd("dailyCleanup", "0 0 * * *", () => {
    // Delete old records
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

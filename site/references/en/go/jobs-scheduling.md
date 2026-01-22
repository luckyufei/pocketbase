# Jobs Scheduling

PocketBase has built-in support for scheduling recurring jobs using cron expressions.

## Registering cron jobs

```go
app.Cron().Add("myJob", "*/5 * * * *", func() {
    // This runs every 5 minutes
    app.Logger().Info("Running scheduled job")
    
    // do something...
})
```

## Cron expression format

The cron expression format follows the standard:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

Examples:
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Every day at midnight
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month at midnight

## Removing cron jobs

```go
app.Cron().Remove("myJob")
```

## Listing cron jobs

You can list all registered cron jobs via the API (superusers only):

```
GET /api/crons
```

## Running jobs manually

You can trigger a cron job manually via the API (superusers only):

```
POST /api/crons/{jobId}
```

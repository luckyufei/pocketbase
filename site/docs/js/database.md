# Database (JavaScript)

The `$app` global provides access to database operations.

## Raw queries

```javascript
// Execute a query
$app.db().newQuery("DELETE FROM posts WHERE status = 'archived'").execute()

// Select single row
const result = new DynamicModel({
    id: "",
    title: "",
    created: ""
})
$app.db()
    .newQuery("SELECT id, title, created FROM posts WHERE id = {:id}")
    .bind({ id: "abc123" })
    .one(result)

// Select multiple rows
const results = arrayOf(new DynamicModel({
    id: "",
    title: ""
}))
$app.db()
    .newQuery("SELECT id, title FROM posts LIMIT 100")
    .all(results)
```

## Query builder

```javascript
// Select with conditions
const results = arrayOf(new DynamicModel({
    id: "",
    title: ""
}))
$app.db()
    .select("id", "title")
    .from("posts")
    .where($dbx.hashExp({ status: "published" }))
    .orderBy("created DESC")
    .limit(10)
    .all(results)

// Insert
$app.db()
    .insert("posts", {
        id: $security.randomString(15),
        title: "New Post",
        created: new Date().toISOString()
    })
    .execute()

// Update
$app.db()
    .update("posts", { title: "Updated Title" }, $dbx.hashExp({ id: "abc123" }))
    .execute()

// Delete
$app.db()
    .delete("posts", $dbx.hashExp({ id: "abc123" }))
    .execute()
```

## Transactions

```javascript
$app.runInTransaction((txApp) => {
    // Use txApp for all operations within the transaction
    const collection = txApp.findCollectionByNameOrId("posts")
    const record = new Record(collection)
    record.set("title", "New Post")
    txApp.save(record)
    
    // Return null to commit, throw error to rollback
})
```

## Expression helpers

```javascript
// Hash expression (AND conditions)
$dbx.hashExp({ status: "active", published: true })

// NOT expression
$dbx.not($dbx.hashExp({ status: "draft" }))

// OR expression
$dbx.or(
    $dbx.hashExp({ status: "active" }),
    $dbx.hashExp({ featured: true })
)

// AND expression
$dbx.and(
    $dbx.hashExp({ status: "active" }),
    $dbx.exp("created > {:date}", { date: "2023-01-01" })
)

// LIKE expression
$dbx.like("title", "hello")

// IN expression
$dbx.in("status", "active", "pending", "review")
```

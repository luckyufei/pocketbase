# Record Operations (JavaScript)

## Set field value

```javascript
// Set a single field
record.set("title", "example")
record.set("users+", "6jyr1y02438et52") // append to existing value

// Load from object
record.load({
    title: "example",
    content: "Hello World"
})
```

## Get field value

```javascript
// Get field values
record.get("someField")           // any
record.getBool("someField")       // boolean
record.getString("someField")     // string
record.getInt("someField")        // number
record.getFloat("someField")      // number
record.getDateTime("someField")   // DateTime
record.getStringSlice("someField") // string[]

// Get expanded relations
record.expandedOne("author")      // Record or null
record.expandedAll("categories")  // Record[]
```

## Auth record methods

```javascript
record.isSuperuser()
record.email()
record.setEmail("new@example.com")
record.verified()
record.setVerified(true)
record.setPassword("newpassword")
record.validatePassword("password")
```

## Fetching records

```javascript
// Find by ID
const record = $app.findRecordById("posts", "RECORD_ID")

// Find by field value
const record = $app.findFirstRecordByData("posts", "slug", "example")

// Find by filter
const record = $app.findFirstRecordByFilter("posts", "status = 'active'")

// Find multiple records
const records = $app.findRecordsByFilter(
    "posts",
    "status = 'active'",
    "-created", // sort
    100,        // limit
    0           // offset
)

// Find all records
const records = $app.findAllRecords("posts")
```

## Creating records

```javascript
const collection = $app.findCollectionByNameOrId("posts")
const record = new Record(collection)

record.set("title", "Hello World")
record.set("content", "Lorem ipsum...")

$app.save(record)
```

## Updating records

```javascript
const record = $app.findRecordById("posts", "RECORD_ID")

record.set("title", "Updated Title")

$app.save(record)
```

## Deleting records

```javascript
const record = $app.findRecordById("posts", "RECORD_ID")

$app.delete(record)
```

## Hide/Unhide fields

```javascript
onRecordEnrich((e) => {
    // Hide field from response
    e.record.hide("secretField")
    
    // Unhide a hidden field
    e.record.unhide("someField")
    
    e.next()
}, "posts")
```

## Record copies

```javascript
// Original state (before modifications)
const original = record.original()

// Fresh copy (latest state, no expand)
const fresh = record.fresh()

// Full clone (with expand and visibility flags)
const clone = record.clone()
```

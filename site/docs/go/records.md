# Record Operations

The most common task when using PocketBase as framework probably would be querying and working with your collection records.

You could find detailed documentation about all the supported Record model methods in [`core.Record`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#Record) but below are some examples with the most common ones.

## Set field value

```go
// sets the value of a single record field
// (field type specific modifiers are also supported)
record.Set("title", "example")
record.Set("users+", "6jyr1y02438et52") // append to existing value

// populates a record from a data map
// (calls Set for each entry of the map)
record.Load(data)
```

## Get field value

```go
// retrieve a single record field value
// (field specific modifiers are also supported)
record.Get("someField")            // -> any (without cast)
record.GetBool("someField")        // -> cast to bool
record.GetString("someField")      // -> cast to string
record.GetInt("someField")         // -> cast to int
record.GetFloat("someField")       // -> cast to float64
record.GetDateTime("someField")    // -> cast to types.DateTime
record.GetStringSlice("someField") // -> cast to []string

// retrieve the new uploaded files
// (e.g. for inspecting and modifying the file(s) before save)
record.GetUnsavedFiles("someFileField")

// unmarshal a single "json" field value into the provided result
record.UnmarshalJSONField("someJSONField", &result)

// retrieve a single or multiple expanded data
record.ExpandedOne("author")     // -> nil|*core.Record
record.ExpandedAll("categories") // -> []*core.Record

// export all the public safe record fields as map[string]any
// (note: "json" type field values are exported as types.JSONRaw bytes slice)
record.PublicExport()
```

## Auth accessors

```go
record.IsSuperuser() // alias for record.Collection().Name == "_superusers"

record.Email()         // alias for record.Get("email")
record.SetEmail(email) // alias for record.Set("email", email)

record.Verified()         // alias for record.Get("verified")
record.SetVerified(false) // alias for record.Set("verified", false)

record.TokenKey()        // alias for record.Get("tokenKey")
record.SetTokenKey(key)  // alias for record.Set("tokenKey", key)
record.RefreshTokenKey() // alias for record.Set("tokenKey:autogenerate", "")

record.ValidatePassword(pass)
record.SetPassword(pass)   // alias for record.Set("password", pass)
record.SetRandomPassword() // sets cryptographically random 30 characters string as password
```

## Copies

```go
// returns a shallow copy of the current record model populated
// with its ORIGINAL db data state and everything else reset to the defaults
// (usually used for comparing old and new field values)
record.Original()

// returns a shallow copy of the current record model populated
// with its LATEST data state and everything else reset to the defaults
// (aka. no expand, no custom fields and with default visibility flags)
record.Fresh()

// returns a shallow copy of the current record model populated
// with its ALL collection and custom fields data, expand and visibility flags
record.Clone()
```

## Hide/Unhide fields

Collection fields can be marked as "Hidden" from the Dashboard to prevent regular user access to the field values.

Record models provide an option to further control the fields serialization visibility using the `record.Hide(fieldNames...)` and `record.Unhide(fieldNames...)` methods.

```go
app.OnRecordEnrich("articles").BindFunc(func(e *core.RecordEnrichEvent) error {
    // dynamically show/hide a record field depending on whether the current
    // authenticated user has a certain "role" (or any other field constraint)
    if e.RequestInfo.Auth == nil ||
        (!e.RequestInfo.Auth.IsSuperuser() && e.RequestInfo.Auth.GetString("role") != "staff") {
        e.Record.Hide("someStaffOnlyField")
    }

    return e.Next()
})
```

## Fetching records

```go
// find a single record by id
record, err := app.FindRecordById("posts", "RECORD_ID")

// find a single record by a single key-value pair
record, err := app.FindFirstRecordByData("posts", "slug", "example")

// find a single record by a filter expression
record, err := app.FindFirstRecordByFilter("posts", "status = 'active' && created > {:date}", dbx.Params{
    "date": "2023-01-01",
})

// find multiple records
records, err := app.FindRecordsByFilter("posts", "status = 'active'", "-created", 100, 0)

// find all records from a collection
records, err := app.FindAllRecords("posts")
```

## Creating records

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

record := core.NewRecord(collection)
record.Set("title", "Hello World")
record.Set("content", "Lorem ipsum...")

if err := app.Save(record); err != nil {
    return err
}
```

## Updating records

```go
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

record.Set("title", "Updated Title")

if err := app.Save(record); err != nil {
    return err
}
```

## Deleting records

```go
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

if err := app.Delete(record); err != nil {
    return err
}
```

# Event Hooks (JavaScript)

The standard way to modify PocketBase is through **event hooks** in your JavaScript code.

## Hook structure

All hook handler functions expect you to call `e.next()` if you want to proceed with the execution chain.

```javascript
onRecordCreateRequest((e) => {
    // your logic here
    e.next() // continue with the default behavior
}, "posts")
```

## App Hooks

### onServe

Triggered when the app is started.

```javascript
onServe((e) => {
    // register custom routes, middlewares, etc.
    e.next()
})
```

### onBootstrap

Triggered when the app is bootstrapped.

```javascript
onBootstrap((e) => {
    // custom initialization logic
    e.next()
})
```

## Record Hooks

### onRecordCreate

Triggered when a new record is created.

```javascript
onRecordCreate((e) => {
    console.log("Creating record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordUpdate

Triggered when a record is updated.

```javascript
onRecordUpdate((e) => {
    console.log("Updating record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordDelete

Triggered when a record is deleted.

```javascript
onRecordDelete((e) => {
    console.log("Deleting record:", e.record.id)
    e.next()
}, "posts")
```

### onRecordCreateRequest

Triggered on record create API request.

```javascript
onRecordCreateRequest((e) => {
    // if not superuser, overwrite the status to pending
    if (!e.hasSuperuserAuth()) {
        e.record.set("status", "pending")
    }
    e.next()
}, "posts")
```

### onRecordUpdateRequest

Triggered on record update API request.

```javascript
onRecordUpdateRequest((e) => {
    // custom validation or modification
    e.next()
}, "posts")
```

### onRecordDeleteRequest

Triggered on record delete API request.

```javascript
onRecordDeleteRequest((e) => {
    // custom validation before delete
    e.next()
}, "posts")
```

### onRecordEnrich

Triggered on every record enriching.

```javascript
onRecordEnrich((e) => {
    // dynamically show/hide a record field
    if (!e.requestInfo.auth || !e.requestInfo.auth.isSuperuser()) {
        e.record.hide("someSecretField")
    }
    e.next()
}, "articles")
```

## Collection filter

Most record hooks accept an optional collection filter as the last argument:

```javascript
// Single collection
onRecordCreate((e) => { e.next() }, "posts")

// Multiple collections
onRecordCreate((e) => { e.next() }, "posts", "comments")

// All collections (no filter)
onRecordCreate((e) => { e.next() })
```

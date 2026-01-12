# API Rules and Filters

[[toc]]

## API Rules

**API Rules** are your collection access controls and data filters.

Each collection has **5 rules**, corresponding to the specific API action:

- `listRule`
- `viewRule`
- `createRule`
- `updateRule`
- `deleteRule`

Auth collections have an additional `options.manageRule` used to allow one user (it could be even from a different collection) to be able to fully manage the data of another user (ex. changing their email, password, etc.).

Each rule could be set to:

- **"locked"** - aka. `null`, which means that the action could be performed only by an authorized superuser (**this is the default**)
- **Empty string** - anyone will be able to perform the action (superusers, authorized users and guests)
- **Non-empty string** - only users (authorized or not) that satisfy the rule filter expression will be able to perform this action

::: info
**PocketBase API Rules act also as records filter!**

Or in other words, you could for example allow listing only the "active" records of your collection, by using a simple filter expression such as: `status = "active"` (where "status" is a field defined in your Collection).

Because of the above, the API will return 200 empty items response in case a request doesn't satisfy a `listRule`, 400 for unsatisfied `createRule` and 404 for unsatisfied `viewRule`, `updateRule` and `deleteRule`.

All rules will return 403 in case they were "locked" (aka. superuser only) and the request client is not a superuser.

The API Rules are ignored when the action is performed by an authorized superuser (**superusers can access everything**)!
:::

## Filters Syntax

You can find information about the available fields in your collection API rules tab:

![Collection API Rules filters screenshot](/images/screenshots/collection-rules.png)

There is autocomplete to help guide you while typing the rule filter expression, but in general you have access to **3 groups of fields**:

### Your Collection Schema Fields

This includes all nested relation fields too, ex. `someRelField.status != "pending"`

### @request.*

Used to access the current request data, such as query parameters, body/form fields, authorized user state, etc.

- `@request.context` - the context where the rule is used (ex. `@request.context != "oauth2"`)
  - Supported context values: `default`, `oauth2`, `otp`, `password`, `realtime`, `protectedFile`
- `@request.method` - the HTTP request method (ex. `@request.method = "GET"`)
- `@request.headers.*` - the request headers as string values (ex. `@request.headers.x_token = "test"`)
  - Note: All header keys are normalized to lowercase and "-" is replaced with "_"
- `@request.query.*` - the request query parameters as string values (ex. `@request.query.page = "1"`)
- `@request.auth.*` - the current authenticated model (ex. `@request.auth.id != ""`)
- `@request.body.*` - the submitted body parameters (ex. `@request.body.title != ""`)
  - Note: Uploaded files are not part of `@request.body`

### @collection.*

This filter could be used to target other collections that are not directly related to the current one but both shares a common field value:

```
@collection.news.categoryId ?= categoryId && @collection.news.author ?= @request.auth.id
```

In case you want to join the same collection multiple times but based on different criteria, you can define an alias by appending `:alias` suffix to the collection name:

```
@request.auth.id != "" &&
@collection.courseRegistrations.user ?= id &&
@collection.courseRegistrations:auth.user ?= @request.auth.id &&
@collection.courseRegistrations.courseGroup ?= @collection.courseRegistrations:auth.courseGroup
```

## Filter Operators

<FilterSyntax />

## Special Identifiers and Modifiers

### @ Macros

The following datetime macros are available and can be used as part of the filter expression:

```
// all macros are UTC based
@now        - the current datetime as string
@second     - @now second number (0-59)
@minute     - @now minute number (0-59)
@hour       - @now hour number (0-23)
@weekday    - @now weekday number (0-6)
@day        - @now day number
@month      - @now month number
@year       - @now year number
@yesterday  - the yesterday datetime relative to @now as string
@tomorrow   - the tomorrow datetime relative to @now as string
@todayStart - beginning of the current day as datetime string
@todayEnd   - end of the current day as datetime string
@monthStart - beginning of the current month as datetime string
@monthEnd   - end of the current month as datetime string
@yearStart  - beginning of the current year as datetime string
@yearEnd    - end of the current year as datetime string
```

For example: `@request.body.publicDate >= @now`

### :isset Modifier

The `:isset` field modifier is available only for the `@request.*` fields and can be used to check whether the client submitted a specific data with the request:

```
@request.body.role:isset = false
```

### :length Modifier

The `:length` field modifier could be used to check the number of items in an array field (multiple `file`, `select`, `relation`):

```
// check example submitted data: {"someSelectField": ["val1", "val2"]}
@request.body.someSelectField:length > 1

// check existing record field length
someRelationField:length = 2
```

### :each Modifier

The `:each` field modifier works only with multiple `select`, `file` and `relation` type fields. It could be used to apply a condition on each item from the field array:

```
// check if all submitted select options contain the "create" text
@request.body.someSelectField:each ~ "create"

// check if all existing someSelectField has "pb_" prefix
someSelectField:each ~ "pb_%"
```

### :lower Modifier

The `:lower` field modifier could be used to perform lower-case string comparisons:

```
// check if the submitted lower-cased body "title" field is equal to "test"
@request.body.title:lower = "test"

// match existing records with lower-cased "title" equal to "test"
title:lower ~ "test"
```

### geoDistance(lonA, latA, lonB, latB)

The `geoDistance(lonA, latA, lonB, latB)` function could be used to calculate the Haversine distance between 2 geographic points in kilometres:

```
// offices that are less than 25km from my location
geoDistance(address.lon, address.lat, 23.32, 42.69) < 25
```

## Examples

- Allow only registered users:
  ```
  @request.auth.id != ""
  ```

- Allow only registered users and return records that are either "active" or "pending":
  ```
  @request.auth.id != "" && (status = "active" || status = "pending")
  ```

- Allow only registered users who are listed in an *allowed_users* multi-relation field value:
  ```
  @request.auth.id != "" && allowed_users.id ?= @request.auth.id
  ```

- Allow access by anyone and return only the records where the *title* field value starts with "Lorem":
  ```
  title ~ "Lorem%"
  ```

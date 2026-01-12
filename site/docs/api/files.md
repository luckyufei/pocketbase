# Files API

Files are uploaded, updated or deleted via the [Records API](/api/records).

The File API is usually used to fetch/download a file resource (with support for basic image manipulations, like generating thumbs).

## Download / Fetch file

Downloads a single file resource (aka. the URL address to the file). Example:

```html
<img src="http://example.com/api/files/demo/1234abcd/test.png" alt="Test image" />
```

### API details

::: info GET
`/api/files/{collectionIdOrName}/{recordId}/{filename}`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the collection whose record model contains the file resource. |
| recordId | String | ID of the record model that contains the file resource. |
| filename | String | Name of the file resource. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| thumb | String | Get the thumb of the requested file. Supported formats: `WxH` (e.g. 100x300), `WxHt` (e.g. 100x300t - crop to top), `WxHb` (e.g. 100x300b - crop to bottom), `WxHf` (e.g. 100x300f - fit), `0xH` (e.g. 0x300 - auto width), `Wx0` (e.g. 100x0 - auto height). If the thumb size is not defined in the file schema field options or the file resource is not an image (jpg, png, gif, webp), then the original file resource is returned unmodified. |
| token | String | Optional file token for granting access to protected file(s). For an example, you can check [Files upload and handling](/files-handling#protected-files). |
| download | Boolean | If it is set to a truthy value (1, t, true) the file will be served with `Content-Disposition: attachment` header instructing the browser to ignore the file preview for pdf, images, videos, etc. and to directly download the file. |

**Responses**

::: code-group
```text [200]
[file resource]
```

```json [400]
{
  "status": 400,
  "message": "Filesystem initialization failure.",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::

---

## Generate protected file token

Generates a **short-lived file token** for accessing **protected file(s)**.

The client must be superuser or auth record authenticated (aka. have regular authorization token sent with the request).

### API details

::: tip POST
`/api/files/token`

Requires `Authorization: TOKEN`
:::

**Responses**

::: code-group
```json [200]
{
    "token": "..."
}
```

```json [400]
{
  "status": 400,
  "message": "Failed to generate file token.",
  "data": {}
}
```
:::

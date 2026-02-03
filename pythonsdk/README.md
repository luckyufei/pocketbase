PocketBase Python SDK
======================================================================

Official Python SDK for interacting with the [PocketBase API](https://pocketbase.io/docs).

[![Python Version](https://img.shields.io/pypi/pyversions/pocketbase)](https://pypi.org/project/pocketbase/)
[![PyPI Version](https://img.shields.io/pypi/v/pocketbase)](https://pypi.org/project/pocketbase/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-455%20passed-brightgreen)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-87%25-brightgreen)](tests/)

- [Installation](#installation)
- [Usage](#usage)
- [Caveats](#caveats)
    - [Binding filter parameters](#binding-filter-parameters)
    - [File upload](#file-upload)
    - [Error handling](#error-handling)
    - [Auth store](#auth-store)
        - [MemoryAuthStore (default)](#memoryauthstore-default)
        - [FileAuthStore](#fileauthstore)
        - [Custom auth store](#custom-auth-store)
        - [Common auth store fields and methods](#common-auth-store-fields-and-methods)
    - [Auto cancellation](#auto-cancellation)
    - [Specify type hints](#specify-type-hints)
    - [Custom request options](#custom-request-options)
    - [Send hooks](#send-hooks)
    - [SSR integration](#ssr-integration)
    - [Security](#security)
- [Definitions](#definitions)
- [Development](#development)


## Installation

```bash
pip install pocketbase
```

For async support:
```bash
pip install pocketbase[async]
```


## Usage

### Sync Client

```python
from pocketbase import PocketBase

pb = PocketBase('http://127.0.0.1:8090')

# authenticate as auth collection record
user_data = pb.collection('users').auth_with_password('test@example.com', '123456')

# list and filter "example" collection records
result = pb.collection('example').get_list(1, 20, {
    'filter': 'status = true && created > "2022-08-01 10:00:00"'
})

# and much more...
```

### Async Client

```python
import asyncio
from pocketbase import AsyncPocketBase

async def main():
    async with AsyncPocketBase('http://127.0.0.1:8090') as pb:
        # authenticate
        user_data = await pb.collection('users').auth_with_password(
            'test@example.com',
            '123456'
        )
        
        # fetch records
        result = await pb.collection('example').get_list(1, 20)
        
        print(f"Logged in as: {pb.auth_store.record['email']}")

asyncio.run(main())
```

> More detailed API docs and copy-paste examples could be found in the [API documentation for each service](https://pocketbase.io/docs/api-records/).


## Caveats

### Binding filter parameters

The SDK comes with a helper `pb.filter(expr, params)` method to generate a filter string with placeholder parameters (`{:paramName}`) populated from a dictionary.

**This method is also recommended when using the SDK in server-side list queries and accepting untrusted user input as `filter` string arguments, because it will take care to properly escape the generated string expression, avoiding eventual string injection attacks.**

```python
records = pb.collection("example").get_list(1, 20, {
    # the same as: "title ~ 'te\\'st' && (totalA = 123 || totalB = 123)"
    "filter": pb.filter(
        "title ~ {:title} && (totalA = {:num} || totalB = {:num})",
        {"title": "te'st", "num": 123}
    )
})
```

The supported placeholder parameter values are:

- `str` (_single quotes are autoescaped_)
- `int`, `float`
- `bool`
- `datetime` object (_will be stringified into the format expected by PocketBase_)
- `None`
- `list` (_will be serialized to a comma-separated string_)
- everything else is converted to a string using `json.dumps()`


### File upload

PocketBase Web API supports file upload via `multipart/form-data` requests,
which means that to upload a file it is enough to provide a file path, file object, or tuple.

- Using file path:
    ```python
    from pathlib import Path
    
    data = {
        'title': 'lorem ipsum...',
        'document': Path('./document.pdf'),
    }
    
    pb.collection('example').create(data)
    ```

- Using file object:
    ```python
    with open('./document.pdf', 'rb') as f:
        data = {
            'title': 'lorem ipsum...',
            'document': f,
        }
        pb.collection('example').create(data)
    ```

- Using tuple (filename, content, content_type):
    ```python
    with open('./document.pdf', 'rb') as f:
        data = {
            'title': 'lorem ipsum...',
            'document': ('document.pdf', f.read(), 'application/pdf'),
        }
        pb.collection('example').create(data)
    ```

### Error handling

All services return standard responses, so error handling is straightforward:

```python
from pocketbase import PocketBase, ClientResponseError

pb = PocketBase('http://127.0.0.1:8090')

try:
    result = pb.collection('example').get_list(1, 50)
    print('Result:', result)
except ClientResponseError as e:
    print('Error:', e)
```

The response error is normalized and always returned as `ClientResponseError` object with the following public fields that you could use:

```python
ClientResponseError(
    url: str           # requested url
    status: int        # response status code
    response: dict     # the API JSON error response
    is_abort: bool     # is abort/cancellation error
    original_error: Exception | None  # the original non-normalized error
)
```

### Auth store

The SDK keeps track of the authenticated token and auth model for you via the `pb.auth_store` instance.

##### MemoryAuthStore (default)

The default [`MemoryAuthStore`](src/pocketbase/stores/memory_auth_store.py) stores the auth data in runtime memory (aka. on process restart you'll have to authenticate again).

```python
from pocketbase import PocketBase

pb = PocketBase('http://127.0.0.1:8090')
# MemoryAuthStore is used by default
```

##### FileAuthStore

The SDK also provides a [`FileAuthStore`](src/pocketbase/stores/file_auth_store.py) that persists auth data to a JSON file:

```python
from pocketbase import PocketBase
from pocketbase.stores import FileAuthStore

store = FileAuthStore('./pb_auth.json')
pb = PocketBase('http://127.0.0.1:8090', auth_store=store)

# Auth data will be saved to ./pb_auth.json
pb.collection('users').auth_with_password('test@example.com', '123456')

# On next run, auth data will be automatically loaded from the file
```

##### Custom auth store

In some situations it could be easier to create your own custom auth store. For this you can extend [`BaseAuthStore`](src/pocketbase/stores/base_auth_store.py) and pass the new custom instance as constructor argument to the client:

```python
from pocketbase import PocketBase
from pocketbase.stores import BaseAuthStore

class CustomAuthStore(BaseAuthStore):
    def save(self, token: str, record: dict | None = None) -> None:
        super().save(token, record)
        # your custom business logic...
        print(f"Auth saved: {token[:20]}...")
    
    def clear(self) -> None:
        super().clear()
        # your custom cleanup logic...
        print("Auth cleared")

pb = PocketBase('http://127.0.0.1:8090', auth_store=CustomAuthStore())
```

##### Common auth store fields and methods

The default `pb.auth_store` extends [`BaseAuthStore`](src/pocketbase/stores/base_auth_store.py) and has the following public members that you can use:

```python
BaseAuthStore:
    # base fields
    record: dict | None   # the authenticated auth record
    token: str            # the authenticated token
    is_valid: bool        # checks if the store has existing and unexpired token
    is_superuser: bool    # checks if the store state is for superuser
    
    # main methods
    clear()               # "logout" the authenticated record
    save(token, record)   # update the store with the new auth data
    on_change(callback, fire_immediately=False)  # register a callback on store change
    
    # cookie parse and serialize helpers
    load_from_cookie(cookie_header, key='pb_auth')
    export_to_cookie(key='pb_auth', **options)
```

To _"logout"_ the authenticated record you can call `pb.auth_store.clear()`.

To _"listen"_ for changes in the auth store, you can register a new listener via `pb.auth_store.on_change`, eg:

```python
# triggered everytime on store change
remove_listener1 = pb.auth_store.on_change(lambda token, record: 
    print(f'New store data 1: {token}, {record}')
)

# triggered once right after registration and everytime on store change
remove_listener2 = pb.auth_store.on_change(
    lambda token, record: print(f'New store data 2: {token}, {record}'),
    fire_immediately=True
)

# (optional) removes the attached listeners
remove_listener1()
remove_listener2()
```


### Auto cancellation

The SDK client will auto cancel duplicated pending requests for you.
For example, if you have the following 3 duplicated endpoint calls, only the last one will be executed, while the first 2 will be cancelled with `ClientResponseError` error:

```python
pb.collection('example').get_list(1, 20)  # cancelled
pb.collection('example').get_list(2, 20)  # cancelled
pb.collection('example').get_list(3, 20)  # executed
```

To change this behavior per request basis, you can adjust the `request_key: None | str` special query parameter.
Set it to `None` to unset the default request identifier and to disable auto cancellation for the specific request.
Or set it to a unique string that will be used as request identifier and based on which pending requests will be matched (default to `HTTP_METHOD + path`, eg. "GET /api/users")

Example:

```python
pb.collection('example').get_list(1, 20)                           # cancelled
pb.collection('example').get_list(1, 20)                           # executed
pb.collection('example').get_list(1, 20, {"request_key": "test"})  # cancelled
pb.collection('example').get_list(1, 20, {"request_key": "test"})  # executed
pb.collection('example').get_list(1, 20, {"request_key": None})    # executed
pb.collection('example').get_list(1, 20, {"request_key": None})    # executed

# globally disable auto cancellation
pb.auto_cancellation(False)

pb.collection('example').get_list(1, 20)  # executed
pb.collection('example').get_list(1, 20)  # executed
pb.collection('example').get_list(1, 20)  # executed
```

**If you want to globally disable the auto cancellation behavior, you could set `pb.auto_cancellation(False)`.**

To manually cancel pending requests, you could use `pb.cancel_all_requests()` or `pb.cancel_request(request_key)`.


### Specify type hints

You could specify custom type hints for your Record models using TypedDict:

```python
from typing import TypedDict
from pocketbase import PocketBase

class Task(TypedDict):
    id: str
    name: str
    completed: bool

pb = PocketBase('http://127.0.0.1:8090')

# Use type annotations for better IDE support
tasks: list[Task] = pb.collection('tasks').get_full_list()
task: Task = pb.collection('tasks').get_one('RECORD_ID')
```

Alternatively, you can use dataclasses or Pydantic models:

```python
from dataclasses import dataclass
from pocketbase import PocketBase

@dataclass
class Task:
    id: str
    name: str
    completed: bool = False

pb = PocketBase('http://127.0.0.1:8090')

# Fetch and convert to dataclass
data = pb.collection('tasks').get_one('RECORD_ID')
task = Task(**data)
```


### Custom request options

All API services accept an optional `options` argument (usually the last one), that can be used to provide:

- custom headers for a single request
- custom query parameters
- request timeout

For example:

```python
pb.collection('example').get_list(1, 20, {
    'expand': 'someRel',
    'other_query_param': '123',
    
    # custom headers
    'headers': {
        'X-Custom-Header': 'example',
    },
    
    # request timeout in seconds
    'timeout': 30,
})
```

_Note that for backward compatibility and to minimize the verbosity, any "unknown" top-level field will be treated as query parameter._


### Send hooks

Sometimes you may want to modify the request data globally or to customize the response.

To accomplish this, the SDK provides 2 function hooks:

- `before_send` - triggered right before sending the request, allowing you to inspect/modify the request config.
    ```python
    from pocketbase import PocketBase
    
    pb = PocketBase('http://127.0.0.1:8090')
    
    def before_hook(url: str, options: dict) -> tuple[str, dict]:
        # Add custom header to all requests
        options.setdefault('headers', {})
        options['headers']['X-Custom-Header'] = 'example'
        return url, options
    
    pb.before_send = before_hook
    
    # use the created client as usual...
    ```

- `after_send` - triggered after successfully sending the request, allowing you to inspect/modify the response.
    ```python
    from pocketbase import PocketBase
    
    pb = PocketBase('http://127.0.0.1:8090')
    
    def after_hook(response: dict) -> dict:
        # do something with the response data
        print(f"Response received: {response}")
        
        # extend the data...
        response['additional_field'] = 123
        return response
    
    pb.after_send = after_hook
    
    # use the created client as usual...
    ```

### SSR integration

Unfortunately, **there is no "one size fits all" solution** because each framework handles SSR differently (_and even in a single framework there is more than one way of doing things_).

But in general, the idea is to use a cookie based flow:

1. Create a new `PocketBase` instance for each server-side request
2. "Load/Feed" your `pb.auth_store` with data from the request cookie
3. Perform your application server-side actions
4. Before returning the response to the client, update the cookie with the latest `pb.auth_store` state

All [`BaseAuthStore`](src/pocketbase/stores/base_auth_store.py) instances have 2 helper methods that
should make working with cookies a little bit easier:

```python
# update the store with the parsed data from the cookie string
pb.auth_store.load_from_cookie('pb_auth=...')

# exports the store data as cookie string
pb.auth_store.export_to_cookie(http_only=False)  # Output: 'pb_auth=...'
```

Below you could find several examples:

<details>
  <summary><strong>FastAPI</strong></summary>

One way to integrate with FastAPI SSR could be to create the PocketBase client in a dependency and pass it to the route handlers.

```python
from fastapi import FastAPI, Request, Response, Depends
from pocketbase import PocketBase
from pocketbase.stores import MemoryAuthStore

app = FastAPI()

async def get_pb(request: Request, response: Response):
    """Create PocketBase instance with cookie-based auth."""
    pb = PocketBase('http://127.0.0.1:8090')
    
    # load the store data from the request cookie string
    cookie = request.cookies.get('pb_auth', '')
    if cookie:
        pb.auth_store.load_from_cookie(f'pb_auth={cookie}')
    
    try:
        # get an up-to-date auth store state by verifying and refreshing
        if pb.auth_store.is_valid:
            pb.collection('users').auth_refresh()
    except Exception:
        # clear the auth store on failed refresh
        pb.auth_store.clear()
    
    yield pb
    
    # send back the 'pb_auth' cookie to the client with the latest store state
    response.set_cookie(
        key='pb_auth',
        value=pb.auth_store.export_to_cookie(),
        httponly=True,
        samesite='lax',
        secure=True,
    )

@app.post("/login")
async def login(request: Request, pb: PocketBase = Depends(get_pb)):
    data = await request.json()
    
    auth_data = pb.collection('users').auth_with_password(
        data['email'],
        data['password']
    )
    
    return {"message": "Success", "user": auth_data.record}

@app.get("/me")
async def get_current_user(pb: PocketBase = Depends(get_pb)):
    if not pb.auth_store.is_valid:
        return {"error": "Not authenticated"}
    
    return {"user": pb.auth_store.record}
```
</details>

<details>
  <summary><strong>Flask</strong></summary>

One way to integrate with Flask could be to create the PocketBase client in a before_request hook.

```python
from flask import Flask, request, g, make_response
from pocketbase import PocketBase

app = Flask(__name__)

@app.before_request
def init_pb():
    """Initialize PocketBase client for each request."""
    g.pb = PocketBase('http://127.0.0.1:8090')
    
    # load the store data from the request cookie string
    cookie = request.cookies.get('pb_auth', '')
    if cookie:
        g.pb.auth_store.load_from_cookie(f'pb_auth={cookie}')
    
    try:
        # get an up-to-date auth store state by verifying and refreshing
        if g.pb.auth_store.is_valid:
            g.pb.collection('users').auth_refresh()
    except Exception:
        # clear the auth store on failed refresh
        g.pb.auth_store.clear()

@app.after_request
def save_pb_cookie(response):
    """Save PocketBase auth state to cookie."""
    if hasattr(g, 'pb'):
        response.set_cookie(
            'pb_auth',
            g.pb.auth_store.export_to_cookie(),
            httponly=True,
            samesite='Lax',
            secure=True,
        )
    return response

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    auth_data = g.pb.collection('users').auth_with_password(
        data['email'],
        data['password']
    )
    
    return {"message": "Success", "user": auth_data.record}

@app.route('/me')
def get_current_user():
    if not g.pb.auth_store.is_valid:
        return {"error": "Not authenticated"}, 401
    
    return {"user": g.pb.auth_store.record}
```
</details>

<details>
  <summary><strong>Django</strong></summary>

One way to integrate with Django could be to create a middleware that initializes the PocketBase client.

```python
# middleware.py
from pocketbase import PocketBase

class PocketBaseMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Create PocketBase instance
        request.pb = PocketBase('http://127.0.0.1:8090')
        
        # Load auth from cookie
        cookie = request.COOKIES.get('pb_auth', '')
        if cookie:
            request.pb.auth_store.load_from_cookie(f'pb_auth={cookie}')
        
        try:
            # Verify and refresh auth
            if request.pb.auth_store.is_valid:
                request.pb.collection('users').auth_refresh()
        except Exception:
            request.pb.auth_store.clear()
        
        response = self.get_response(request)
        
        # Save auth to cookie
        response.set_cookie(
            'pb_auth',
            request.pb.auth_store.export_to_cookie(),
            httponly=True,
            samesite='Lax',
            secure=True,
        )
        
        return response

# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def login(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    data = json.loads(request.body)
    
    auth_data = request.pb.collection('users').auth_with_password(
        data['email'],
        data['password']
    )
    
    return JsonResponse({'message': 'Success', 'user': auth_data.record})

def get_current_user(request):
    if not request.pb.auth_store.is_valid:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    
    return JsonResponse({'user': request.pb.auth_store.record})
```
</details>

### Security

The most common backend related vulnerability is injection attacks.
**To prevent a malicious user to inject filter strings, it is recommended to use the helper `pb.filter(expr, params)` when constructing filter strings with untrusted user input (see [Binding filter parameters](#binding-filter-parameters)).**


## Definitions

### Creating new client instance

```python
# Sync client
pb = PocketBase(base_url='http://127.0.0.1:8090/', auth_store=MemoryAuthStore())

# Async client
async with AsyncPocketBase(base_url='http://127.0.0.1:8090/', auth_store=MemoryAuthStore()) as pb:
    ...
```

### Instance methods

> Each instance method returns the result or raises `ClientResponseError`.

| Method                            | Description                                                                   |
|:----------------------------------|:------------------------------------------------------------------------------|
| `pb.send(path, options = {})`     | Sends an api http request.                                                    |
| `pb.auto_cancellation(enable)`    | Globally enable or disable auto cancellation for pending duplicated requests. |
| `pb.cancel_all_requests()`        | Cancels all pending requests.                                                 |
| `pb.cancel_request(cancel_key)`   | Cancels single request by its cancellation token key.                         |
| `pb.build_url(path)`              | Builds a full client url by safely concatenating the provided path.           |
| `pb.filter(expr, params)`         | Builds a filter string with escaped parameters.                               |


### Services

> Each service call returns the response data or raises `ClientResponseError`.

##### RecordService

###### _CRUD handlers_

```python
# Returns a paginated records list.
🔓 pb.collection(collection_id_or_name).get_list(page=1, per_page=30, options={})

# Returns a list with all records batch fetched at once
# (by default 200 items per request; to change it set the `batch` param).
🔓 pb.collection(collection_id_or_name).get_full_list(options={})

# Returns the first found record matching the specified filter.
🔓 pb.collection(collection_id_or_name).get_first_list_item(filter, options={})

# Returns a single record by its id.
🔓 pb.collection(collection_id_or_name).get_one(record_id, options={})

# Creates (aka. register) a new record.
🔓 pb.collection(collection_id_or_name).create(body_params={}, options={})

# Updates an existing record by its id.
🔓 pb.collection(collection_id_or_name).update(record_id, body_params={}, options={})

# Deletes a single record by its id.
🔓 pb.collection(collection_id_or_name).delete(record_id, options={})
```

###### _Realtime handlers_

```python
# Subscribe to realtime changes to the specified topic ("*" or record_id).
#
# It is safe to subscribe multiple times to the same topic.
#
# You can use the returned unsubscribe function to remove a single registered subscription.
# If you want to remove all subscriptions related to the topic use unsubscribe(topic).
🔓 pb.collection(collection_id_or_name).subscribe(topic, callback, options={})

# Unsubscribe from all registered subscriptions to the specified topic ("*" or record_id).
# If topic is not set, then it will remove all registered collection subscriptions.
🔓 pb.collection(collection_id_or_name).unsubscribe(topic=None)
```

###### _Auth handlers_

> Available only for "auth" type collections.

```python
# Returns all available application auth methods.
🔓 pb.collection(collection_id_or_name).list_auth_methods(options={})

# Authenticates a record with their username/email and password.
🔓 pb.collection(collection_id_or_name).auth_with_password(username_or_email, password, options={})

# Authenticates a record with an OTP.
🔓 pb.collection(collection_id_or_name).auth_with_otp(otp_id, password, options={})

# Authenticates a record with OAuth2 code.
🔓 pb.collection(collection_id_or_name).auth_with_oauth2_code(provider, code, code_verifier, redirect_url, create_data={}, options={})

# Refreshes the current authenticated record and auth token.
🔐 pb.collection(collection_id_or_name).auth_refresh(options={})

# Sends a record OTP email request.
🔓 pb.collection(collection_id_or_name).request_otp(email, options={})

# Sends a record password reset email.
🔓 pb.collection(collection_id_or_name).request_password_reset(email, options={})

# Confirms a record password reset request.
🔓 pb.collection(collection_id_or_name).confirm_password_reset(reset_token, new_password, new_password_confirm, options={})

# Sends a record verification email request.
🔓 pb.collection(collection_id_or_name).request_verification(email, options={})

# Confirms a record email verification request.
🔓 pb.collection(collection_id_or_name).confirm_verification(verification_token, options={})

# Sends a record email change request to the provider email.
🔐 pb.collection(collection_id_or_name).request_email_change(new_email, options={})

# Confirms record new email address.
🔓 pb.collection(collection_id_or_name).confirm_email_change(email_change_token, user_password, options={})

# Lists all linked external auth providers for the specified record.
🔐 pb.collection(collection_id_or_name).list_external_auths(record_id, options={})

# Unlinks a single external auth provider relation from the specified record.
🔐 pb.collection(collection_id_or_name).unlink_external_auth(record_id, provider, options={})

# Impersonate authenticates with the specified record_id and returns a new client with the received auth token.
🔐 pb.collection(collection_id_or_name).impersonate(record_id, duration, options={})
```

---

#### BatchService

```python
# create a new batch instance
batch = pb.create_batch()

# register create/update/delete/upsert requests to the created batch
batch.collection('example1').create({...})
batch.collection('example2').update('RECORD_ID', {...})
batch.collection('example3').delete('RECORD_ID')
batch.collection('example4').upsert({...})

# send the batch request
result = batch.send()
```

---

##### FileService

```python
# Builds and returns an absolute record file url for the provided filename.
🔓 pb.files.get_url(record, filename, options={})

# Requests a new private file access token for the current authenticated record.
🔐 pb.files.get_token(options={})
```

---

##### CollectionService

```python
# Returns a paginated collections list.
🔐 pb.collections.get_list(page=1, per_page=30, options={})

# Returns a list with all collections batch fetched at once
# (by default 200 items per request; to change it set the `batch` query param).
🔐 pb.collections.get_full_list(options={})

# Returns the first found collection matching the specified filter.
🔐 pb.collections.get_first_list_item(filter, options={})

# Returns a single collection by its id or name.
🔐 pb.collections.get_one(id_or_name, options={})

# Creates (aka. register) a new collection.
🔐 pb.collections.create(body_params={}, options={})

# Updates an existing collection by its id or name.
🔐 pb.collections.update(id_or_name, body_params={}, options={})

# Deletes a single collection by its id or name.
🔐 pb.collections.delete(id_or_name, options={})

# Deletes all records associated with the specified collection.
🔐 pb.collections.truncate(id_or_name, options={})

# Imports the provided collections.
🔐 pb.collections.import_collections(collections, delete_missing=False, options={})

# Returns type indexed map with scaffolded collection models populated with their default field values.
🔐 pb.collections.get_scaffolds(options={})
```

---

##### LogService

```python
# Returns a paginated logs list.
🔐 pb.logs.get_list(page=1, per_page=30, options={})

# Returns a single log by its id.
🔐 pb.logs.get_one(id, options={})

# Returns logs statistics.
🔐 pb.logs.get_stats(options={})
```

---

##### SettingsService

```python
# Returns a map with all available app settings.
🔐 pb.settings.get_all(options={})

# Bulk updates app settings.
🔐 pb.settings.update(body_params={}, options={})

# Performs a S3 storage connection test.
🔐 pb.settings.test_s3(filesystem="storage", options={})

# Sends a test email (verification, password-reset, email-change).
🔐 pb.settings.test_email(collection_id_or_name, to_email, template, options={})

# Generates a new Apple OAuth2 client secret.
🔐 pb.settings.generate_apple_client_secret(client_id, team_id, key_id, private_key, duration, options={})
```

---

##### RealtimeService

> This service is usually used with custom realtime actions.
> For records realtime subscriptions you can use the subscribe/unsubscribe
> methods available in the `pb.collection()` RecordService.

```python
# Initialize the realtime connection (if not already) and register the subscription listener.
#
# You can subscribe to the `PB_CONNECT` event if you want to listen to the realtime connection connect/reconnect events.
🔓 pb.realtime.subscribe(topic, callback, options={})

# Unsubscribe from all subscription listeners with the specified topic.
🔓 pb.realtime.unsubscribe(topic=None)

# Unsubscribe from all subscription listeners starting with the specified topic prefix.
🔓 pb.realtime.unsubscribe_by_prefix(topic_prefix)

# Unsubscribe from all subscriptions matching the specified topic and listener function.
🔓 pb.realtime.unsubscribe_by_topic_and_listener(topic, callback)

# Property that checks whether the realtime connection has been established.
pb.realtime.is_connected
```

---

##### BackupService

```python
# Returns list with all available backup files.
🔐 pb.backups.get_full_list(options={})

# Initializes a new backup.
🔐 pb.backups.create(basename="", options={})

# Upload an existing app data backup.
🔐 pb.backups.upload(file, options={})

# Deletes a single backup by its name.
🔐 pb.backups.delete(key, options={})

# Initializes an app data restore from an existing backup.
🔐 pb.backups.restore(key, options={})

# Builds a download url for a single existing backup using a
# superuser file token and the backup file key.
🔐 pb.backups.get_download_url(token, key)
```

---

##### CronService

```python
# Returns list with all available cron jobs.
🔐 pb.crons.get_full_list(options={})

# Runs the specified cron job.
🔐 pb.crons.run(job_id, options={})
```

---

##### HealthService

```python
# Checks the health status of the api.
🔓 pb.health.check(options={})
```

---

##### AnalyticsService

```python
# Track an analytics event.
🔓 pb.analytics.track_event(event, path, referrer="", options={})

# Get analytics statistics.
🔐 pb.analytics.get_stats(range="7d", options={})
```

---

##### TraceService

```python
# List trace spans.
🔐 pb.traces.list_spans(min_duration=0, options={})

# Add a dyed user for tracing.
🔐 pb.traces.add_dyed_user(user_id, ttl_seconds=3600, options={})

# Remove a dyed user.
🔐 pb.traces.remove_dyed_user(user_id, options={})

# List all dyed users.
🔐 pb.traces.list_dyed_users(options={})
```


## Development

This project uses [uv](https://docs.astral.sh/uv/) for fast, reliable Python package management.

### Prerequisites

Install uv (if not already installed):

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv

# Or via Homebrew (macOS)
brew install uv
```

### Install development dependencies

```bash
# Clone the repository
git clone https://github.com/pocketbase/pocketbase
cd pocketbase/pythonsdk

# Create virtual environment and install all dependencies (including dev)
uv sync --dev

# Activate the virtual environment (optional, uv run handles this automatically)
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### Run tests

```bash
# Run all tests (uv run automatically uses the virtual environment)
uv run pytest

# Run with verbose output
uv run pytest -v

# Run with coverage report
uv run pytest --cov=pocketbase --cov-report=html

# Run specific tests
uv run pytest tests/services/test_record_service.py -v
```

### Code quality

```bash
# Format code
uv run ruff format .

# Lint code
uv run ruff check .

# Auto-fix lint issues
uv run ruff check --fix .

# Type checking
uv run mypy src/
```

### Common uv commands

```bash
# Add a new dependency
uv add <package>

# Add a dev dependency
uv add --dev <package>

# Remove a dependency
uv remove <package>

# Update all dependencies
uv sync --upgrade

# Show dependency tree
uv tree

# Build the package
uv build
```

### Project structure

```
pythonsdk/
├── src/pocketbase/
│   ├── __init__.py           # Main exports
│   ├── client.py             # PocketBase sync client
│   ├── async_client.py       # AsyncPocketBase client
│   ├── models/               # Data models
│   │   ├── record.py         # RecordModel
│   │   ├── collection.py     # CollectionModel
│   │   ├── list_result.py    # ListResult
│   │   └── auth.py           # Auth models
│   ├── services/             # API services
│   │   ├── record_service.py
│   │   ├── collection_service.py
│   │   ├── realtime_service.py
│   │   └── ...
│   ├── stores/               # Auth stores
│   │   ├── base_auth_store.py
│   │   ├── memory_auth_store.py
│   │   └── file_auth_store.py
│   └── utils/                # Utilities
│       ├── filter.py
│       └── options.py
├── tests/                    # Test suite (455+ tests)
├── pyproject.toml            # Project configuration (PEP 621 + uv)
├── uv.lock                   # Dependency lock file
└── README.md                 # This file
```


## License

MIT License - see [LICENSE](LICENSE) file.


## Related Links

- [PocketBase Official Documentation](https://pocketbase.io/docs)
- [PocketBase GitHub](https://github.com/pocketbase/pocketbase)
- [JavaScript SDK](https://github.com/pocketbase/js-sdk)

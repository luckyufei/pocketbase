package apis_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func TestKVSetAndGet(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "set value",
			Method: http.MethodPost,
			URL:    "/api/kv/set",
			Body:   strings.NewReader(`{"key":"test:key1","value":"hello"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:   "set with missing key",
			Method: http.MethodPost,
			URL:    "/api/kv/set",
			Body:   strings.NewReader(`{"value":"hello"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required"`},
		},
		{
			Name:   "get existing key",
			Method: http.MethodGet,
			URL:    "/api/kv/get?key=test:key1",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().Set("test:key1", "hello")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`, `"value":"hello"`},
		},
		{
			Name:            "get non-existing key",
			Method:          http.MethodGet,
			URL:             "/api/kv/get?key=nonexistent",
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":false`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVDelete(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "delete existing key",
			Method: http.MethodDelete,
			URL:    "/api/kv/delete?key=to_delete",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().Set("to_delete", "value")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVExists(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "exists for existing key",
			Method: http.MethodGet,
			URL:    "/api/kv/exists?key=exists_key",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().Set("exists_key", "value")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"exists":true`},
		},
		{
			Name:            "exists for non-existing key",
			Method:          http.MethodGet,
			URL:             "/api/kv/exists?key=not_exists",
			ExpectedStatus:  200,
			ExpectedContent: []string{`"exists":false`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVIncr(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "incr new key",
			Method:          http.MethodPost,
			URL:             "/api/kv/incr",
			Body:            strings.NewReader(`{"key":"counter:new"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":1`},
		},
		{
			Name:   "incr existing key",
			Method: http.MethodPost,
			URL:    "/api/kv/incr",
			Body:   strings.NewReader(`{"key":"counter:existing","delta":5}`),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().IncrBy("counter:existing", 10)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":15`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVHash(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "hset",
			Method:          http.MethodPost,
			URL:             "/api/kv/hset",
			Body:            strings.NewReader(`{"key":"cart:user1","field":"apple","value":5}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:   "hget",
			Method: http.MethodGet,
			URL:    "/api/kv/hget?key=cart:user2&field=banana",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().HSet("cart:user2", "banana", 3)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`, `"value":3`},
		},
		{
			Name:   "hgetall",
			Method: http.MethodGet,
			URL:    "/api/kv/hgetall?key=cart:user3",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().HSet("cart:user3", "apple", 2)
				app.KV().HSet("cart:user3", "orange", 4)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`, `"apple":2`, `"orange":4`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVMSet(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "mset",
			Method:          http.MethodPost,
			URL:             "/api/kv/mset",
			Body:            strings.NewReader(`{"pairs":{"batch:a":"va","batch:b":"vb"}}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVMGet(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "mget",
			Method: http.MethodPost,
			URL:    "/api/kv/mget",
			Body:   strings.NewReader(`{"keys":["mget:a","mget:b","mget:c"]}`),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().Set("mget:a", "value_a")
				app.KV().Set("mget:b", "value_b")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"mget:a":"value_a"`, `"mget:b":"value_b"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVLock(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "acquire lock",
			Method:          http.MethodPost,
			URL:             "/api/kv/lock",
			Body:            strings.NewReader(`{"key":"resource:1","ttl":10000}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"acquired":true`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVKeys(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "keys with pattern",
			Method: http.MethodGet,
			URL:    "/api/kv/keys?pattern=prefix:*",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *tests.TestMailer) {
				app.KV().Set("prefix:key1", "v1")
				app.KV().Set("prefix:key2", "v2")
				app.KV().Set("other:key3", "v3")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"keys":`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

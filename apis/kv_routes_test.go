package apis_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// 超级用户 token (用于需要认证的测试)
const superuserToken = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY"

// 普通用户 token
const userToken = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo"

func superuserHeaders() map[string]string {
	return map[string]string{"Authorization": superuserToken}
}

func TestKVSetAndGet(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "set value",
			Method:          http.MethodPost,
			URL:             "/api/kv/set",
			Body:            strings.NewReader(`{"key":"test:key1","value":"hello"}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:            "set with missing key",
			Method:          http.MethodPost,
			URL:             "/api/kv/set",
			Body:            strings.NewReader(`{"value":"hello"}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required."`},
		},
		{
			Name:    "get existing key",
			Method:  http.MethodGet,
			URL:     "/api/kv/get?key=test:key1",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().Set("test:key1", "hello")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`, `"value":"hello"`},
		},
		{
			Name:            "get non-existing key",
			Method:          http.MethodGet,
			URL:             "/api/kv/get?key=nonexistent",
			Headers:         superuserHeaders(),
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
			Name:    "delete existing key",
			Method:  http.MethodDelete,
			URL:     "/api/kv/delete?key=to_delete",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
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
			Name:    "exists for existing key",
			Method:  http.MethodGet,
			URL:     "/api/kv/exists?key=exists_key",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().Set("exists_key", "value")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"exists":true`},
		},
		{
			Name:            "exists for non-existing key",
			Method:          http.MethodGet,
			URL:             "/api/kv/exists?key=not_exists",
			Headers:         superuserHeaders(),
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
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":1`},
		},
		{
			Name:    "incr existing key",
			Method:  http.MethodPost,
			URL:     "/api/kv/incr",
			Body:    strings.NewReader(`{"key":"counter:existing","delta":5}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
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
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:    "hget",
			Method:  http.MethodGet,
			URL:     "/api/kv/hget?key=cart:user2&field=banana",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().HSet("cart:user2", "banana", 3)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`, `"value":3`},
		},
		{
			Name:    "hgetall",
			Method:  http.MethodGet,
			URL:     "/api/kv/hgetall?key=cart:user3",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
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
			Headers:         superuserHeaders(),
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
			Name:    "mget",
			Method:  http.MethodPost,
			URL:     "/api/kv/mget",
			Body:    strings.NewReader(`{"keys":["mget:a","mget:b","mget:c"]}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
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
			Headers:         superuserHeaders(),
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
			Name:    "keys with pattern",
			Method:  http.MethodGet,
			URL:     "/api/kv/keys?pattern=prefix:*",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
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

// ==================== TTL 和 Expire 测试 ====================

func TestKVTTL(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "ttl for key with expiration",
			Method:  http.MethodGet,
			URL:     "/api/kv/ttl?key=ttl:key1",
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().SetEx("ttl:key1", "value", 60000000000) // 60 seconds
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`},
		},
		{
			Name:            "ttl for non-existing key",
			Method:          http.MethodGet,
			URL:             "/api/kv/ttl?key=ttl:nonexistent",
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":false`},
		},
		{
			Name:            "ttl missing key param",
			Method:          http.MethodGet,
			URL:             "/api/kv/ttl",
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVExpire(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "set expiration on key",
			Method:  http.MethodPost,
			URL:     "/api/kv/expire",
			Body:    strings.NewReader(`{"key":"expire:key1","ttl":30000}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().Set("expire:key1", "value")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:            "expire missing key",
			Method:          http.MethodPost,
			URL:             "/api/kv/expire",
			Body:            strings.NewReader(`{"ttl":30000}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ==================== Decr 测试 ====================

func TestKVDecr(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "decr existing key",
			Method:  http.MethodPost,
			URL:     "/api/kv/decr",
			Body:    strings.NewReader(`{"key":"decr:counter"}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().IncrBy("decr:counter", 10)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":9`},
		},
		{
			Name:            "decr with delta",
			Method:          http.MethodPost,
			URL:             "/api/kv/decr",
			Body:            strings.NewReader(`{"key":"decr:counter2","delta":5}`),
			Headers:         superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().IncrBy("decr:counter2", 20)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":15`},
		},
		{
			Name:            "decr missing key",
			Method:          http.MethodPost,
			URL:             "/api/kv/decr",
			Body:            strings.NewReader(`{"delta":5}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ==================== HDel 和 HIncrBy 测试 ====================

func TestKVHDel(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "hdel field success",
			Method:  http.MethodPost,
			URL:     "/api/kv/hdel",
			Body:    strings.NewReader(`{"key":"hdel:hash1","fields":["field1"]}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().HSet("hdel:hash1", "field1", "v1")
			},
			ExpectedStatus: 200,
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestKVHIncrBy(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:    "hincrby field",
			Method:  http.MethodPost,
			URL:     "/api/kv/hincrby",
			Body:    strings.NewReader(`{"key":"hincrby:hash1","field":"counter","delta":5}`),
			Headers: superuserHeaders(),
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().HSet("hincrby:hash1", "counter", 10)
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":15`},
		},
		{
			Name:            "hincrby new field",
			Method:          http.MethodPost,
			URL:             "/api/kv/hincrby",
			Body:            strings.NewReader(`{"key":"hincrby:hash2","field":"newfield","delta":3}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":3`},
		},
		{
			Name:            "hincrby missing key",
			Method:          http.MethodPost,
			URL:             "/api/kv/hincrby",
			Body:            strings.NewReader(`{"field":"counter","delta":5}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key and field are required."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ==================== Unlock 测试 ====================

func TestKVUnlock(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "unlock missing key",
			Method:          http.MethodPost,
			URL:             "/api/kv/unlock",
			Body:            strings.NewReader(`{}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"Key is required."`},
		},
		{
			Name:            "unlock non-owned key",
			Method:          http.MethodPost,
			URL:             "/api/kv/unlock",
			Body:            strings.NewReader(`{"key":"unlock:notowned"}`),
			Headers:         superuserHeaders(),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":false`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ==================== 访问控制测试 ====================

func TestKVAccessControl(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		// 默认情况：需要超级用户权限
		{
			Name:            "set without auth - should fail",
			Method:          http.MethodPost,
			URL:             "/api/kv/set",
			Body:            strings.NewReader(`{"key":"test:key1","value":"hello"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "set with user auth - should fail",
			Method: http.MethodPost,
			URL:    "/api/kv/set",
			Body:   strings.NewReader(`{"key":"test:key1","value":"hello"}`),
			Headers: map[string]string{
				"Authorization": userToken,
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "set with superuser auth - should succeed",
			Method: http.MethodPost,
			URL:    "/api/kv/set",
			Body:   strings.NewReader(`{"key":"test:key1","value":"hello"}`),
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"ok":true`},
		},
		{
			Name:            "get without auth - should fail",
			Method:          http.MethodGet,
			URL:             "/api/kv/get?key=test:key1",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "get with superuser auth - should succeed",
			Method: http.MethodGet,
			URL:    "/api/kv/get?key=test:key1",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				app.KV().Set("test:key1", "hello")
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"found":true`},
		},
		{
			Name:            "incr without auth - should fail",
			Method:          http.MethodPost,
			URL:             "/api/kv/incr",
			Body:            strings.NewReader(`{"key":"counter:test"}`),
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "incr with superuser auth - should succeed",
			Method: http.MethodPost,
			URL:    "/api/kv/incr",
			Body:   strings.NewReader(`{"key":"counter:test"}`),
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{`"value":1`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

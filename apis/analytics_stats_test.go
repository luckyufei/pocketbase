package apis_test

import (
	"net/http"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

// 使用 kv_routes_test.go 中定义的 superuserToken 和 regularUserToken
// superuserToken = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY"
// regularUserToken = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo"

func TestAnalyticsStatsAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "stats - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/stats",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "stats - regular user forbidden",
			Method: http.MethodGet,
			URL:    "/api/analytics/stats",
			Headers: map[string]string{
				"Authorization": userToken,
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "stats - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/stats",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"summary":{`,
				`"totalPV":`,
				`"totalUV":`,
				`"daily":`,
				`"startDate":`,
				`"endDate":`,
			},
		},
		{
			Name:   "stats - with range today",
			Method: http.MethodGet,
			URL:    "/api/analytics/stats?range=today",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"summary":{`,
				`"startDate":`,
				`"endDate":`,
			},
		},
		{
			Name:   "stats - with range 30d",
			Method: http.MethodGet,
			URL:    "/api/analytics/stats?range=30d",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"summary":{`,
			},
		},
		{
			Name:   "stats - with range 90d",
			Method: http.MethodGet,
			URL:    "/api/analytics/stats?range=90d",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"summary":{`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsTopPagesAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "top pages - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/top-pages",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "top pages - regular user forbidden",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-pages",
			Headers: map[string]string{
				"Authorization": userToken,
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "top pages - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-pages",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"pages":`,
				`"startDate":`,
				`"endDate":`,
			},
		},
		{
			Name:   "top pages - with limit",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-pages?limit=5",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"pages":`,
			},
		},
		{
			Name:   "top pages - limit over 100 capped",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-pages?limit=200",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"pages":`,
			},
		},
		{
			Name:   "top pages - invalid limit uses default",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-pages?limit=abc",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"pages":`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsTopSourcesAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "top sources - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/top-sources",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "top sources - regular user forbidden",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-sources",
			Headers: map[string]string{
				"Authorization": userToken,
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "top sources - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/top-sources",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"sources":`,
				`"startDate":`,
				`"endDate":`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsDevicesAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "devices - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/devices",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "devices - regular user forbidden",
			Method: http.MethodGet,
			URL:    "/api/analytics/devices",
			Headers: map[string]string{
				"Authorization": userToken,
			},
			ExpectedStatus:  403,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "devices - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/devices",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"browsers":`,
				`"os":`,
				`"startDate":`,
				`"endDate":`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsConfigAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "config - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/config",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "config - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/config",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"enabled":`,
			},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsRawLogsAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:            "raw logs - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/raw-logs",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "raw logs - superuser success",
			Method: http.MethodGet,
			URL:    "/api/analytics/raw-logs",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"dates":`,
			},
		},
		{
			Name:            "raw log download - unauthorized",
			Method:          http.MethodGet,
			URL:             "/api/analytics/raw-logs/2026-01-09",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"data":{}`},
		},
		{
			Name:   "raw log download - not implemented",
			Method: http.MethodGet,
			URL:    "/api/analytics/raw-logs/2026-01-09",
			Headers: map[string]string{
				"Authorization": superuserToken,
			},
			ExpectedStatus:  404,
			ExpectedContent: []string{`"Raw logs download not implemented yet."`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

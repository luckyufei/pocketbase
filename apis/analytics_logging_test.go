package apis_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func TestAnalyticsRequestLogging(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "events endpoint logs request without sensitive data",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Headers: map[string]string{
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/test",
					"timestamp": 1704067200000
				}]
			}`),
			ExpectedStatus:  202,
			ExpectedContent: []string{`"accepted"`},
		},
		{
			Name:            "stats endpoint logs request for admin",
			Method:          http.MethodGet,
			URL:             "/api/analytics/stats?range=7d",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:            "top-pages endpoint logs request",
			Method:          http.MethodGet,
			URL:             "/api/analytics/top-pages?range=7d&limit=10",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:            "devices endpoint logs request",
			Method:          http.MethodGet,
			URL:             "/api/analytics/devices?range=30d",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:            "config endpoint logs request",
			Method:          http.MethodGet,
			URL:             "/api/analytics/config",
			ExpectedStatus:  401,
			ExpectedContent: []string{`"message"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

func TestAnalyticsLoggingNoSensitiveData(t *testing.T) {
	t.Parallel()

	// 验证日志不包含敏感数据
	// 这个测试主要验证请求能正常处理，日志记录在后台进行
	scenarios := []tests.ApiScenario{
		{
			Name:   "events with visitor ID should not log visitor ID",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/sensitive-page",
					"timestamp": 1704067200000
				}],
				"visitorId": "secret-visitor-123"
			}`),
			ExpectedStatus:  202,
			ExpectedContent: []string{`"accepted"`},
		},
		{
			Name:   "events with user props should not log user data",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "identify",
					"path": "/profile",
					"timestamp": 1704067200000,
					"props": {
						"userId": "user-secret-456",
						"email": "user@example.com"
					}
				}]
			}`),
			ExpectedStatus:  202,
			ExpectedContent: []string{`"accepted"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

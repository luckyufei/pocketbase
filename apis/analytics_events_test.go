package apis_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func TestAnalyticsEventsAPI(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "events - empty body",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body:   strings.NewReader(`{}`),
			ExpectedStatus: 400,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "events - empty events array",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body:   strings.NewReader(`{"events":[]}`),
			ExpectedStatus: 400,
			ExpectedContent: []string{`"No events provided."`},
		},
		{
			Name:   "events - invalid json",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body:   strings.NewReader(`{invalid}`),
			ExpectedStatus: 400,
			ExpectedContent: []string{`"message"`},
		},
		{
			Name:   "events - valid single event accepted",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/test",
					"timestamp": 1704067200000
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted"`, `"total":1`},
		},
		{
			Name:   "events - bot user agent filtered",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Headers: map[string]string{
				"User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
			},
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/test",
					"timestamp": 1704067200000
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted":0`, `"bot traffic ignored"`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestAnalyticsEventsValidation(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "events - missing event type skipped",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"path": "/test",
					"timestamp": 1704067200000
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted":0`, `"total":1`},
		},
		{
			Name:   "events - missing path skipped",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"timestamp": 1704067200000
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted":0`, `"total":1`},
		},
		{
			Name:   "events - multiple events batch",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [
					{"event": "page_view", "path": "/page1", "timestamp": 1704067200000},
					{"event": "page_view", "path": "/page2", "timestamp": 1704067201000},
					{"event": "click", "path": "/page1", "timestamp": 1704067202000, "props": {"button": "submit"}}
				]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted"`, `"total":3`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestAnalyticsEventsWithReferrer(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "events - with referrer",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/landing",
					"timestamp": 1704067200000,
					"referrer": "https://www.google.com/search?q=test"
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted"`, `"total":1`},
		},
		{
			Name:   "events - with utm parameters",
			Method: http.MethodPost,
			URL:    "/api/analytics/events",
			Body: strings.NewReader(`{
				"events": [{
					"event": "page_view",
					"path": "/campaign",
					"timestamp": 1704067200000,
					"props": {
						"utm_source": "newsletter",
						"utm_medium": "email",
						"utm_campaign": "spring_sale"
					}
				}]
			}`),
			ExpectedStatus: 202,
			ExpectedContent: []string{`"accepted"`, `"total":1`},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

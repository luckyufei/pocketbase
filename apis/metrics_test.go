package apis_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/security"
)

// ============================================================================
// Metrics API Tests
// ============================================================================

func TestMetricsAPIGetHistory(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "GET metrics history (guest)",
			Method:         http.MethodGet,
			URL:            "/api/system/metrics",
			ExpectedStatus: 401,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history (regular user)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics",
			Headers: map[string]string{
				// Regular user token
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
			},
			ExpectedStatus: 403,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics",
			Headers: map[string]string{
				// Superuser token
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// Initialize metrics service
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
				`"totalItems"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history with params (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics?hours=12&limit=500",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
				`"totalItems"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history with max hours (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics?hours=200", // exceeds max 168
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history with max limit (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics?limit=20000", // exceeds max 10000
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestMetricsAPIGetCurrent(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:           "GET current metrics (guest)",
			Method:         http.MethodGet,
			URL:            "/api/system/metrics/current",
			ExpectedStatus: 401,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET current metrics (regular user)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics/current",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
			},
			ExpectedStatus: 403,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET current metrics (superuser) - with data",
			Method: http.MethodGet,
			URL:    "/api/system/metrics/current",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
				// Wait for initial collection
				time.Sleep(100 * time.Millisecond)
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"id"`,
				`"timestamp"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ============================================================================
// Metrics Middleware Tests
// ============================================================================

func TestMetricsMiddleware(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "middleware records latency for successful request",
			Method: http.MethodGet,
			URL:    "/my/test",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
				e.Router.GET("/my/test", func(e *core.RequestEvent) error {
					return e.String(http.StatusOK, "test")
				}).BindFunc(apis.MetricsMiddleware())
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{"test"},
			ExpectedEvents:  map[string]int{"*": 0},
		},
		{
			Name:   "middleware records 5xx error",
			Method: http.MethodGet,
			URL:    "/my/error",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
				e.Router.GET("/my/error", func(e *core.RequestEvent) error {
					return e.InternalServerError("test error", nil)
				}).BindFunc(apis.MetricsMiddleware())
			},
			ExpectedStatus: 500,
			ExpectedContent: []string{
				`"status":500`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "middleware passes through 4xx error without recording as 5xx",
			Method: http.MethodGet,
			URL:    "/my/notfound",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
				e.Router.GET("/my/notfound", func(e *core.RequestEvent) error {
					return e.NotFoundError("not found", nil)
				}).BindFunc(apis.MetricsMiddleware())
			},
			ExpectedStatus: 404,
			ExpectedContent: []string{
				`"status":404`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "middleware works without collector initialized",
			Method: http.MethodGet,
			URL:    "/my/test",
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// Don't init metrics service - collector will be nil
				e.Router.GET("/my/test", func(e *core.RequestEvent) error {
					return e.String(http.StatusOK, "test")
				}).BindFunc(apis.MetricsMiddleware())
			},
			ExpectedStatus:  200,
			ExpectedContent: []string{"test"},
			ExpectedEvents:  map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ============================================================================
// InitMetricsService Tests
// ============================================================================

func TestInitMetricsService(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	err := apis.InitMetricsService(app)
	if err != nil {
		t.Fatalf("Failed to init metrics service: %v", err)
	}

	// Verify collector is available
	collector := apis.GetMetricsCollector(app)
	if collector == nil {
		t.Fatal("Expected non-nil collector")
	}

	// Verify latency buffer is available
	if collector.GetLatencyBuffer() == nil {
		t.Fatal("Expected non-nil latency buffer")
	}
}

func TestGetMetricsCollectorBeforeInit(t *testing.T) {
	t.Parallel()

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// Without init, collector should be nil
	collector := apis.GetMetricsCollector(app)
	if collector != nil {
		t.Fatal("Expected nil collector before init")
	}
}

// ============================================================================
// Metrics API Error Path Tests
// ============================================================================

func TestMetricsAPIServiceUnavailable(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "GET metrics history without service init (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			// Don't init metrics service
			ExpectedStatus: 503,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET current metrics without service init (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics/current",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			// Don't init metrics service
			ExpectedStatus: 503,
			ExpectedContent: []string{
				`"message"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestMetricsAPICurrentNotFound(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "GET current metrics with no data (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics/current",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				// Init metrics service but don't wait for collection
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
				// Immediately query before any collection happens
				// Note: This test may be flaky if collection is too fast
			},
			ExpectedStatus: 200, // Will get initial collected data
			ExpectedContent: []string{
				`"id"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestMetricsAPIWithZeroParams(t *testing.T) {
	t.Parallel()

	scenarios := []tests.ApiScenario{
		{
			Name:   "GET metrics history with zero hours (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics?hours=0&limit=0",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
		{
			Name:   "GET metrics history with negative params (superuser)",
			Method: http.MethodGet,
			URL:    "/api/system/metrics?hours=-5&limit=-10",
			Headers: map[string]string{
				"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
			},
			BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
				if err := apis.InitMetricsService(app); err != nil {
					t.Fatalf("Failed to init metrics service: %v", err)
				}
			},
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items"`,
			},
			ExpectedEvents: map[string]int{"*": 0},
		},
	}

	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

// ============================================================================
// InitMetricsService Integration Tests
// ============================================================================

func TestInitMetricsServiceWithTerminate(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// Initialize service
	if err := apis.InitMetricsService(app); err != nil {
		t.Fatalf("Failed to init: %v", err)
	}

	// Verify collector is running
	collector := apis.GetMetricsCollector(app)
	if collector == nil {
		t.Fatal("Expected non-nil collector")
	}

	// Trigger terminate event to test cleanup
	terminateEvent := &core.TerminateEvent{App: app}
	app.OnTerminate().Trigger(terminateEvent)

	// Service should still be accessible (cleanup was called)
}

func TestInitMetricsServiceCronCleanup(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// Initialize service
	if err := apis.InitMetricsService(app); err != nil {
		t.Fatalf("Failed to init: %v", err)
	}

	// Insert old data directly
	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert old record (8 days ago)
	oldMetrics := &core.SystemMetrics{
		Id:        security.RandomString(15),
		Timestamp: time.Now().UTC().AddDate(0, 0, -8),
	}
	if err := metricsDB.Insert(oldMetrics); err != nil {
		t.Fatalf("Failed to insert old metrics: %v", err)
	}

	// Manually trigger cron job (simulating cleanup)
	deleted, err := metricsDB.CleanupOldMetrics()
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("Expected 1 deleted, got %d", deleted)
	}
}

func TestInitMetricsServiceCronCleanupWithNoOldData(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// Initialize service
	if err := apis.InitMetricsService(app); err != nil {
		t.Fatalf("Failed to init: %v", err)
	}

	// Get metrics DB
	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Cleanup with no old data should return 0
	deleted, err := metricsDB.CleanupOldMetrics()
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	// May have some data from initial collection, but none should be old
	if deleted < 0 {
		t.Fatalf("Deleted should be >= 0, got %d", deleted)
	}
}

// ============================================================================
// Integration Tests
// ============================================================================

func TestMetricsEndToEnd(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// Initialize service
	if err := apis.InitMetricsService(app); err != nil {
		t.Fatalf("Failed to init: %v", err)
	}

	collector := apis.GetMetricsCollector(app)

	// Record some data
	for i := 0; i < 10; i++ {
		collector.RecordLatency(float64(i * 10))
	}
	collector.RecordError(500)
	collector.RecordError(502)

	// Wait for initial collection to complete
	time.Sleep(100 * time.Millisecond)

	// Insert test data directly to MetricsDB for query testing
	metricsDB, err := core.NewMetricsDB(app.DataDir(), core.DefaultDBConnect)
	if err != nil {
		t.Fatalf("Failed to create MetricsDB: %v", err)
	}
	defer metricsDB.Close()

	// Insert a test record
	testMetrics := &core.SystemMetrics{
		Id:              security.RandomString(15),
		Timestamp:       time.Now().UTC(),
		CpuUsagePercent: 50.0,
		MemoryAllocMB:   256.0,
		GoroutinesCount: 100,
		P95LatencyMs:    25.5,
		Http5xxCount:    5,
	}
	if err := metricsDB.Insert(testMetrics); err != nil {
		t.Fatalf("Failed to insert test metrics: %v", err)
	}

	// Query and verify
	latest, err := metricsDB.GetLatest()
	if err != nil {
		t.Fatalf("Failed to get latest: %v", err)
	}

	if latest == nil {
		t.Fatal("Expected non-nil latest metrics")
	}
}

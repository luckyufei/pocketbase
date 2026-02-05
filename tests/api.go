package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// ApiScenario defines a single api request test case/scenario.
type ApiScenario struct {
	// Name is the test name.
	Name string

	// Method is the HTTP method of the test request to use.
	Method string

	// URL is the url/path of the endpoint you want to test.
	URL string

	// Body specifies the body to send with the request.
	//
	// For example:
	//
	//	strings.NewReader(`{"title":"abc"}`)
	Body io.Reader

	// Headers specifies the headers to send with the request (e.g. "Authorization": "abc")
	Headers map[string]string

	// Delay adds a delay before checking the expectations usually
	// to ensure that all fired non-awaited go routines have finished
	Delay time.Duration

	// Timeout specifies how long to wait before cancelling the request context.
	//
	// A zero or negative value means that there will be no timeout.
	Timeout time.Duration

	// DisableTestAppCleanup disables the builtin TestApp cleanup at
	// the end of the ApiScenario execution.
	//
	// This option works only when explicit TestAppFactory is specified
	// and means that the developer is responsible to do the necessary
	// after test cleanup on their own (e.g. by manually calling testApp.Cleanup()).
	DisableTestAppCleanup bool

	// expectations
	// ---------------------------------------------------------------

	// ExpectedStatus specifies the expected response HTTP status code.
	ExpectedStatus int

	// List of keywords that MUST exist in the response body.
	//
	// Either ExpectedContent or NotExpectedContent must be set if the response body is non-empty.
	// Leave both fields empty if you want to ensure that the response didn't have any body (e.g. 204).
	ExpectedContent []string

	// List of keywords that MUST NOT exist in the response body.
	//
	// Either ExpectedContent or NotExpectedContent must be set if the response body is non-empty.
	// Leave both fields empty if you want to ensure that the response didn't have any body (e.g. 204).
	NotExpectedContent []string

	// List of hook events to check whether they were fired or not.
	//
	// You can use the wildcard "*" event key if you want to ensure
	// that no other hook events except those listed have been fired.
	//
	// For example:
	//
	//	map[string]int{ "*": 0 } // no hook events were fired
	//	map[string]int{ "*": 0, "EventA": 2 } // no hook events, except EventA were fired
	//	map[string]int{ "EventA": 2, "EventB": 0 } // ensures that EventA was fired exactly 2 times and EventB exactly 0 times.
	ExpectedEvents map[string]int

	// test hooks
	// ---------------------------------------------------------------

	TestAppFactory func(t testing.TB) *TestApp
	BeforeTestFunc func(t testing.TB, app *TestApp, e *core.ServeEvent)
	AfterTestFunc  func(t testing.TB, app *TestApp, res *http.Response)
}

// Test executes the test scenario.
//
// Example:
//
//	func TestListExample(t *testing.T) {
//	    scenario := tests.ApiScenario{
//	        Name:           "list example collection",
//	        Method:         http.MethodGet,
//	        URL:            "/api/collections/example/records",
//	        ExpectedStatus: 200,
//	        ExpectedContent: []string{
//	            `"totalItems":3`,
//	            `"id":"0yxhwia2amd8gec"`,
//	            `"id":"achvryl401bhse3"`,
//	            `"id":"llvuca81nly1qls"`,
//	        },
//	        ExpectedEvents: map[string]int{
//	            "OnRecordsListRequest": 1,
//	            "OnRecordEnrich":       3,
//	        },
//	    }
//
//	    scenario.Test(t)
//	}
func (scenario *ApiScenario) Test(t *testing.T) {
	t.Run(scenario.normalizedName(), func(t *testing.T) {
		scenario.test(t)
	})
}

// TestBothDBs 在 SQLite 和 PostgreSQL 上运行相同的测试场景。
//
// 当设置了 TEST_POSTGRES=1 或 POSTGRES_DSN 环境变量时，
// 会同时运行 PostgreSQL 版本的测试。
//
// 此方法允许渐进式迁移现有测试到双数据库模式：
//   - 默认总是运行 SQLite 测试
//   - PostgreSQL 测试仅在环境变量设置时运行
//   - 测试失败会明确标识是哪个数据库
//
// Example:
//
//	func TestListExample(t *testing.T) {
//	    scenario := tests.ApiScenario{
//	        Name:           "list example collection",
//	        Method:         http.MethodGet,
//	        URL:            "/api/collections/example/records",
//	        ExpectedStatus: 200,
//	    }
//	    scenario.TestBothDBs(t)
//	}
func (scenario *ApiScenario) TestBothDBs(t *testing.T) {
	t.Run(scenario.normalizedName(), func(t *testing.T) {
		// 始终测试 SQLite
		t.Run("SQLite", func(t *testing.T) {
			// 如果有自定义 TestAppFactory，则使用它
			// 否则使用默认的 SQLite TestApp
			// 注意：不再强制将 TestAppFactory 设为 nil
			scenario.test(t)
		})

		// 如果设置了环境变量，也测试 PostgreSQL
		if os.Getenv("TEST_POSTGRES") != "" || os.Getenv("POSTGRES_DSN") != "" {
			t.Run("PostgreSQL", func(t *testing.T) {
				// 保存原始的 TestAppFactory
				originalFactory := scenario.TestAppFactory

				// 使用 PostgreSQL TestApp
				scenario.TestAppFactory = func(tb testing.TB) *TestApp {
					app, err := NewPostgresTestApp()
					if err != nil {
						tb.Skipf("跳过 PostgreSQL 测试: %v", err)
						return nil
					}
					return app
				}
				defer func() { scenario.TestAppFactory = originalFactory }()

				scenario.test(t)
			})
		}
	})
}

// TestBothDBsParallel 并行在 SQLite 和 PostgreSQL 上运行测试场景。
// 与 TestBothDBs 类似，但 SQLite 和 PostgreSQL 测试会并行运行。
func (scenario *ApiScenario) TestBothDBsParallel(t *testing.T) {
	t.Run(scenario.normalizedName(), func(t *testing.T) {
		// SQLite 测试
		t.Run("SQLite", func(t *testing.T) {
			t.Parallel()

			// 创建场景副本以避免数据竞争
			scenarioCopy := *scenario
			scenarioCopy.TestAppFactory = nil
			scenarioCopy.test(t)
		})

		// PostgreSQL 测试
		if os.Getenv("TEST_POSTGRES") != "" || os.Getenv("POSTGRES_DSN") != "" {
			t.Run("PostgreSQL", func(t *testing.T) {
				t.Parallel()

				// 创建场景副本以避免数据竞争
				scenarioCopy := *scenario
				scenarioCopy.TestAppFactory = func(tb testing.TB) *TestApp {
					app, err := NewPostgresTestApp()
					if err != nil {
						tb.Skipf("跳过 PostgreSQL 测试: %v", err)
						return nil
					}
					return app
				}
				scenarioCopy.test(t)
			})
		}
	})
}

// ApiScenariosTestBothDBs 批量在双数据库上运行测试场景列表。
// 适合现有测试文件的快速迁移。
//
// Example:
//
//	func TestRecordCrud(t *testing.T) {
//	    scenarios := []tests.ApiScenario{...}
//	    tests.ApiScenariosTestBothDBs(t, scenarios)
//	}
func ApiScenariosTestBothDBs(t *testing.T, scenarios []ApiScenario) {
	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// ApiScenariosTestBothDBsParallel 批量并行在双数据库上运行测试场景列表。
func ApiScenariosTestBothDBsParallel(t *testing.T, scenarios []ApiScenario) {
	for _, scenario := range scenarios {
		scenario.TestBothDBsParallel(t)
	}
}

// Benchmark benchmarks the test scenario.
//
// Example:
//
//	func BenchmarkListExample(b *testing.B) {
//	    scenario := tests.ApiScenario{
//	        Name:           "list example collection",
//	        Method:         http.MethodGet,
//	        URL:            "/api/collections/example/records",
//	        ExpectedStatus: 200,
//	        ExpectedContent: []string{
//	            `"totalItems":3`,
//	            `"id":"0yxhwia2amd8gec"`,
//	            `"id":"achvryl401bhse3"`,
//	            `"id":"llvuca81nly1qls"`,
//	        },
//	        ExpectedEvents: map[string]int{
//	            "OnRecordsListRequest": 1,
//	            "OnRecordEnrich":       3,
//	        },
//	    }
//
//	    scenario.Benchmark(b)
//	}
func (scenario *ApiScenario) Benchmark(b *testing.B) {
	b.Run(scenario.normalizedName(), func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			scenario.test(b)
		}
	})
}

func (scenario *ApiScenario) normalizedName() string {
	var name = scenario.Name

	if name == "" {
		name = fmt.Sprintf("%s:%s", scenario.Method, scenario.URL)
	}

	return name
}

func (scenario *ApiScenario) test(t testing.TB) {
	var testApp *TestApp
	if scenario.TestAppFactory != nil {
		testApp = scenario.TestAppFactory(t)
		if testApp == nil {
			t.Fatal("TestAppFactory must return a non-nill app instance")
		}
	} else {
		var testAppErr error
		testApp, testAppErr = NewTestApp()
		if testAppErr != nil {
			t.Fatalf("Failed to initialize the test app instance: %v", testAppErr)
		}
	}

	// https://github.com/pocketbase/pocketbase/discussions/7267
	if scenario.TestAppFactory == nil || !scenario.DisableTestAppCleanup {
		defer testApp.Cleanup()
	}

	baseRouter, err := apis.NewRouter(testApp)
	if err != nil {
		t.Fatal(err)
	}

	// manually trigger the serve event to ensure that custom app routes and middlewares are registered
	serveEvent := new(core.ServeEvent)
	serveEvent.App = testApp
	serveEvent.Router = baseRouter

	serveErr := testApp.OnServe().Trigger(serveEvent, func(e *core.ServeEvent) error {
		if scenario.BeforeTestFunc != nil {
			scenario.BeforeTestFunc(t, testApp, e)
		}

		// reset the event counters in case a hook was triggered from a before func (eg. db save)
		testApp.ResetEventCalls()

		// add middleware to timeout long-running requests (eg. keep-alive routes)
		e.Router.Bind(&hook.Handler[*core.RequestEvent]{
			Func: func(re *core.RequestEvent) error {
				slowTimer := time.AfterFunc(3*time.Second, func() {
					t.Logf("[WARN] Long running test %q", scenario.Name)
				})
				defer slowTimer.Stop()

				if scenario.Timeout > 0 {
					ctx, cancelFunc := context.WithTimeout(re.Request.Context(), scenario.Timeout)
					defer cancelFunc()
					re.Request = re.Request.Clone(ctx)
				}

				return re.Next()
			},
			Priority: -9999,
		})

		recorder := httptest.NewRecorder()

		req := httptest.NewRequest(scenario.Method, scenario.URL, scenario.Body)

		// set default header
		req.Header.Set("content-type", "application/json")

		// set scenario headers
		for k, v := range scenario.Headers {
			req.Header.Set(k, v)
		}

		// execute request
		mux, err := e.Router.BuildMux()
		if err != nil {
			t.Fatalf("Failed to build router mux: %v", err)
		}
		mux.ServeHTTP(recorder, req)

		res := recorder.Result()

		if res.StatusCode != scenario.ExpectedStatus {
			t.Errorf("Expected status code %d, got %d", scenario.ExpectedStatus, res.StatusCode)
		}

		if scenario.Delay > 0 {
			time.Sleep(scenario.Delay)
		}

		if len(scenario.ExpectedContent) == 0 && len(scenario.NotExpectedContent) == 0 {
			if len(recorder.Body.Bytes()) != 0 {
				t.Errorf("Expected empty body, got \n%v", recorder.Body.String())
			}
		} else {
			// normalize json response format
			buffer := new(bytes.Buffer)
			err := json.Compact(buffer, recorder.Body.Bytes())
			var normalizedBody string
			if err != nil {
				// not a json...
				normalizedBody = recorder.Body.String()
			} else {
				normalizedBody = buffer.String()
			}

			for _, item := range scenario.ExpectedContent {
				if !strings.Contains(normalizedBody, item) {
					t.Errorf("Cannot find %v in response body \n%v", item, normalizedBody)
					break
				}
			}

			for _, item := range scenario.NotExpectedContent {
				if strings.Contains(normalizedBody, item) {
					t.Errorf("Didn't expect %v in response body \n%v", item, normalizedBody)
					break
				}
			}
		}

		remainingEvents := maps.Clone(testApp.EventCalls)

		var noOtherEventsShouldRemain bool
		for event, expectedNum := range scenario.ExpectedEvents {
			if event == "*" && expectedNum <= 0 {
				noOtherEventsShouldRemain = true
				continue
			}

			actualNum := remainingEvents[event]
			if actualNum != expectedNum {
				t.Errorf("Expected event %s to be called %d, got %d", event, expectedNum, actualNum)
			}

			delete(remainingEvents, event)
		}

		if noOtherEventsShouldRemain && len(remainingEvents) > 0 {
			t.Errorf("Missing expected remaining events:\n%#v\nAll triggered app events are:\n%#v", remainingEvents, testApp.EventCalls)
		}

		if scenario.AfterTestFunc != nil {
			scenario.AfterTestFunc(t, testApp, res)
		}

		return nil
	})
	if serveErr != nil {
		t.Fatalf("Failed to trigger app serve hook: %v", serveErr)
	}
}

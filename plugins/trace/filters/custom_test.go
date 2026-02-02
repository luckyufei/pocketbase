package filters

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestCustomFilter 测试自定义过滤器
func TestCustomFilter(t *testing.T) {
	t.Run("returns correct name", func(t *testing.T) {
		filter := Custom("my-filter", trace.PreExecution, func(ctx *trace.FilterContext) bool {
			return true
		})
		if filter.Name() != "my-filter" {
			t.Errorf("expected name 'my-filter', got '%s'", filter.Name())
		}
	})

	t.Run("returns configured phase", func(t *testing.T) {
		preFilter := Custom("pre", trace.PreExecution, nil)
		if preFilter.Phase() != trace.PreExecution {
			t.Error("expected PreExecution phase")
		}

		postFilter := Custom("post", trace.PostExecution, nil)
		if postFilter.Phase() != trace.PostExecution {
			t.Error("expected PostExecution phase")
		}
	})

	t.Run("executes custom function", func(t *testing.T) {
		called := false
		filter := Custom("custom", trace.PreExecution, func(ctx *trace.FilterContext) bool {
			called = true
			return true
		})

		ctx := &trace.FilterContext{}
		result := filter.ShouldTrace(ctx)

		if !called {
			t.Error("expected custom function to be called")
		}
		if !result {
			t.Error("expected result to be true")
		}
	})

	t.Run("returns false when function is nil", func(t *testing.T) {
		filter := Custom("nil-func", trace.PreExecution, nil)

		ctx := &trace.FilterContext{}
		if filter.ShouldTrace(ctx) {
			t.Error("expected nil function to return false")
		}
	})

	t.Run("passes context to function", func(t *testing.T) {
		var receivedUserID string
		filter := Custom("check-ctx", trace.PreExecution, func(ctx *trace.FilterContext) bool {
			receivedUserID = ctx.UserID
			return true
		})

		ctx := &trace.FilterContext{UserID: "test-user"}
		filter.ShouldTrace(ctx)

		if receivedUserID != "test-user" {
			t.Errorf("expected UserID 'test-user', got '%s'", receivedUserID)
		}
	})
}

// TestConditionalFilter 测试条件组合过滤器
func TestConditionalFilter(t *testing.T) {
	t.Run("And - all true", func(t *testing.T) {
		filter := And(
			Custom("a", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true }),
			Custom("b", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true }),
		)
		if !filter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected And(true, true) = true")
		}
	})

	t.Run("And - one false", func(t *testing.T) {
		filter := And(
			Custom("a", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true }),
			Custom("b", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false }),
		)
		if filter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected And(true, false) = false")
		}
	})

	t.Run("Or - all false", func(t *testing.T) {
		filter := Or(
			Custom("a", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false }),
			Custom("b", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false }),
		)
		if filter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected Or(false, false) = false")
		}
	})

	t.Run("Or - one true", func(t *testing.T) {
		filter := Or(
			Custom("a", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false }),
			Custom("b", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true }),
		)
		if !filter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected Or(false, true) = true")
		}
	})

	t.Run("Not - inverts result", func(t *testing.T) {
		trueFilter := Custom("true", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true })
		notFilter := Not(trueFilter)

		if notFilter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected Not(true) = false")
		}
	})

	t.Run("complex combination", func(t *testing.T) {
		// (A AND B) OR (NOT C)
		a := Custom("a", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false })
		b := Custom("b", trace.PreExecution, func(ctx *trace.FilterContext) bool { return true })
		c := Custom("c", trace.PreExecution, func(ctx *trace.FilterContext) bool { return false })

		filter := Or(And(a, b), Not(c))

		// (false AND true) OR (NOT false) = false OR true = true
		if !filter.ShouldTrace(&trace.FilterContext{}) {
			t.Error("expected complex filter to return true")
		}
	})
}

// TestHeaderFilter 测试 Header 过滤器
func TestHeaderFilter(t *testing.T) {
	t.Run("matches header value", func(t *testing.T) {
		filter := Header("X-Debug", "true")

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Debug", "true")
		ctx := &trace.FilterContext{Request: req}

		if !filter.ShouldTrace(ctx) {
			t.Error("expected header match to trace")
		}
	})

	t.Run("does not match different value", func(t *testing.T) {
		filter := Header("X-Debug", "true")

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Debug", "false")
		ctx := &trace.FilterContext{Request: req}

		if filter.ShouldTrace(ctx) {
			t.Error("expected header mismatch not to trace")
		}
	})

	t.Run("does not match missing header", func(t *testing.T) {
		filter := Header("X-Debug", "true")

		req := httptest.NewRequest("GET", "/test", nil)
		ctx := &trace.FilterContext{Request: req}

		if filter.ShouldTrace(ctx) {
			t.Error("expected missing header not to trace")
		}
	})

	t.Run("returns false when request is nil", func(t *testing.T) {
		filter := Header("X-Debug", "true")
		ctx := &trace.FilterContext{Request: nil}

		if filter.ShouldTrace(ctx) {
			t.Error("expected nil request not to trace")
		}
	})
}

// TestStatusCodeFilter 测试状态码过滤器
func TestStatusCodeFilter(t *testing.T) {
	t.Run("matches single status code", func(t *testing.T) {
		filter := StatusCode(500)

		ctx := &trace.FilterContext{
			Response: &trace.Response{StatusCode: 500},
		}
		if !filter.ShouldTrace(ctx) {
			t.Error("expected status 500 to match")
		}
	})

	t.Run("matches multiple status codes", func(t *testing.T) {
		filter := StatusCode(400, 401, 403, 404, 500)

		ctx := &trace.FilterContext{
			Response: &trace.Response{StatusCode: 401},
		}
		if !filter.ShouldTrace(ctx) {
			t.Error("expected status 401 to match")
		}
	})

	t.Run("does not match different status", func(t *testing.T) {
		filter := StatusCode(500)

		ctx := &trace.FilterContext{
			Response: &trace.Response{StatusCode: 200},
		}
		if filter.ShouldTrace(ctx) {
			t.Error("expected status 200 not to match 500")
		}
	})

	t.Run("returns false when response is nil", func(t *testing.T) {
		filter := StatusCode(500)

		ctx := &trace.FilterContext{Response: nil}
		if filter.ShouldTrace(ctx) {
			t.Error("expected nil response not to match")
		}
	})
}

// TestDurationRangeFilter 测试持续时间范围过滤器
func TestDurationRangeFilter(t *testing.T) {
	t.Run("matches within range", func(t *testing.T) {
		filter := DurationRange(100*time.Millisecond, 500*time.Millisecond)

		ctx := &trace.FilterContext{Duration: 200 * time.Millisecond}
		if !filter.ShouldTrace(ctx) {
			t.Error("expected 200ms to be within 100ms-500ms")
		}
	})

	t.Run("matches at boundaries", func(t *testing.T) {
		filter := DurationRange(100*time.Millisecond, 500*time.Millisecond)

		ctxLow := &trace.FilterContext{Duration: 100 * time.Millisecond}
		if !filter.ShouldTrace(ctxLow) {
			t.Error("expected 100ms to match (inclusive)")
		}

		ctxHigh := &trace.FilterContext{Duration: 500 * time.Millisecond}
		if !filter.ShouldTrace(ctxHigh) {
			t.Error("expected 500ms to match (inclusive)")
		}
	})

	t.Run("does not match below min", func(t *testing.T) {
		filter := DurationRange(100*time.Millisecond, 500*time.Millisecond)

		ctx := &trace.FilterContext{Duration: 50 * time.Millisecond}
		if filter.ShouldTrace(ctx) {
			t.Error("expected 50ms not to match")
		}
	})

	t.Run("does not match above max", func(t *testing.T) {
		filter := DurationRange(100*time.Millisecond, 500*time.Millisecond)

		ctx := &trace.FilterContext{Duration: 600 * time.Millisecond}
		if filter.ShouldTrace(ctx) {
			t.Error("expected 600ms not to match")
		}
	})

	t.Run("zero max means no upper limit", func(t *testing.T) {
		filter := DurationRange(100*time.Millisecond, 0)

		ctx := &trace.FilterContext{Duration: 1 * time.Hour}
		if !filter.ShouldTrace(ctx) {
			t.Error("expected no upper limit when max is 0")
		}
	})
}

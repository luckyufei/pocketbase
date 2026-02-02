package filters

import (
	"net/http"
	"testing"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// TestPathPrefixFilter 测试 PathPrefix 过滤器
func TestPathPrefixFilter(t *testing.T) {
	filter := PathPrefix("/api/", "/admin/")

	t.Run("Name 返回 path_prefix", func(t *testing.T) {
		if filter.Name() != "path_prefix" {
			t.Errorf("Name should be 'path_prefix', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PreExecution", func(t *testing.T) {
		if filter.Phase() != trace.PreExecution {
			t.Errorf("Phase should be PreExecution")
		}
	})

	t.Run("匹配路径前缀", func(t *testing.T) {
		testCases := []struct {
			path     string
			expected bool
		}{
			{"/api/users", true},
			{"/api/posts/123", true},
			{"/admin/settings", true},
			{"/admin/", true},
			{"/other/path", false},
			{"/", false},
			{"/apiother", false}, // 不匹配，因为前缀是 /api/
		}

		for _, tc := range testCases {
			req, _ := http.NewRequest("GET", "http://localhost"+tc.path, nil)
			ctx := &trace.FilterContext{
				Request: req,
			}
			result := filter.ShouldTrace(ctx)
			if result != tc.expected {
				t.Errorf("Path %s: expected %v, got %v", tc.path, tc.expected, result)
			}
		}
	})

	t.Run("Request 为 nil 时返回 false", func(t *testing.T) {
		ctx := &trace.FilterContext{
			Request: nil,
		}
		if filter.ShouldTrace(ctx) {
			t.Error("ShouldTrace should return false when Request is nil")
		}
	})
}

// TestPathExcludeFilter 测试 PathExclude 过滤器
func TestPathExcludeFilter(t *testing.T) {
	filter := PathExclude("/health", "/metrics", "/_/")

	t.Run("Name 返回 path_exclude", func(t *testing.T) {
		if filter.Name() != "path_exclude" {
			t.Errorf("Name should be 'path_exclude', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PreExecution", func(t *testing.T) {
		if filter.Phase() != trace.PreExecution {
			t.Errorf("Phase should be PreExecution")
		}
	})

	t.Run("排除匹配路径", func(t *testing.T) {
		testCases := []struct {
			path     string
			expected bool
		}{
			{"/api/users", true},     // 不匹配排除规则，应该追踪
			{"/health", false},       // 精确匹配，不追踪
			{"/health/check", false}, // 前缀匹配，不追踪
			{"/metrics", false},      // 精确匹配，不追踪
			{"/_/settings", false},   // 包含 /_/，不追踪
			{"/api/_/trace", false},  // 包含 /_/，不追踪
			{"/other", true},         // 不匹配，应该追踪
		}

		for _, tc := range testCases {
			req, _ := http.NewRequest("GET", "http://localhost"+tc.path, nil)
			ctx := &trace.FilterContext{
				Request: req,
			}
			result := filter.ShouldTrace(ctx)
			if result != tc.expected {
				t.Errorf("Path %s: expected %v, got %v", tc.path, tc.expected, result)
			}
		}
	})

	t.Run("Request 为 nil 时返回 true", func(t *testing.T) {
		ctx := &trace.FilterContext{
			Request: nil,
		}
		// 无法检查路径，默认允许追踪
		if !filter.ShouldTrace(ctx) {
			t.Error("ShouldTrace should return true when Request is nil")
		}
	})
}

// TestPathMatchFilter 测试 PathMatch 通配符过滤器
func TestPathMatchFilter(t *testing.T) {
	filter := PathMatch("/api/v*/users/*", "/admin/**")

	t.Run("Name 返回 path_match", func(t *testing.T) {
		if filter.Name() != "path_match" {
			t.Errorf("Name should be 'path_match', got %s", filter.Name())
		}
	})

	t.Run("Phase 返回 PreExecution", func(t *testing.T) {
		if filter.Phase() != trace.PreExecution {
			t.Errorf("Phase should be PreExecution")
		}
	})

	t.Run("匹配通配符模式", func(t *testing.T) {
		testCases := []struct {
			path     string
			expected bool
		}{
			{"/api/v1/users/123", true},
			{"/api/v2/users/abc", true},
			{"/admin/settings", true},
			{"/admin/users/list", true},
			{"/other/path", false},
		}

		for _, tc := range testCases {
			req, _ := http.NewRequest("GET", "http://localhost"+tc.path, nil)
			ctx := &trace.FilterContext{
				Request: req,
			}
			result := filter.ShouldTrace(ctx)
			if result != tc.expected {
				t.Errorf("Path %s: expected %v, got %v", tc.path, tc.expected, result)
			}
		}
	})
}

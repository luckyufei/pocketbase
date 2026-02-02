package filters

import (
	"path"
	"strings"

	"github.com/pocketbase/pocketbase/plugins/trace"
)

// pathPrefixFilter 路径前缀过滤器
type pathPrefixFilter struct {
	prefixes []string
}

// PathPrefix 返回路径前缀过滤器
// 只追踪匹配指定前缀的请求
func PathPrefix(prefixes ...string) trace.Filter {
	return &pathPrefixFilter{prefixes: prefixes}
}

// Name 返回过滤器名称
func (f *pathPrefixFilter) Name() string {
	return "path_prefix"
}

// Phase 返回过滤器阶段
func (f *pathPrefixFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

// ShouldTrace 判断是否应该追踪
func (f *pathPrefixFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Request == nil {
		return false
	}

	reqPath := ctx.Request.URL.Path
	for _, prefix := range f.prefixes {
		if strings.HasPrefix(reqPath, prefix) {
			return true
		}
	}
	return false
}

// pathExcludeFilter 路径排除过滤器
type pathExcludeFilter struct {
	patterns []string
}

// PathExclude 返回路径排除过滤器
// 排除匹配指定模式的请求（不追踪）
func PathExclude(patterns ...string) trace.Filter {
	return &pathExcludeFilter{patterns: patterns}
}

// Name 返回过滤器名称
func (f *pathExcludeFilter) Name() string {
	return "path_exclude"
}

// Phase 返回过滤器阶段
func (f *pathExcludeFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

// ShouldTrace 判断是否应该追踪
// 如果路径匹配任一排除模式，返回 false
func (f *pathExcludeFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Request == nil {
		return true // 无法检查路径，默认允许追踪
	}

	reqPath := ctx.Request.URL.Path
	for _, pattern := range f.patterns {
		// 支持前缀匹配和包含匹配
		if strings.HasPrefix(reqPath, pattern) || strings.Contains(reqPath, pattern) {
			return false
		}
	}
	return true
}

// pathMatchFilter 路径通配符过滤器
type pathMatchFilter struct {
	patterns []string
}

// PathMatch 返回路径通配符过滤器
// 支持 * (单段匹配) 和 ** (多段匹配) 通配符
func PathMatch(patterns ...string) trace.Filter {
	return &pathMatchFilter{patterns: patterns}
}

// Name 返回过滤器名称
func (f *pathMatchFilter) Name() string {
	return "path_match"
}

// Phase 返回过滤器阶段
func (f *pathMatchFilter) Phase() trace.FilterPhase {
	return trace.PreExecution
}

// ShouldTrace 判断是否应该追踪
func (f *pathMatchFilter) ShouldTrace(ctx *trace.FilterContext) bool {
	if ctx.Request == nil {
		return false
	}

	reqPath := ctx.Request.URL.Path
	for _, pattern := range f.patterns {
		if matchPath(pattern, reqPath) {
			return true
		}
	}
	return false
}

// matchPath 匹配路径模式
// 支持 * (单段匹配) 和 ** (多段匹配)
func matchPath(pattern, reqPath string) bool {
	// 处理 ** 通配符（匹配多段）
	if strings.Contains(pattern, "**") {
		parts := strings.Split(pattern, "**")
		if len(parts) == 2 {
			prefix := parts[0]
			suffix := parts[1]
			if strings.HasPrefix(reqPath, prefix) {
				if suffix == "" {
					return true
				}
				return strings.HasSuffix(reqPath, suffix)
			}
		}
		return false
	}

	// 使用 path.Match 处理 * 通配符
	matched, _ := path.Match(pattern, reqPath)
	return matched
}

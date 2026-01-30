package gateway

import (
	"strings"
)

// AuthInfo 认证信息（从 RequestEvent 中提取）
type AuthInfo struct {
	ID     string         // 用户 ID
	Fields map[string]any // 其他字段
}

// GetField 获取认证用户的字段值
func (a *AuthInfo) GetField(name string) any {
	if a == nil || a.Fields == nil {
		return nil
	}
	return a.Fields[name]
}

// EvaluateAccessRule 评估代理访问规则
// 返回是否允许访问
//
// 规则逻辑：
// - 空规则 ("" 或 nil): 仅 Superuser 可访问
// - "true": 公开访问
// - "false": 禁止访问
// - "@request.auth.id != ''": 需要登录
// - 其他表达式: 使用简化的规则匹配
func EvaluateAccessRule(rule string, isSuperuser bool, authInfo *AuthInfo) bool {
	// 空规则 = 仅 Superuser
	if rule == "" {
		return isSuperuser
	}

	// "true" = 公开访问
	if rule == "true" {
		return true
	}

	// "false" = 禁止访问
	if rule == "false" {
		return false
	}

	// 简化的规则评估
	return evaluateSimpleRule(rule, authInfo)
}

// evaluateSimpleRule 简化的规则评估
// 支持常见的规则模式，不使用完整的 Rule Engine
func evaluateSimpleRule(rule string, authInfo *AuthInfo) bool {
	// 规则: @request.auth.id != ''
	// 含义: 需要登录
	if strings.Contains(rule, "@request.auth.id") && strings.Contains(rule, "!= ''") {
		return authInfo != nil && authInfo.ID != ""
	}

	// 规则: @request.auth.id = ''
	// 含义: 必须未登录
	if strings.Contains(rule, "@request.auth.id") && strings.Contains(rule, "= ''") && !strings.Contains(rule, "!=") {
		return authInfo == nil || authInfo.ID == ""
	}

	// 对于复杂规则，如果有认证记录则允许，否则拒绝
	// 这是一个保守的默认行为
	if authInfo != nil {
		return true
	}

	return false
}

// CheckProxyAccess 检查请求是否有权访问代理
// 这是一个便捷方法，结合了认证检查和规则评估
func CheckProxyAccess(proxy *ProxyConfig, isSuperuser bool, authInfo *AuthInfo) bool {
	return EvaluateAccessRule(proxy.AccessRule, isSuperuser, authInfo)
}

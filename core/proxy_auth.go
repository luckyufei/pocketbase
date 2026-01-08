package core

import (
	"strings"
)

// EvaluateProxyAccessRule 评估代理访问规则
// 返回 (是否允许访问, 错误)
//
// 规则逻辑：
// - 空规则 ("" 或 nil): 仅 Superuser 可访问
// - "true": 公开访问
// - "@request.auth.id != ''": 需要登录
// - 其他表达式: 使用简化的规则匹配
func EvaluateProxyAccessRule(e *RequestEvent, rule string, isSuperuser bool) (bool, error) {
	// 空规则 = 仅 Superuser
	if rule == "" {
		return isSuperuser, nil
	}

	// "true" = 公开访问
	if rule == "true" {
		return true, nil
	}

	// "false" = 禁止访问
	if rule == "false" {
		return false, nil
	}

	// 简化的规则评估
	return evaluateSimpleRule(e, rule)
}

// evaluateSimpleRule 简化的规则评估
// 支持常见的规则模式，不使用完整的 Rule Engine
func evaluateSimpleRule(e *RequestEvent, rule string) (bool, error) {
	// 获取认证记录
	authRecord := e.Auth

	// 规则: @request.auth.id != ''
	// 含义: 需要登录
	if strings.Contains(rule, "@request.auth.id") && strings.Contains(rule, "!= ''") {
		return authRecord != nil && authRecord.Id != "", nil
	}

	// 规则: @request.auth.id = ''
	// 含义: 必须未登录
	if strings.Contains(rule, "@request.auth.id") && strings.Contains(rule, "= ''") && !strings.Contains(rule, "!=") {
		return authRecord == nil || authRecord.Id == "", nil
	}

	// 对于复杂规则，如果有认证记录则允许，否则拒绝
	// 这是一个保守的默认行为
	if authRecord != nil {
		return true, nil
	}

	return false, nil
}

// CheckProxyAccess 检查请求是否有权访问代理
// 这是一个便捷方法，结合了认证检查和规则评估
func CheckProxyAccess(e *RequestEvent, proxy *ProxyConfig) (bool, error) {
	// 检查是否是 Superuser
	isSuperuser := e.HasSuperuserAuth()

	// 评估访问规则
	return EvaluateProxyAccessRule(e, proxy.AccessRule, isSuperuser)
}

package core

import (
	"fmt"
	"net/http"
	"os"
	"regexp"
)

// 模板变量正则表达式
var (
	// {env.VAR_NAME} - 环境变量
	envVarRegex = regexp.MustCompile(`\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}`)

	// {secret.VAR_NAME} - _secrets 表
	secretVarRegex = regexp.MustCompile(`\{secret\.([a-zA-Z_][a-zA-Z0-9_]*)\}`)

	// @request.auth.* - 用户上下文
	authVarRegex = regexp.MustCompile(`@request\.auth\.([a-zA-Z_][a-zA-Z0-9_]*)`)
)

// ParseHeaderTemplate 解析请求头模板，替换变量
//
// 支持的模板语法：
// - {env.VAR_NAME}: 从环境变量读取
// - {secret.VAR_NAME}: 从 _secrets 表读取（待实现）
// - @request.auth.field: 从当前认证用户读取字段
func ParseHeaderTemplate(app App, template string, authRecord *Record) (string, error) {
	if template == "" {
		return "", nil
	}

	result := template

	// 1. 替换环境变量 {env.VAR_NAME}
	result, err := replaceEnvVars(result)
	if err != nil {
		return "", err
	}

	// 2. 替换 _secrets 表变量 {secret.VAR_NAME}
	result, err = replaceSecretVars(app, result)
	if err != nil {
		return "", err
	}

	// 3. 替换认证上下文 @request.auth.*
	result = replaceAuthVars(result, authRecord)

	return result, nil
}

// replaceEnvVars 替换环境变量模板
func replaceEnvVars(template string) (string, error) {
	var lastErr error

	result := envVarRegex.ReplaceAllStringFunc(template, func(match string) string {
		// 提取变量名
		matches := envVarRegex.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match
		}

		varName := matches[1]
		value := os.Getenv(varName)

		if value == "" {
			lastErr = fmt.Errorf("environment variable %q not found", varName)
			return ""
		}

		return value
	})

	return result, lastErr
}

// replaceSecretVars 替换 _secrets 表变量
// TODO: 实现从 _secrets 表读取密钥
func replaceSecretVars(app App, template string) (string, error) {
	if !secretVarRegex.MatchString(template) {
		return template, nil
	}

	var lastErr error

	result := secretVarRegex.ReplaceAllStringFunc(template, func(match string) string {
		matches := secretVarRegex.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match
		}

		varName := matches[1]

		// 尝试从 _secrets 表读取
		secret, err := findSecret(app, varName)
		if err != nil {
			// 回退到环境变量
			value := os.Getenv(varName)
			if value != "" {
				return value
			}
			lastErr = fmt.Errorf("secret %q not found", varName)
			return ""
		}

		return secret
	})

	return result, lastErr
}

// findSecret 从 SecretsStore 查找密钥
// 如果 SecretsStore 不可用，返回错误
func findSecret(app App, name string) (string, error) {
	secrets := app.Secrets()
	if secrets == nil || !secrets.IsEnabled() {
		return "", fmt.Errorf("secrets store not available")
	}

	value, err := secrets.Get(name)
	if err != nil {
		return "", fmt.Errorf("secret %q not found: %w", name, err)
	}

	return value, nil
}

// replaceAuthVars 替换认证上下文变量
func replaceAuthVars(template string, authRecord *Record) string {
	if authRecord == nil {
		// 无认证时，清空所有 @request.auth.* 变量
		return authVarRegex.ReplaceAllString(template, "")
	}

	return authVarRegex.ReplaceAllStringFunc(template, func(match string) string {
		matches := authVarRegex.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match
		}

		fieldName := matches[1]

		// 特殊处理 id 字段
		if fieldName == "id" {
			return authRecord.Id
		}

		// 获取其他字段
		value := authRecord.Get(fieldName)
		if value == nil {
			return ""
		}

		return fmt.Sprintf("%v", value)
	})
}

// BuildProxyHeaders 构建代理请求头
// 解析所有模板并返回最终的请求头映射
func BuildProxyHeaders(app App, headers map[string]string, authRecord *Record) (map[string]string, error) {
	result := make(map[string]string, len(headers))

	for key, template := range headers {
		value, err := ParseHeaderTemplate(app, template, authRecord)
		if err != nil {
			return nil, fmt.Errorf("failed to parse header %q: %w", key, err)
		}
		result[key] = value
	}

	return result, nil
}

// InjectProxyHeaders 将代理配置的请求头注入到 HTTP 请求
func InjectProxyHeaders(app App, proxy *ProxyConfig, req *http.Request, authRecord *Record) error {
	if len(proxy.Headers) == 0 {
		return nil
	}

	headers, err := BuildProxyHeaders(app, proxy.Headers, authRecord)
	if err != nil {
		return err
	}

	for key, value := range headers {
		if value != "" {
			req.Header.Set(key, value)
		}
	}

	return nil
}

// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"regexp"
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

// SecretService 密钥服务
// 优先使用 core.SecretsStore，如果不可用则回退到内存存储
type SecretService struct {
	app         core.App
	coreSecrets core.SecretsStore // 桥接到 core.SecretsStore
	fallback    map[string]string
	mutex       sync.RWMutex
}

// NewSecretService 创建密钥服务
func NewSecretService(app core.App) *SecretService {
	ss := &SecretService{
		app:      app,
		fallback: make(map[string]string),
	}

	// 尝试获取 core.SecretsStore
	if app != nil {
		ss.coreSecrets = app.Secrets()
	}

	return ss
}

// useCoreSecrets 检查是否应该使用 core.SecretsStore
func (ss *SecretService) useCoreSecrets() bool {
	return ss.coreSecrets != nil && ss.coreSecrets.IsEnabled()
}

// MockSecret 模拟设置密钥（用于测试）
func (ss *SecretService) MockSecret(name, value string) {
	ss.mutex.Lock()
	defer ss.mutex.Unlock()
	ss.fallback[name] = value
}

// Get 获取密钥
func (ss *SecretService) Get(name string) string {
	// 优先使用 core.SecretsStore
	if ss.useCoreSecrets() {
		val, err := ss.coreSecrets.Get(name)
		if err == nil {
			return val
		}
	}

	// Fallback 到内存存储
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()
	return ss.fallback[name]
}

// GetWithDefault 获取密钥，不存在时返回默认值
func (ss *SecretService) GetWithDefault(name, defaultValue string) string {
	if ss.useCoreSecrets() {
		return ss.coreSecrets.GetWithDefault(name, defaultValue)
	}

	// Fallback 到内存存储
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()

	if val, exists := ss.fallback[name]; exists {
		return val
	}
	return defaultValue
}

// GetForEnv 获取指定环境的密钥
func (ss *SecretService) GetForEnv(name, env string) (string, error) {
	if ss.useCoreSecrets() {
		return ss.coreSecrets.GetForEnv(name, env)
	}

	// Fallback 到内存存储（不支持环境区分）
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()

	if val, exists := ss.fallback[name]; exists {
		return val, nil
	}
	return "", core.ErrSecretNotFound
}

// Exists 检查密钥是否存在
func (ss *SecretService) Exists(name string) (bool, error) {
	if ss.useCoreSecrets() {
		return ss.coreSecrets.Exists(name)
	}

	// Fallback 到内存存储
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()

	_, exists := ss.fallback[name]
	return exists, nil
}

// GetMasked 获取脱敏后的密钥值（用于日志）
func (ss *SecretService) GetMasked(name string) string {
	val := ss.Get(name)
	return MaskSecret(val)
}

// IsValidName 验证密钥名称是否有效
func (ss *SecretService) IsValidName(name string) bool {
	// 只允许大写字母、数字和下划线
	pattern := regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
	return pattern.MatchString(name)
}

// MaskSecret 对密钥值进行脱敏
func MaskSecret(value string) string {
	if value == "" {
		return ""
	}

	length := len(value)
	if length <= 6 {
		return "***"
	}

	// 保留前3和后3个字符
	return value[:3] + "***" + value[length-3:]
}

// HostFunctions 密钥方法扩展

// SecretGet 获取密钥
func (hf *HostFunctions) SecretGet(name string) string {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	return hf.secrets.Get(name)
}

// SecretGetWithDefault 获取密钥，不存在时返回默认值
func (hf *HostFunctions) SecretGetWithDefault(name, defaultValue string) string {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	return hf.secrets.GetWithDefault(name, defaultValue)
}

// SecretExists 检查密钥是否存在
func (hf *HostFunctions) SecretExists(name string) (bool, error) {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	return hf.secrets.Exists(name)
}

// SecretGetMasked 获取脱敏后的密钥值
func (hf *HostFunctions) SecretGetMasked(name string) string {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	return hf.secrets.GetMasked(name)
}

// MockSecret 模拟设置密钥（用于测试）
func (hf *HostFunctions) MockSecret(name, value string) {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	hf.secrets.MockSecret(name, value)
}

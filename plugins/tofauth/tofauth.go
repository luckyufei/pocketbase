// Package tofauth 提供腾讯 TOF 网关认证集成功能
//
// TOF (Tencent Open Framework) 是腾讯内部的统一身份认证网关。
// 本插件允许 PocketBase 应用通过 TOF 网关进行用户认证。
//
// 使用方式:
//
//	tofauth.MustRegister(app, tofauth.Config{
//	    SafeMode:       true,
//	    CheckTimestamp: true,
//	})
//
// 插件会自动从环境变量 TOF_APP_KEY 和 TOF_APP_TOKEN 读取配置。
// 如果 TOF_APP_TOKEN 未设置，插件将静默跳过注册。
package tofauth

import (
	"os"

	"github.com/pocketbase/pocketbase/core"
)

// Config 定义 tofauth 插件的配置选项
type Config struct {
	// AppKey 太湖应用 Key
	// 用于 TOF 登出重定向
	// 默认从环境变量 TOF_APP_KEY 读取
	AppKey string

	// AppToken 太湖应用 Token
	// 用于校验网关签名和解密 JWE 身份信息
	// 默认从环境变量 TOF_APP_TOKEN 读取
	// 如果环境变量和配置都为空，插件将不会注册（静默跳过）
	AppToken string

	// SafeMode 启用安全模式验证（推荐生产环境启用）
	// 安全模式下只使用 JWE 加密的身份信息，不使用明文 headers
	// 默认: true（使用指针以区分显式 false 和未设置）
	SafeMode *bool

	// RoutePrefix API 路由前缀（仅用于 logout 和 redirect）
	// 默认: "/api/tof"
	// 注意：认证路由固定为 /api/collections/{collection}/auth-with-tof
	RoutePrefix string

	// CheckTimestamp 是否检查时间戳过期（180秒）
	// 默认: true（使用指针以区分显式 false 和未设置）
	CheckTimestamp *bool

	// DevMockUser 开发模式下的模拟用户名
	// 当 TOF headers 缺失时，使用此用户名模拟登录
	// 仅用于本地开发调试，生产环境请勿设置
	// 默认从环境变量 TOF_DEV_MOCK_USER 读取
	DevMockUser string
}

// Bool 是一个辅助函数，用于创建 bool 指针
func Bool(v bool) *bool {
	return &v
}

// applyDefaults 应用配置默认值
func applyDefaults(config Config) Config {
	// 从环境变量读取 AppKey（如果未显式配置）
	if config.AppKey == "" {
		config.AppKey = os.Getenv("TOF_APP_KEY")
	}

	// 从环境变量读取 AppToken（如果未显式配置）
	if config.AppToken == "" {
		config.AppToken = os.Getenv("TOF_APP_TOKEN")
	}

	// 从环境变量读取 DevMockUser（如果未显式配置）
	if config.DevMockUser == "" {
		config.DevMockUser = os.Getenv("TOF_DEV_MOCK_USER")
	}

	// 设置默认值
	if config.RoutePrefix == "" {
		config.RoutePrefix = "/api/tof"
	}

	// SafeMode 默认为 true
	if config.SafeMode == nil {
		config.SafeMode = Bool(true)
	}

	// CheckTimestamp 默认为 true
	if config.CheckTimestamp == nil {
		config.CheckTimestamp = Bool(true)
	}

	return config
}

// getSafeMode 获取 SafeMode 值
func (c Config) getSafeMode() bool {
	if c.SafeMode == nil {
		return true
	}
	return *c.SafeMode
}

// getCheckTimestamp 获取 CheckTimestamp 值
func (c Config) getCheckTimestamp() bool {
	if c.CheckTimestamp == nil {
		return true
	}
	return *c.CheckTimestamp
}

// MustRegister 注册 tofauth 插件
// 如果 AppToken 为空（配置和环境变量都未设置），静默跳过注册
// 这样可以在不使用 TOF 的环境中无需修改代码
func MustRegister(app core.App, config Config) {
	if _, err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 tofauth 插件
// 返回 registered=true 表示插件已注册，registered=false 表示因 AppToken 为空而跳过
func Register(app core.App, config Config) (registered bool, err error) {
	config = applyDefaults(config)

	// 如果 AppToken 为空，静默跳过注册
	if config.AppToken == "" {
		app.Logger().Debug("tofauth: TOF_APP_TOKEN not set, skipping registration")
		return false, nil
	}

	// 注册路由
	registerRoutes(app, config)

	app.Logger().Info("tofauth: plugin registered",
		"routePrefix", config.RoutePrefix,
		"safeMode", config.getSafeMode(),
		"checkTimestamp", config.getCheckTimestamp(),
		"devMockUser", config.DevMockUser,
	)

	return true, nil
}

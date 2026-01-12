package tofauth

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// registerRoutes 注册 TOF 相关的 HTTP 路由
// 路由遵循 PocketBase 认证规范：
//   - /api/collections/{collection}/auth-with-tof - TOF 认证（标准认证路由格式）
//   - {prefix}/logout - TOF 登出
//   - {prefix}/redirect - TOF 重定向验证
//   - {prefix}/status - TOF 配置状态（需要超级管理员权限）
func registerRoutes(app core.App, config Config) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		prefix := config.RoutePrefix

		// GET {prefix}/logout - TOF 登出
		se.Router.GET(prefix+"/logout", func(e *core.RequestEvent) error {
			return handleLogout(e, config)
		})

		// GET {prefix}/redirect - TOF 重定向验证
		se.Router.GET(prefix+"/redirect", func(e *core.RequestEvent) error {
			return handleRedirect(e, config)
		})

		// GET {prefix}/status - TOF 配置状态（需要超级管理员权限）
		se.Router.GET(prefix+"/status", func(e *core.RequestEvent) error {
			return handleStatus(e, config)
		}).Bind(apis.RequireSuperuserAuth())

		// GET /api/collections/{collection}/auth-with-tof - TOF 认证
		// 遵循 PocketBase 认证路由规范：/api/collections/{collection}/auth-*
		se.Router.GET("/api/collections/{collection}/auth-with-tof", func(e *core.RequestEvent) error {
			return handleAuth(app, e, config)
		})

		return se.Next()
	})
}

// TofStatus TOF 配置状态响应
type TofStatus struct {
	Enabled     bool   `json:"enabled"`
	AppKey      string `json:"appKey"`
	AppToken    string `json:"appToken"`
	DevMockUser string `json:"devMockUser,omitempty"`
}

// handleStatus 返回 TOF 配置状态（仅供超级管理员查看）
func handleStatus(e *core.RequestEvent, config Config) error {
	// 对敏感信息进行脱敏处理
	maskedAppKey := maskSecret(config.AppKey)
	maskedAppToken := maskSecret(config.AppToken)

	status := TofStatus{
		Enabled:     config.AppToken != "",
		AppKey:      maskedAppKey,
		AppToken:    maskedAppToken,
		DevMockUser: config.DevMockUser,
	}

	return e.JSON(http.StatusOK, status)
}

// maskSecret 对敏感信息进行脱敏，只显示前4位和后4位
func maskSecret(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 8 {
		return "****"
	}
	return s[:4] + "****" + s[len(s)-4:]
}

// handleLogout 处理 TOF 登出请求
func handleLogout(e *core.RequestEvent, config Config) error {
	qsURL := e.Request.URL.Query().Get("url")
	appkey := e.Request.URL.Query().Get("appkey")

	if appkey == "" {
		appkey = config.AppKey
	}
	if qsURL == "" {
		return apis.NewBadRequestError("Missing url param in query string", nil)
	}

	// 解码 URL
	qsURL, err := url.QueryUnescape(qsURL)
	if err != nil {
		return apis.NewBadRequestError("Failed to unescape url query", err)
	}
	qsURL = cleanURL(qsURL)

	// 构建 TOF 登出 URL
	logoutURL := fmt.Sprintf(
		"https://passport.woa.com/modules/passport/signout.ashx?oauth=true&appkey=%s&nosignin=1&url=%s",
		appkey,
		url.QueryEscape(qsURL),
	)

	e.Response.Header().Set("Cache-Control", "no-cache")
	return e.Redirect(http.StatusTemporaryRedirect, logoutURL)
}

// handleRedirect 处理 TOF 重定向验证请求
func handleRedirect(e *core.RequestEvent, config Config) error {
	// 获取 headers
	taiID := e.Request.Header.Get("x-tai-identity")
	timestamp := e.Request.Header.Get("timestamp")
	signature := e.Request.Header.Get("signature")
	seq := e.Request.Header.Get("x-rio-seq")

	// 获取并验证 URL 参数
	qsURL := e.Request.URL.Query().Get("url")
	if qsURL == "" {
		return apis.NewBadRequestError("Missing url param in query string", nil)
	}
	qsURL, err := url.QueryUnescape(qsURL)
	if err != nil {
		return apis.NewBadRequestError("Failed to unescape url query", err)
	}
	qsURL = cleanURL(qsURL)

	// 检查是否缺少 TOF headers
	isMissingHeaders := taiID == "" || timestamp == "" || signature == "" || seq == ""

	// 开发模式：如果缺少 headers 且配置了 DevMockUser，直接重定向到目标 URL
	if isMissingHeaders && config.DevMockUser != "" {
		return e.Redirect(http.StatusTemporaryRedirect, qsURL)
	}

	// 验证 headers
	if config.AppToken == "" {
		return apis.NewBadRequestError("TOF_APP_TOKEN not configured", nil)
	}
	if isMissingHeaders {
		return apis.NewBadRequestError("Missing x-tai-identity/timestamp/signature/x-rio-seq in request header", nil)
	}

	// 构建 TOF 登录 URL（验证失败时重定向）
	tofLoginURL := fmt.Sprintf(
		"https://passport.woa.com/modules/passport/signin.ashx?oauth=true&appkey=%s&url=%s",
		config.AppKey,
		url.QueryEscape(qsURL),
	)

	// 验证身份
	_, err = GetTofIdentity(config.AppToken, taiID, timestamp, signature, seq, config.getSafeMode(), config.getCheckTimestamp())
	if err != nil {
		return e.Redirect(http.StatusTemporaryRedirect, tofLoginURL)
	}

	// 验证成功，重定向到目标 URL
	return e.Redirect(http.StatusTemporaryRedirect, qsURL)
}

// handleAuth 处理 TOF 认证请求
func handleAuth(app core.App, e *core.RequestEvent, config Config) error {
	// 获取 headers
	taiID := e.Request.Header.Get("x-tai-identity")
	timestamp := e.Request.Header.Get("timestamp")
	signature := e.Request.Header.Get("signature")
	seq := e.Request.Header.Get("x-rio-seq")

	var identity Identity
	var err error

	// 检查是否缺少 TOF headers
	isMissingHeaders := taiID == "" || timestamp == "" || signature == "" || seq == ""

	if isMissingHeaders && config.DevMockUser != "" {
		// 开发模式：使用模拟身份
		app.Logger().Warn("tofauth: Missing TOF headers, using mock identity",
			"mockUser", config.DevMockUser,
		)
		mockTicket := "MOCK_TICKET"
		identity = Identity{
			LoginName:  config.DevMockUser,
			StaffId:    9999999,
			Expiration: "2099-12-31T23:59:59Z",
			Ticket:     &mockTicket,
		}
	} else if isMissingHeaders {
		// 生产模式：缺少 headers 返回错误
		return apis.NewUnauthorizedError("Missing TOF params in http header", nil)
	} else {
		// 正常验证 TOF 身份
		if config.AppToken == "" {
			return apis.NewUnauthorizedError("TOF_APP_TOKEN not configured", nil)
		}
		identity, err = GetTofIdentity(config.AppToken, taiID, timestamp, signature, seq, config.getSafeMode(), config.getCheckTimestamp())
		if err != nil {
			return apis.NewUnauthorizedError(fmt.Sprintf("TOF identity verification failed: %v", err), nil)
		}
	}

	// 获取 collection 名称
	authCollectionName := e.Request.PathValue("collection")
	userEmail := fmt.Sprintf("%s@tencent.com", identity.LoginName)

	// 查找用户
	user, err := app.FindAuthRecordByEmail(authCollectionName, userEmail)
	if err != nil {
		// 如果是 _superusers，不自动创建
		if authCollectionName == core.CollectionNameSuperusers {
			return apis.NewBadRequestError(fmt.Sprintf("_superusers does not contain user with email: %s", userEmail), err)
		}

		// 用户不存在，创建新用户
		collection, err := app.FindCollectionByNameOrId(authCollectionName)
		if err != nil {
			return apis.NewNotFoundError(fmt.Sprintf("Collection '%s' not found", authCollectionName), err)
		}

		user = core.NewRecord(collection)
		user.SetEmail(userEmail)
		user.Set("name", identity.LoginName)
		user.SetPassword(security.RandomString(30))
		user.SetVerified(true) // TOF 认证的用户视为已验证

		if err := app.Save(user); err != nil {
			return apis.NewBadRequestError("Failed to create new user", err)
		}
	}

	// 使用标准认证响应 ⭐ 关键改进
	return apis.RecordAuthResponse(e, user, "tof", map[string]any{
		"tofIdentity": identity,
	})
}

// cleanURL 清理 URL 中的多余斜杠
func cleanURL(rawURL string) string {
	// 分割协议部分和路径部分
	parts := strings.SplitN(rawURL, "://", 2)
	if len(parts) < 2 {
		return rawURL
	}

	// 对路径部分处理多余斜杠
	path := regexp.MustCompile(`/+`).ReplaceAllString(parts[1], "/")

	return parts[0] + "://" + path
}

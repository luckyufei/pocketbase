package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/gateway"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/kv"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/plugins/processman"
	"github.com/pocketbase/pocketbase/plugins/tofauth"
	"github.com/pocketbase/pocketbase/plugins/trace"
	"github.com/pocketbase/pocketbase/plugins/trace/filters"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/osutils"
)

func main() {
	app := pocketbase.New()

	// ---------------------------------------------------------------
	// Optional plugin flags:
	// ---------------------------------------------------------------

	var hooksDir string
	app.RootCmd.PersistentFlags().StringVar(
		&hooksDir,
		"hooksDir",
		"",
		"the directory with the JS app hooks",
	)

	var hooksWatch bool
	app.RootCmd.PersistentFlags().BoolVar(
		&hooksWatch,
		"hooksWatch",
		true,
		"auto restart the app on pb_hooks file change; it has no effect on Windows",
	)

	var hooksPool int
	app.RootCmd.PersistentFlags().IntVar(
		&hooksPool,
		"hooksPool",
		15,
		"the total prewarm goja.Runtime instances for the JS app hooks execution",
	)

	var migrationsDir string
	app.RootCmd.PersistentFlags().StringVar(
		&migrationsDir,
		"migrationsDir",
		"",
		"the directory with the user defined migrations",
	)

	var automigrate bool
	app.RootCmd.PersistentFlags().BoolVar(
		&automigrate,
		"automigrate",
		true,
		"enable/disable auto migrations",
	)

	var publicDir string
	app.RootCmd.PersistentFlags().StringVar(
		&publicDir,
		"publicDir",
		defaultPublicDir(),
		"the directory to serve static files",
	)

	var indexFallback bool
	app.RootCmd.PersistentFlags().BoolVar(
		&indexFallback,
		"indexFallback",
		true,
		"fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
	)

	var pmConfigFile string
	app.RootCmd.PersistentFlags().StringVar(
		&pmConfigFile,
		"pmConfig",
		"",
		"the Process Manager configuration file (default: pb_data/pm.json)",
	)

	app.RootCmd.ParseFlags(os.Args[1:])

	// ---------------------------------------------------------------
	// Plugins and hooks:
	// ---------------------------------------------------------------

	// Trace 插件 - 分布式追踪
	// 支持三种模式: ModeOff（禁用）, ModeConditional（条件采集）, ModeFull（全量采集）
	// 也可以通过环境变量配置: PB_TRACE_MODE, PB_TRACE_SAMPLE_RATE 等
	trace.MustRegister(app, trace.Config{
		Mode:          trace.ModeConditional,              // 条件采集模式
		SampleRate:    0.1,                                // 10% 采样率
		DyeMaxUsers:   100,                                // 最多 100 个染色用户
		DyeDefaultTTL: 24 * time.Hour,                     // 染色默认 24 小时过期
		RetentionDays: 7,                                  // 保留 7 天数据
		Filters: []trace.Filter{
			filters.ErrorOnly(),                           // 采集错误请求
			filters.SlowRequest(500 * time.Millisecond),   // 采集慢请求 (>500ms)
			filters.PathExclude("/health", "/metrics"),    // 排除健康检查路径
		},
	})

	// KV 插件 - 类 Redis 键值存储
	// 提供两级缓存：L1 进程内缓存 + L2 数据库持久化
	// 支持 Set/Get/Delete/Incr/Hash/Lock 等操作
	// 可通过环境变量配置: PB_KV_L1_ENABLED, PB_KV_HTTP_ENABLED 等
	kv.MustRegister(app, kv.Config{
		L1Enabled:   true,               // 启用 L1 内存缓存
		L1TTL:       5 * time.Second,    // L1 缓存 TTL
		HTTPEnabled: false,              // 默认不启用 HTTP API（需超级用户权限）
	})

	// TOF 认证插件
	// 自动从环境变量 TOF_APP_KEY 和 TOF_APP_TOKEN 读取配置
	// 如果 TOF_APP_TOKEN 未设置，插件将静默跳过
	tofConfig := tofauth.Config{
		SafeMode:       tofauth.Bool(true),
		CheckTimestamp: tofauth.Bool(true),
	}
	tofauth.MustRegister(app, tofConfig)

	// Gateway 插件 - API 网关代理转发
	// 支持代理 LLM API（OpenAI、Claude 等）和本地 Sidecar
	// 使用 ReverseProxy + "暴力归一化" 策略解决协议兼容问题
	gateway.MustRegister(app, gateway.Config{})

	// load jsvm (pb_hooks and pb_migrations)
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
		OnInit: func(vm *goja.Runtime) {
			// 注入 $tof 对象到 JS 运行时（如果 TOF 已配置）
			if os.Getenv("TOF_APP_TOKEN") != "" || os.Getenv("TOF_DEV_MOCK_USER") != "" {
				tofauth.BindToVMWithConfig(vm, tofConfig)
			}
		},
	})

	// migrate command (with js templates)
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// GitHub selfupdate
	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	// Process Manager plugin
	// 用于管理外部进程（如 Python MCP 服务器）
	// DevMode 自动复用 app.IsDev()
	processman.MustRegister(app, processman.Config{
		ConfigFile: pmConfigFile,
	})

	// static route to serves files from the provided public dir
	// (if publicDir exists and the route path is not already defined)
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), indexFallback))
			}

			return e.Next()
		},
		Priority: 999, // execute as latest as possible to allow users to provide their own route
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// the default pb_public dir location is relative to the executable
func defaultPublicDir() string {
	if osutils.IsProbablyGoRun() {
		return "./pb_public"
	}

	return filepath.Join(os.Args[0], "../pb_public")
}

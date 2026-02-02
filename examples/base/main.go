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
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
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

	// TOF 认证插件
	// 自动从环境变量 TOF_APP_KEY 和 TOF_APP_TOKEN 读取配置
	// 如果 TOF_APP_TOKEN 未设置，插件将静默跳过
	tofConfig := tofauth.Config{
		SafeMode:       tofauth.Bool(true),
		CheckTimestamp: tofauth.Bool(true),
	}
	tofauth.MustRegister(app, tofConfig)

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

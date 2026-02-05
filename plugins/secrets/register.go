package secrets

import (
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

var (
	storeRegistry = make(map[core.App]Store)
	storeMu       sync.RWMutex
)

// MustRegister 注册 Secrets 插件（panic on error）
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 Secrets 插件
func Register(app core.App, config Config) error {
	// 应用环境变量覆盖
	config = applyEnvOverrides(config)

	// 应用默认值
	config = applyDefaults(config)

	// 创建 Store 实例
	store := newSecretsStore(app, config)

	// 注册到全局 registry
	storeMu.Lock()
	storeRegistry[app] = store
	storeMu.Unlock()

	// 如果应用已经引导，直接创建表
	if app.IsBootstrapped() {
		if err := createSecretsTable(app); err != nil {
			return err
		}
	} else {
		// 否则通过 OnBootstrap 钩子注册
		app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
			if err := createSecretsTable(app); err != nil {
				return err
			}
			return e.Next()
		})
	}

	// 注册 HTTP 路由（如果启用）
	if config.HTTPEnabled {
		app.OnServe().BindFunc(func(se *core.ServeEvent) error {
			registerRoutes(se.Router, app, config)
			return se.Next()
		})
	}

	// 注册清理钩子
	app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		storeMu.Lock()
		delete(storeRegistry, app)
		storeMu.Unlock()
		return e.Next()
	})

	return nil
}

// GetStore 获取指定 App 的 Store
// 如果未注册，返回 nil
func GetStore(app core.App) Store {
	storeMu.RLock()
	defer storeMu.RUnlock()
	return storeRegistry[app]
}

// createSecretsTable 创建 _secrets 表
func createSecretsTable(app core.App) error {
	var query string
	if app.IsPostgres() {
		query = `
			CREATE TABLE IF NOT EXISTS _secrets (
				id TEXT PRIMARY KEY,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				env TEXT NOT NULL DEFAULT 'global',
				description TEXT,
				created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_key_env ON _secrets (key, env);
			CREATE INDEX IF NOT EXISTS idx_secrets_env ON _secrets (env);
		`
	} else {
		query = `
			CREATE TABLE IF NOT EXISTS _secrets (
				id TEXT PRIMARY KEY,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				env TEXT NOT NULL DEFAULT 'global',
				description TEXT,
				created TEXT NOT NULL DEFAULT (datetime('now')),
				updated TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_key_env ON _secrets (key, env);
			CREATE INDEX IF NOT EXISTS idx_secrets_env ON _secrets (env);
		`
	}

	_, err := app.DB().NewQuery(query).Execute()
	return err
}

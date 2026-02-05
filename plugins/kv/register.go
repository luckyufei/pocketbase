package kv

import (
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

var (
	storeRegistry = make(map[core.App]Store)
	storeMu       sync.RWMutex
)

// MustRegister 注册 kv 插件，失败时 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 kv 插件
func Register(app core.App, config Config) error {
	// 应用环境变量覆盖
	config = applyEnvOverrides(config)

	// 应用默认值
	config = applyDefaults(config)

	// 创建 KVStore 实例
	store := newKVStore(app, config)

	// 注册到全局 registry
	storeMu.Lock()
	storeRegistry[app] = store
	storeMu.Unlock()

	// 如果应用已经引导，直接创建表和启动清理任务
	if app.IsBootstrapped() {
		if err := createKVTable(app); err != nil {
			return err
		}
		startCleanupTask(app, store, config.CleanupInterval)
	} else {
		// 否则通过 OnBootstrap 钩子注册
		// 必须在 e.Next() 之后执行，因为数据库连接在 Bootstrap() 核心逻辑中初始化
		app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
			if err := e.Next(); err != nil {
				return err
			}

			// 数据库已初始化，创建 KV 表
			if err := createKVTable(app); err != nil {
				return err
			}

			// 启动过期清理任务
			startCleanupTask(app, store, config.CleanupInterval)

			return nil
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

// createKVTable 创建 _kv 表
func createKVTable(app core.App) error {
	var query string
	if app.IsPostgres() {
		// PostgreSQL: 使用 UNLOGGED TABLE 获得更好的写入性能
		// UNLOGGED 表不写 WAL 日志，写入性能提升 2-5 倍
		// 注意：数据库崩溃时数据会丢失，适合缓存场景
		query = `
			CREATE UNLOGGED TABLE IF NOT EXISTS _kv (
				key TEXT PRIMARY KEY,
				value JSONB NOT NULL,
				expire_at TIMESTAMPTZ,
				updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE INDEX IF NOT EXISTS idx_kv_expire_at ON _kv (expire_at) WHERE expire_at IS NOT NULL;
		`
	} else {
		query = `
			CREATE TABLE IF NOT EXISTS _kv (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				expire_at TEXT,
				updated TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE INDEX IF NOT EXISTS idx_kv_expire_at ON _kv (expire_at);
		`
	}

	_, err := app.DB().NewQuery(query).Execute()
	return err
}

// startCleanupTask 启动过期清理任务
func startCleanupTask(app core.App, store *kvStore, interval interface{}) {
	app.Cron().Add("__pbKVCleanup__", "* * * * *", func() {
		if store != nil && store.l2 != nil {
			if err := store.l2.CleanupExpired(); err != nil {
				app.Logger().Warn("KV cleanup failed", "error", err)
			}
		}
	})
}

package jobs

import (
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

var (
	storeRegistry = make(map[core.App]Store)
	storeMu       sync.RWMutex
)

// MustRegister 注册 jobs 插件，失败时 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 jobs 插件
// 返回 nil 表示成功注册或已禁用（禁用时不注册）
func Register(app core.App, config Config) error {
	// 1. 应用环境变量覆盖（优先级最高）
	config = applyEnvOverrides(config)

	// 2. 如果禁用，直接返回
	if config.Disabled {
		return nil
	}

	// 3. 应用默认值
	config = applyDefaults(config)

	// 4. 创建 JobStore 实例
	store := newJobStore(app, config)

	// 5. 注册到全局 registry
	storeMu.Lock()
	storeRegistry[app] = store
	storeMu.Unlock()

	// 6. 如果应用已经引导，直接创建表
	if app.IsBootstrapped() {
		if err := createJobsTable(app); err != nil {
			return err
		}
		// 如果配置了自动启动，启动调度器
		if config.AutoStart {
			store.Start()
		}
	} else {
		// 7. 否则通过 OnBootstrap 钩子注册
		// 必须在 e.Next() 之后执行，因为数据库连接在 Bootstrap() 核心逻辑中初始化
		app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
			if err := e.Next(); err != nil {
				return err
			}

			// 数据库已初始化，创建 jobs 表
			if err := createJobsTable(app); err != nil {
				return err
			}

			// 如果配置了自动启动，启动调度器
			if config.AutoStart {
				store.Start()
			}

			return nil
		})
	}

	// 8. 注册 HTTP 路由（如果启用）
	if config.HTTPEnabled {
		app.OnServe().BindFunc(func(se *core.ServeEvent) error {
			registerRoutes(se.Router, app, config)
			return se.Next()
		})
	}

	// 9. 注册清理钩子
	app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		// 停止调度器
		store.Stop()

		// 从 registry 中移除
		storeMu.Lock()
		delete(storeRegistry, app)
		storeMu.Unlock()

		return e.Next()
	})

	return nil
}

// GetJobStore 获取指定 App 的 JobStore
// 如果未注册或已禁用，返回 nil
func GetJobStore(app core.App) Store {
	storeMu.RLock()
	defer storeMu.RUnlock()
	return storeRegistry[app]
}

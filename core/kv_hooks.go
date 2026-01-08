package core

// initKVStore 初始化 KV 存储
func (app *BaseApp) initKVStore() {
	app.kvStore = newKVStore(app)
}

// KV 返回 KV 存储实例
func (app *BaseApp) KV() KVStore {
	return app.kvStore
}

// registerKVCleanupJob 注册 KV 过期数据清理定时任务
func (app *BaseApp) registerKVCleanupJob() {
	app.Cron().Add("__pbKVCleanup__", "* * * * *", func() {
		if app.kvStore != nil && app.kvStore.l2 != nil {
			if err := app.kvStore.l2.CleanupExpired(); err != nil {
				app.Logger().Warn("KV cleanup failed", "error", err)
			}
		}
	})
}

// startKVCleanupJob 启动 KV 清理任务（如果 cron 尚未运行）
func (app *BaseApp) startKVCleanupJob() {
	// 注册清理任务
	app.registerKVCleanupJob()
}

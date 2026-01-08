package core

// initTrace 初始化 Trace 追踪系统
func (app *BaseApp) initTrace() error {
	// 创建 trace repository
	var repo TraceRepository
	var err error

	if app.IsPostgreSQL() {
		repo, err = NewPostgresTraceRepository(app.AuxConcurrentDB())
	} else {
		repo, err = NewSQLiteTraceRepository(app.DataDir())
	}

	if err != nil {
		return err
	}

	// 创建 schema
	if err := repo.CreateSchema(); err != nil {
		return err
	}

	// 创建 trace 实例
	config := DefaultTraceConfig()
	app.trace = NewTrace(repo, config)

	return nil
}

// Trace 返回 Trace 追踪实例
func (app *BaseApp) Trace() *Trace {
	return app.trace
}

// registerTracePruneJob 注册 Trace 过期数据清理定时任务
func (app *BaseApp) registerTracePruneJob() {
	app.Cron().Add("__pbTracePrune__", "0 * * * *", func() {
		if app.trace != nil {
			if deleted, err := app.trace.Prune(); err != nil {
				app.Logger().Warn("Trace prune failed", "error", err)
			} else if deleted > 0 {
				app.Logger().Debug("Trace prune completed", "deleted", deleted)
			}
		}
	})
}

// startTracePruneJob 启动 Trace 清理任务
func (app *BaseApp) startTracePruneJob() {
	app.registerTracePruneJob()
}

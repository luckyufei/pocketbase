package core

// initJobStore 初始化 Job 存储
func (app *BaseApp) initJobStore() {
	app.jobStore = newJobStore(app)
}

// Jobs 返回 Job 存储实例
// 在事务上下文中，返回一个使用事务数据库连接的 jobStore
func (app *BaseApp) Jobs() JobStore {
	// 如果是事务上下文，创建一个使用当前 app（事务 app）的 jobStore
	if app.IsTransactional() {
		return newJobStore(app)
	}
	return app.jobStore
}
